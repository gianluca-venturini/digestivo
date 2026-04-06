import { parseHTML } from "linkedom";
import type { Post, Comment } from "./types.ts";

const BASE = "https://news.ycombinator.com";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
};

async function fetchHtml(url: string, cookie?: string): Promise<string> {
  const headers: Record<string, string> = { ...HEADERS };
  if (cookie) headers["Cookie"] = cookie;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

export function parsePosts(html: string, upvoted = false): Post[] {
  const { document } = parseHTML(html);
  const rows = document.querySelectorAll("tr.athing.submission");
  const posts: Post[] = [];

  for (const row of rows) {
    const id = row.getAttribute("id");
    if (!id) continue;

    // Title and URL
    const titleAnchor = row.querySelector(".titleline > a");
    if (!titleAnchor) continue;
    const title = titleAnchor.textContent?.trim() ?? "";
    let url = titleAnchor.getAttribute("href") ?? "";

    // Self-posts (Ask HN, Tell HN, etc.) have relative hrefs
    if (url.startsWith("item?id=")) {
      url = `${BASE}/${url}`;
    }

    // Subtext row is the next sibling <tr>
    const subRow = row.nextElementSibling;
    const byUser =
      subRow?.querySelector("a.hnuser")?.textContent?.trim() ?? "";

    // Timestamp: title attr is "2026-04-05T18:45:53 1775414753"
    const ageTitle =
      subRow?.querySelector(".age")?.getAttribute("title") ?? "";
    const time = ageTitle.split(" ")[0] ?? "";

    posts.push({
      id,
      title,
      url,
      byUser,
      time,
      article: null,
      domain: null,
      upvoted,
      titleEmbedding: null,
      articleEmbedding: null,
    });
  }

  return posts;
}

function hasMoreLink(html: string): boolean {
  const { document } = parseHTML(html);
  return !!document.querySelector("a.morelink");
}

export async function getPage(
  day: string | null,
  pageNumber: number
): Promise<Post[]> {
  const url =
    day === null
      ? `${BASE}/news?p=${pageNumber}`
      : `${BASE}/front?day=${day}&p=${pageNumber}`;
  const html = await fetchHtml(url);
  return parsePosts(html, false);
}

export async function getUpvoted(
  user: string,
  cookie: string
): Promise<Post[]> {
  const all: Post[] = [];
  let page = 1;

  while (true) {
    const url = `${BASE}/upvoted?id=${user}&p=${page}`;
    const html = await fetchHtml(url, cookie);
    const posts = parsePosts(html, true);
    all.push(...posts);

    if (!hasMoreLink(html) || posts.length === 0) break;
    page++;
  }

  return all;
}

export async function getComments(postId: string): Promise<Comment[]> {
  const html = await fetchHtml(`${BASE}/item?id=${postId}`);
  const { document } = parseHTML(html);
  const rows = document.querySelectorAll("tr.athing.comtr");
  const comments: Comment[] = [];

  for (const row of rows) {
    // Only top-level comments
    const indent = row.querySelector("td.ind")?.getAttribute("indent");
    if (indent !== "0") continue;

    const id = row.getAttribute("id");
    if (!id) continue;

    const byUser =
      row.querySelector(".comhead a.hnuser")?.textContent?.trim() ?? "";

    // Strip HTML from comment text
    const commtext = row.querySelector(".commtext");
    const text = commtext?.textContent?.trim() ?? "";

    if (!text) continue;

    comments.push({ id, postId, byUser, text });
  }

  return comments;
}
