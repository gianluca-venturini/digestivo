---
name: summarize-hn
description: Scrape the Hacker News front page, download comments and article content for every post, generate summaries, and produce a static HTML digest page styled like HN. Use when asked to summarize or digest Hacker News.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, WebFetch, Agent
effort: max
---

# Summarize Hacker News

Build a complete HN digest for today. All intermediate data is JSON — no markdown files. Run all steps in order.

## Step 1: Fetch the HN front page

Use WebFetch on `https://news.ycombinator.com/` and extract every post. Save to `hn/<YYYY-MM-DD>/home.json`:

```json
[
  {
    "id": "12345",
    "title": "Post title",
    "url": "https://example.com/article",
    "comment_url": "https://news.ycombinator.com/item?id=12345"
  }
]
```

## Step 2: Fetch, summarize, and structure every post

Read the JSON from step 1. For each post, spin up a **background haiku agent** (`model: haiku`, `run_in_background: true`).

Each agent does everything for its post and writes `posts/<post_id>.json` directly in the final schema:

```json
{
  "id": "12345",
  "title": "Post title",
  "url": "https://example.com/article",
  "hn_url": "https://news.ycombinator.com/item?id=12345",
  "domain": "example.com",
  "content": "full content in markdown",
  "isContentFetched": bool,
  "summaryS": "1-3 sentence summary of the article. If content wasn't fetchable, infer from title + HN comments.",
  "summaryM": "3-10 sentence summary of the article. If content wasn't fetchable, NA.",
  "summaryL": "10-30 sentence summary of the article. If content wasn't fetchable, NA.",
  "comments": [ // top 10 comments
    { "user": "alice", "text": "First top-level comment, max 150 chars..." },
    { "user": "bob", "text": "Second top-level comment..." },
    { "user": "carol", "text": "Third top-level comment..." },
    ...
  ]
}
```

### Agent instructions template

Give each agent this prompt (filling in the post-specific values):

> You need to fetch two URLs and produce a single JSON file. Do NOT write code — use WebFetch directly.
>
> **Post:** "<TITLE>"
> **Post ID:** <POST_ID>
> **Post URL:** <URL>
> **HN Comments URL:** <COMMENT_URL>
>
> 1. WebFetch the HN comments URL. Extract the first 10 top-level comments with username and text (max 150 chars each, truncate with "...").
> 2. WebFetch the post URL. Extract the full main article content as markdown.
> 3. **If WebFetch failed or returned empty/blocked content**, re-fetch via Chrome using Bash:
>    ```
>    tmpdir=$(mktemp -d)
>    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
>      --user-data-dir="$tmpdir" --dump-dom --no-first-run --disable-gpu \
>      --timeout=15000 "<URL>" 2>/dev/null > /tmp/chrome_<POST_ID>.html
>    ```
>    Check the output file size — anything under 100 bytes is a failure. A fresh `--user-data-dir` temp dir is required to avoid attaching to an existing Chrome session. If the file is >100 bytes, read it and extract the article content from the HTML.
> 4. After attempts, if content is still unavailable, set `content` to `"[Content could not be fetched]"` and `isContentFetched` to `false`. Otherwise set `isContentFetched` to `true`.
> 5. Extract the domain from the post URL (just the hostname, e.g. "example.com").
> 6. Write three summaries of the article at different lengths:
>    - `summaryS`: 1-3 sentence summary. If content wasn't fetchable, infer from the title + HN comments.
>    - `summaryM`: 3-10 sentence summary. If content wasn't fetchable, set to `"NA"`.
>    - `summaryL`: 10-30 sentence summary. If content wasn't fetchable, set to `"NA"`.
> 7. Write the result to `<WORKDIR>/posts/<POST_ID>.json` with these exact keys: `id`, `title`, `url`, `hn_url`, `domain`, `content`, `isContentFetched`, `summaryS`, `summaryM`, `summaryL`, `comments`. The `comments` array has objects with keys: `user`, `text`.
>
> Write ONLY valid JSON to the file — no markdown fences, no explanation.

