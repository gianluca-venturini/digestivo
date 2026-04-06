## Module names
- hackernews.ts: functions to interact with hackernews website (parse HTML directly, no API)
    - getPage(day: string | null, pageNumber: number | null): Post[]
    - getUpvoted(user: string, cookie: string): Post[]
    - getComments(postId): Comments[]
- post.ts: interface for creating/reading posts
    - putPosts(post: Post[]): void // if embeddings present, update the corresponding vector table
    - getPost(id: string): Post | null
    - getPosts(ids: string[]): Post[]
    - getPostsTitleSimilar(titleEmbedding: Float32Array, k: number): {post: Post, distance: number}[] // KNN vector similarity against upvoted posts
    - getPostsArticleSimilar(articleEmbedding: Float32Array, k: number): {post: Post, distance: number}[] // KNN vector similarity against upvoted posts
- comments.ts: creating/reading comments
    - getComments(postId: string): Comment[]
    - putComments(comments: Comment[]): void
- embedding.ts: local embedding generation
    - embed(text: string): Promise<Float32Array> // generates 384-dim embedding using all-MiniLM-L6-v2
- utils.ts
    - fetchSafe(url: string): string // cascade: 1) fetch + @mozilla/readability + linkedom, 2) Jina Reader API (r.jina.ai)
- run.ts: main entry point of the app, defines the various commands the user can run from CLI. Available commands are:
    - get-posts-day <YYYY-MM-DD> <N>
    - get-posts-days <YYYY-MM-DD> <YYYY-MM-DD> <N>
    - get-upvoted-all
    - post-fetch-article <postId>
    - post-compute-metadata <postId> // extracts domain from url + generates title/article embeddings
- index.ts: API backend. The following endpoints are defined
    - POST /score: takes Posts[] as input and return {id: string; score: number}[] as output


## .env
HN_USER
HN_COOKIE


## Tables
- posts
    - id: string
    - title: string
    - article: string | null // plaintext, fetched via fetchSafe cascade
    - url: string
    - byUser: string
    - time: IsoDateString
    - titleEmbedding: Float32Array | null // 384-dim, all-MiniLM-L6-v2
    - articleEmbedding: Float32Array | null // 384-dim, all-MiniLM-L6-v2
    - domain: string | null // extracted from url
    - upvoted: bool

- comments:
    - id: string
    - postId(FK, posts.id): string
    - byUser: string
    - text: string


## Principles
- use bun
- use bun sqlite as storage
- use sqlite-vec (by Alex Garcia, asg017/sqlite-vec) for vector embeddings (384 dimensions)


## Embedding model
- Model: sentence-transformers/all-MiniLM-L6-v2
- Dimensions: 384
- Runtime: @huggingface/transformers (ONNX backend)
- Quantized variant: model_qint8_arm64.onnx (~22MB) for Raspberry Pi
- Runs locally, no external API needed


## fetchSafe cascade
1. fetch() with browser-like headers + @mozilla/readability + linkedom → extract plaintext
2. Jina Reader API: GET https://r.jina.ai/<url> with header x-respond-with: text → plaintext fallback


## Formula for score
Similarity is computed against upvoted posts in the vector database.

const score =
  0.35 * maxTitleSimilarity(post) +
  0.25 * maxArticleSimilarity(post) +
  0.25 * Math.log1p(numDomain) / Math.log1p(maxNumDomain) +
  0.15 * Math.log1p(numByUser) / Math.log1p(maxNumByUser)

- maxTitleSimilarity(post): highest cosine similarity between this post's titleEmbedding and all upvoted posts' titleEmbeddings
- maxArticleSimilarity(post): highest cosine similarity between this post's articleEmbedding and all upvoted posts' articleEmbeddings
- numDomain: number of upvoted posts from the same domain
- maxNumDomain: max numDomain across all domains in upvoted posts
- numByUser: number of upvoted posts by the same HN user
- maxNumByUser: max numByUser across all users in upvoted posts

# Detailed plan

- [x] **1. Project setup**
  - [x] 1.1 `bun init`, install deps (`sqlite-vec`, `@huggingface/transformers`, `@mozilla/readability`, `linkedom`), create `src/` dir
  - [x] 1.2 `src/db.ts` — Database singleton, load sqlite-vec, run migrations:
    - `posts` table (id, title, article, url, byUser, time, domain, upvoted)
    - `vec_title_embeddings` vec0 virtual table (post_id PK, float[384] cosine)
    - `vec_article_embeddings` vec0 virtual table (post_id PK, float[384] cosine)
    - `comments` table (id, postId FK, byUser, text)
    - upvoted stored as INTEGER (0/1), embeddings in separate vec0 tables joined by post_id

- [x] **2. `src/types.ts`** — Post and Comment interfaces
  - Post: id, title, article, url, byUser, time (ISO), domain, upvoted, titleEmbedding (Float32Array|null), articleEmbedding (Float32Array|null)
  - Comment: id, postId, byUser, text

