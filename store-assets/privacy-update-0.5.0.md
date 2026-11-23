# Hacker News Summary 0.5.0 — store privacy update

Open the item in the Developer Dashboard, then **Privacy** tab. Paste the fields
from [listing.md](listing.md) (they are already updated for 0.5.0).

What changed, and what to do in each field:

| Field | Change |
|---|---|
| Permission justification: `storage` | Use the new text in listing.md. The cache now lives here, and the key is read only by the background script. |
| Permission justification: `declarativeNetRequest` | **New field.** Text: "Used only to block requests from the extension's background script to local network addresses (for example 192.168.x.x or localhost), also after a redirect. It does not read or change any page." |
| Host permission justification | Use the new text in listing.md. Host access at install is only news.ycombinator.com and openrouter.ai. All sites are optional and asked on the welcome page. |
| Data disclosures | Same three types as 0.4.1 (Authentication, Web history, Website content). Only the "why" text changed (cache location). |
| Privacy policy URL | Same URL. Merge `PRIVACY.md` (updated 2026-11-14) to `main` before you submit. |
| Single purpose, remote code, certifications | No change. |

Store listing tab: use the new name, summary and description from
[description.md](description.md), and upload the new screenshots and tiles.