Launch ALL agents in a single message (all Agent tool calls in parallel). Wait for all to complete.

After all agents finish, check which `post/<post_id>.json` files exist. If any are missing, resume the failed agent and tell it to write whatever data it has, using `"[Content could not be fetched]"` for missing fields.

## Step 3: Build the static HTML page

Read `hn/<YYYY-MM-DD>/home.json` for the post order. For each post in order, read `posts/<post_id>.json`. Generate `hn/<YYYY-MM-DD>/index.html` — a single-file static page styled like Hacker News.

### Design rules

- **Header:** Orange bar (#ff6600) with white "Y" logo (inline SVG), "Hacker News Digest" title, and today's date
- **Font:** Verdana 10pt, same as HN
- **Layout:** Numbered list, each post has:
  - Title link + (domain) in gray
  - "comments" link to the HN discussion
  - Summary line with expandable detail levels:
    - Show `summaryS` by default in 8pt gray
    - If `isContentFetched` is `false`, show a small red circle icon (●, `color:#cc0000`, `font-size:6pt`) right before the summary text to indicate the content couldn't be fetched
    - After the summary text, show clickable expand controls:
      - **[+]** toggles to `summaryM` (replaces the summary text in-place). If `summaryM` is `"NA"`, don't show this control.
      - **[++]** toggles to `summaryL` (replaces the summary text in-place). If `summaryL` is `"NA"`, don't show this control.
      - Clicking the already-active control collapses back to `summaryS`
    - Style controls as small gray inline links (`cursor:pointer`, `color:#888`, `font-size:7pt`, `margin-left:4px`). Highlight the active level in bold.
    - Implement with inline `onclick` handlers that swap the summary `<span>` text content — no external JS.
    - Store all three summary levels as `data-s`, `data-m`, `data-l` attributes on the summary container element.
  - Comments section: show the first 2 comments visible by default. If there are more than 2 comments, hide the rest behind a **[+N]** toggle (where N is the number of hidden comments). Clicking [+N] reveals all remaining comments; clicking [-] collapses them back. Style the toggle the same as the summary expand controls (`cursor:pointer`, `color:#888`, `font-size:7pt`).
  - Comments use green username (#3c963c) + condensed text in 7.5pt
- **Spacing:** Tight and information-dense, minimal padding — match HN density
- **Footer:** "Generated <date>"
- **Self-contained:** No external CSS/JS/fonts

### HTML structure per post

```html
<tr class="athing"><td class="rank">N.</td><td class="titleline"><a href="URL">Title</a> <span class="sitestr">(<a href="DOMAIN">domain</a>)</span></td></tr>
<tr><td colspan="2" class="subtext"><a href="HN_URL">comments</a></td></tr>
<tr><td colspan="2" class="summary" data-s="summaryS text" data-m="summaryM text" data-l="summaryL text">
  <!-- red dot only if isContentFetched is false -->
  <span class="unfetched">●</span>
  <span class="summary-text">summaryS text</span>
  <!-- omit [+] if summaryM is "NA", omit [++] if summaryL is "NA" -->
  <span class="expand" onclick="/* swap to data-m / back to data-s */">[+]</span>
  <span class="expand" onclick="/* swap to data-l / back to data-s */">[++]</span>
</td></tr>
<tr><td colspan="2"><div class="comments-preview">
  <!-- first 2 comments always visible -->
  <div class="comment-item"><span class="cuser">user1</span>: <span class="ctext">comment1</span></div>
  <div class="comment-item"><span class="cuser">user2</span>: <span class="ctext">comment2</span></div>
  <!-- remaining comments hidden by default -->
  <div class="comments-hidden" style="display:none">
    <div class="comment-item"><span class="cuser">user3</span>: <span class="ctext">comment3</span></div>
    ...
  </div>
  <!-- toggle shown only when >2 comments; [+N] to expand, [-] to collapse -->
  <span class="expand" onclick="/* toggle .comments-hidden display */">[+8]</span>
</div></td></tr>
```

After writing `hn/<YYYY-MM-DD>/index.html`, open it with `open hn/<YYYY-MM-DD>/index.html`.
