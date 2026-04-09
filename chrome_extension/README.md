# HN Post Summarizer — Chrome Extension

Adds a **(+)** button next to every post on Hacker News. Click it to fetch an AI-generated summary inline, powered by a local API.

## Prerequisites

- The local API must be running before the extension can fetch summaries.
- From the repo root:

```bash
bun src/api.ts
```

The API listens on `http://localhost:3001` by default. Set `PORT=` to override.

## Sideloading the extension

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** using the toggle in the top-right corner
3. Click **Load unpacked**
4. Select the `chrome_extension/` directory from this repo
5. The extension appears in the list as **HN Post Summarizer**

## Usage

1. Visit `https://news.ycombinator.com/`
2. Each post has a **(+)** button to the right of its title
3. Click **(+)** to fetch and display the summary below the post
4. Click **(−)** to hide it again

## Button states

| Label | Meaning |
|-------|---------|
| `(+)` | Summary not yet loaded — click to fetch |
| `(…)` | Fetching in progress |
| `(−)` | Summary visible — click to hide |
| `(!)` | Error — API unreachable or summary unavailable |

## Updating the extension

After changing any source file, go to `chrome://extensions` and click the **reload** icon on the extension card, then refresh the HN page.
