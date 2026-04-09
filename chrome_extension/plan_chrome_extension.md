# Chrome Extension Plan: HN Post Summarizer

## Goal

Inject a **(+)** button next to every post on `https://news.ycombinator.com/`. Clicking it calls the local API (`localhost:3001/post/:id`), fetches the post, and displays `articleSummaryS` inline below the post title.

---

## File Structure

```
chrome_extension/
├── manifest.json        # Extension manifest (MV3)
├── content.js           # Content script injected into HN pages
└── style.css            # Styles for the (+) button and summary panel
```

---

## manifest.json

- **Manifest version:** 3
- **Permissions:** `["activeTab"]`
- **Host permissions:** `["https://news.ycombinator.com/*", "http://localhost:3001/*"]`
  - `localhost` needs to be listed here so the content script can fetch it
- **Content scripts:**
  - `matches`: `["https://news.ycombinator.com/*"]`
  - `js`: `["content.js"]`
  - `css`: `["style.css"]`
  - `run_at`: `document_idle`

---

## content.js

### DOM targeting

HN post rows follow this structure:

```
<tr class="athing submission" id="POST_ID">
  <td class="title">
    <span class="titleline">
      <a href="...">Post Title</a>   ← title anchor
    </span>
  </td>
</tr>
<tr>                                 ← subtext row (score, user, comments)
  <td class="subtext">...</td>
</tr>
```

### Steps

1. **On `DOMContentLoaded`**, query all `tr.athing.submission` rows.
2. For each row:
   - Read the post `id` from `row.id`
   - Find the `.titleline` span inside that row
   - Append a `<button class="hn-summarize-btn">(+)</button>` after the title anchor
   - Attach a `click` handler to the button
3. **On button click:**
   - Disable the button and change its label to `(…)` to indicate loading
   - `POST` to `http://localhost:3001/post/${id}` (no body needed)
   - On success:
     - Parse the JSON response, extract `articleSummaryS`
     - Find (or create) a `<div class="hn-summary">` in the subtext row immediately following the post row (`row.nextElementSibling`)
     - Set its `textContent` to the summary
     - Change button label to `(−)` to allow toggling
   - On error (API unreachable, post has no summary):
     - Show a short inline error message (e.g. `"no summary available"`)
     - Re-enable the button with label `(!)`
4. **Toggle:** If the summary div is already visible, clicking `(−)` hides it and reverts the button to `(+)`.

---

## style.css

- `.hn-summarize-btn` — small, unobtrusive button; inherits HN font size; subtle border; cursor pointer; margin-left: 6px
- `.hn-summary` — italic, muted color (`#666`), font-size slightly smaller than body, padding: 2px 0 4px 0, displayed as block inside the subtext row

---

## API contract

The content script calls:

```
POST http://localhost:3001/post/:id
```

Response (JSON `Post` object):

```json
{
  "id": "43636972",
  "title": "...",
  "articleSummaryS": "One to three sentence summary.",
  "articleSummaryL": "...",
  "url": "...",
  ...
}
```

The content script only uses `articleSummaryS`. If it is `null` (article could not be fetched or summarized), display a fallback message.

---

## Loading the extension (development)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `chrome_extension/` directory
4. Navigate to `https://news.ycombinator.com/` — the **(+)** buttons should appear

---

## Constraints and notes

- The API runs locally; the user must have `bun src/api.ts` running for the extension to work.
- Chrome blocks `http://localhost` from `https://` pages by default. Since HN is HTTPS, the extension requires the host permission `http://localhost:3001/*` in the manifest — Chrome MV3 allows this explicitly declared host permission to bypass mixed-content restrictions in content scripts (unlike page-level `fetch`).
- No build step needed — plain JS and CSS, no bundler required.
