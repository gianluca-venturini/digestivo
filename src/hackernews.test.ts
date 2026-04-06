import { describe, it, expect } from "bun:test";
import { getPage, getComments, parsePosts } from "./hackernews.ts";

describe("hackernews", () => {
  describe("parsePosts", () => {
    it("extracts id, title, url, byUser, time from HTML", () => {
      const html = `
        <html><body><table>
          <tr class="athing submission" id="12345">
            <td class="title">
              <span class="titleline"><a href="https://example.com">Test Post</a></span>
            </td>
          </tr>
          <tr>
            <td class="subtext">
              <span class="subline">
                by <a class="hnuser" href="user?id=foo">foo</a>
                <span class="age" title="2026-01-01T00:00:00 1234567890"><a>1 hour ago</a></span>
              </span>
            </td>
          </tr>
        </table></body></html>
      `;
      const posts = parsePosts(html);
      expect(posts).toHaveLength(1);
      expect(posts[0]!.id).toBe("12345");
      expect(posts[0]!.title).toBe("Test Post");
      expect(posts[0]!.url).toBe("https://example.com");
      expect(posts[0]!.byUser).toBe("foo");
      expect(posts[0]!.time).toBe("2026-01-01T00:00:00");
    });

    it("sets upvoted=false by default", () => {
      const html = `
        <html><body><table>
          <tr class="athing submission" id="1"><td class="title">
            <span class="titleline"><a href="https://x.com">X</a></span>
          </td></tr>
          <tr><td class="subtext"><span class="subline">
            by <a class="hnuser">u</a>
            <span class="age" title="2026-01-01T00:00:00 0"><a>now</a></span>
          </span></td></tr>
        </table></body></html>
      `;
      expect(parsePosts(html)[0]!.upvoted).toBe(false);
    });

    it("sets upvoted=true when passed upvoted=true", () => {
      const html = `
        <html><body><table>
          <tr class="athing submission" id="1"><td class="title">
            <span class="titleline"><a href="https://x.com">X</a></span>
          </td></tr>
          <tr><td class="subtext"><span class="subline">
            by <a class="hnuser">u</a>
            <span class="age" title="2026-01-01T00:00:00 0"><a>now</a></span>
          </span></td></tr>
        </table></body></html>
      `;
      expect(parsePosts(html, true)[0]!.upvoted).toBe(true);
    });

    it("rewrites self-post URLs to full HN URL", () => {
      const html = `
        <html><body><table>
          <tr class="athing submission" id="99"><td class="title">
            <span class="titleline"><a href="item?id=99">Ask HN: something</a></span>
          </td></tr>
          <tr><td class="subtext"><span class="subline">
            by <a class="hnuser">u</a>
            <span class="age" title="2026-01-01T00:00:00 0"><a>now</a></span>
          </span></td></tr>
        </table></body></html>
      `;
      expect(parsePosts(html)[0]!.url).toBe(
        "https://news.ycombinator.com/item?id=99"
      );
    });

    it("returns empty array for HTML with no posts", () => {
      expect(parsePosts("<html><body></body></html>")).toHaveLength(0);
    });
  });

  describe("getPage", () => {
    it("returns posts from the front page and from a specific day", async () => {
      const front = await getPage(null, 1);
      expect(front.length).toBeGreaterThanOrEqual(25);
      const post = front[0]!;
      expect(post.id).toMatch(/^\d+$/);
      expect(post.title).toBeTruthy();
      expect(post.url).toMatch(/^https?:\/\//);
      expect(post.byUser).toBeTruthy();
      expect(post.time).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      await Bun.sleep(2000);

      const day = await getPage("2026-04-04", 1);
      expect(day.length).toBeGreaterThan(0);
      expect(day[0]!.id).toMatch(/^\d+$/);
    });
  });

  describe("getComments", () => {
    it("returns only top-level comments with id, postId, byUser, text", async () => {
      const postId = "47655392";
      const comments = await getComments(postId);
      expect(comments.length).toBeGreaterThan(0);
      const c = comments[0]!;
      expect(c.id).toMatch(/^\d+$/);
      expect(c.postId).toBe(postId);
      expect(c.byUser).toBeTruthy();
      expect(c.text).toBeTruthy();
    });
  });
});