- [x] **3. `src/hackernews.ts`** — HN HTML scraping
  - [x] 3.1 `parsePosts(html): Post[]` — shared parser for listing pages
    - `tr.athing.submission` → id, title (`.titleline > a`), url (href)
    - Next sibling row → byUser (`a.hnuser`), time (`.age[title]` ISO part)
    - Self-posts: store url as `https://news.ycombinator.com/item?id={id}`
    - Domain not extracted here (done in post-compute-metadata)
    - Default: upvoted=false, embeddings=null
  - [x] 3.2 `getPage(day, pageNumber): Post[]`
    - day=null → `news.ycombinator.com/news?p={pageNumber}`
    - day set → `news.ycombinator.com/front?day={day}&p={pageNumber}`
  - [x] 3.3 `getUpvoted(user, cookie): Post[]`
    - Fetch `/upvoted?id={user}` with Cookie header
    - Set upvoted=true on all parsed posts
    - Follow `a.morelink` pagination until exhausted
  - [x] 3.4 `getComments(postId): Comment[]`
    - Fetch `/item?id={postId}`, parse `tr.athing.comtr`
    - Only top-level: `td.ind[indent]="0"`
    - Extract id, byUser (`a.hnuser`), text (`.commtext` → plaintext)

- [x] **4. `src/post.ts`** — Post CRUD + vector search
  - [x] 4.1 `putPosts(db, posts)` — upsert posts table, wrapped in transaction
  - [x] 4.1 `putTitleEmbedding(db, postId, embedding)` / `putArticleEmbedding(db, postId, embedding)` — DELETE+INSERT into vec0 tables
  - [x] 4.2 `getPost(db, id)` — SELECT from posts, boolean coerce upvoted
  - [x] 4.3 `getPosts(db, ids)` — same with `WHERE id IN (...)`
  - [x] 4.3 `hasTitleEmbedding(db, postId)` / `hasArticleEmbedding(db, postId)` — existence checks
  - [x] 4.4 `getPostsTitleSimilar(db, embedding, k)` — KNN on vec_title_embeddings (MATCH + k), over-fetch + filter upvoted=1 in JS
  - [x] 4.5 `getPostsArticleSimilar(db, embedding, k)` — same against vec_article_embeddings
  - Note: db.ts refactored to export `initDb(db)` only; caller constructs the Database instance (tests use :memory:)

- [x] **5. `src/comments.ts`** — Comment CRUD
  - [x] 5.1 `getComments(db, postId)` — SELECT WHERE postId = ?
  - [x] 5.2 `putComments(db, comments)` — INSERT OR IGNORE, in transaction

- [x] **6. `src/embedding.ts`** — Local embedding generation
  - [x] 6.1 Lazy-init singleton `feature-extraction` pipeline with `Xenova/all-MiniLM-L6-v2`
  - [x] 6.2 `embed(text): Promise<Float32Array>` — pooling=mean, normalize=true, 384-dim output, dtype=q8 (quantized)

- [x] **7. `src/utils.ts`** — fetchSafe
  - [x] 7.1 `fetchSafe(url): Promise<string | null>` cascade:
    1. fetch() with browser headers + linkedom + Readability → `.textContent`
    2. Fallback: Jina Reader `GET r.jina.ai/{url}` with `x-respond-with: text` + `JINA_API_KEY`
    3. Both fail → return null

- [ ] **8. `src/run.ts`** — CLI entry point (process.argv switch)
  - [x] 8.1 `get-posts-day <YYYY-MM-DD> <N>` — fetch N pages for day, putPosts, print count
  - [x] 8.2 `get-posts-days <start> <end> <N>` — iterate days inclusive, get-posts-day each
  - [x] 8.3 `get-upvoted-all` — read HN_USER/HN_COOKIE from env, getUpvoted (all pages), update existing posts, putPosts new ones, print new vs total
  - [ ] 8.4 `post-fetch-article <postId>` — skip if article already set, fetchSafe → putPosts
  - [ ] 8.5 `post-compute-metadata <postId>` — extract domain (hostname minus www.), compute titleEmbedding + articleEmbedding if missing, putPosts

- [ ] **9. `src/index.ts`** — API backend (Bun.serve)
  - [ ] 9.1 `POST /score` — input: `{ posts: Post[] }` (minimal: id, title, url, byUser)
    - For each post (idempotent): insert if missing → fetchSafe article if null → embed title if null → embed article if null → compute score
    - Score computation: maxTitleSimilarity (KNN k=1, 1-distance), maxArticleSimilarity (same, or 0 if no article → redistribute weight to title: 0.60), numDomain/maxNumDomain, numByUser/maxNumByUser
    - Output: `{ scores: { id: string, score: number }[] }`
  - [ ] 9.2 `computeScore(post)` helper — encapsulate formula, precompute maxNumDomain/maxNumByUser once per batch, handle edge cases (no upvoted posts → scores all 0)

## Implementation order

1. Project setup (1)
2. types.ts (2)
3. db.ts (1.2)
4. embedding.ts (6)
5. utils.ts (7)
6. hackernews.ts (3)
7. post.ts (4)
8. comments.ts (5)
9. run.ts (8)
10. index.ts (9)
