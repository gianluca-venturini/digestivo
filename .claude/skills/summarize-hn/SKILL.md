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
  "summary": "1-3 sentence summary of the article. If content wasn't fetchable, infer from title + HN comments.",
  "comments": [
    { "user": "alice", "text": "First top-level comment, max 150 chars..." },
    { "user": "bob", "text": "Second top-level comment..." },
    { "user": "carol", "text": "Third top-level comment..." }
  ]
}
```

### Agent instructions template

Give each agent this prompt (filling in the post-specific values):

> You need to fetch two URLs and produce a single JSON file. Do NOT write code — use WebFetch directly.
>
> **Post:** "<TITLE>"
> **Post URL:** <URL>
> **HN Comments URL:** <COMMENT_URL>
>
> 1. WebFetch the HN comments URL. Extract the first 3 top-level comments with username and text (max 150 chars each, truncate with ...).
> 2. WebFetch the post URL. Extract the main article content.
> 3. Write a single sentence (max 2-3 sentences) summarizing the article. If the content couldn't be fetched, summarize based on the title and whatever you learned from the HN comments.
> 4. Extract the domain from the post URL (just the hostname, e.g. "example.com").
> 5. Write the result to `<WORKDIR>/posts/<POST_ID>.json` as a JSON object with these exact keys: id, title, url, hn_url, domain, summary, comments. The comments array has objects with keys: user, text.
>
> Write ONLY valid JSON to the file — no markdown fences, no explanation.

Launch ALL agents in a single message (all Agent tool calls in parallel). Wait for all to complete.

After all agents finish, check which `post/<post_id>.json` files exist. If any are missing, resume the failed agent and tell it to write whatever data it has, using `"[Content could not be fetched]"` for missing fields.

## Step 2b: Re-fetch blocked articles via Chrome

After all agents complete, find posts where the summary contains "[Content could not be fetched]" or similar failure markers. For these posts, re-fetch the article content using a visible Chrome browser:

```bash
tmpdir=$(mktemp -d)
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --user-data-dir="$tmpdir" --dump-dom --no-first-run --disable-gpu \
  --timeout=15000 "<URL>" 2>/dev/null > raw/<post_id>.html
```

Launch all Chrome fetches in parallel as background Bash commands. Once they complete, check file sizes — anything under 100 bytes is a failure (e.g. "Opening in existing browser session."). A `--user-data-dir` with a fresh temp dir is required to avoid attaching to an existing Chrome session.

For each successfully fetched HTML file (>100 bytes), use WebFetch or read the HTML directly to extract the article content, generate a summary, and update the corresponding `<post_id>.json` with the new summary (replacing the failure marker).

## Step 3: Build the static HTML page

Read `hn/<YYYY-MM-DD>/home.json` for the post order. For each post in order, read `posts/<post_id>.json`. Generate `hn/<YYYY-MM-DD>/index.html` — a single-file static page styled like Hacker News.

### Design rules

- **Header:** Orange bar (#ff6600) with white "Y" logo (inline SVG), "Hacker News Digest" title, and today's date
- **Font:** Verdana 10pt, same as HN
- **Layout:** Numbered list, each post has:
  - Title link + (domain) in gray
  - "comments" link to the HN discussion
  - 1-3 sentence summary in 8pt gray
  - Top 3 comments with green username (#3c963c) + condensed text in 7.5pt
- **Spacing:** Tight and information-dense, minimal padding — match HN density
- **Footer:** "Generated <date> by aggregator-playground"
- **Self-contained:** No external CSS/JS/fonts

### HTML structure per post

```html
<tr class="athing"><td class="rank">N.</td><td class="titleline"><a href="URL">Title</a> <span class="sitestr">(<a href="DOMAIN">domain</a>)</span></td></tr>
<tr><td colspan="2" class="subtext"><a href="HN_URL">comments</a></td></tr>
<tr><td colspan="2" class="summary">Summary text</td></tr>
<tr><td colspan="2"><div class="comments-preview">
  <div class="comment-item"><span class="cuser">user</span>: <span class="ctext">comment</span></div>
</div></td></tr>
```

After writing `hn/<YYYY-MM-DD>/index.html`, open it with `open hn/<YYYY-MM-DD>/index.html`.
