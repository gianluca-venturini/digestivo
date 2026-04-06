import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
};

async function fetchWithReadability(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS });
    if (!res.ok) {
      console.warn(`[fetchWithReadability] plain fetch failed for ${url}: HTTP ${res.status}`);
      return null;
    }

    const html = await res.text();
    const { document } = parseHTML(html);
    const article = new Readability(document as unknown as Document).parse();
    const text = article?.textContent?.trim() ?? "";
    if (text.length === 0) {
      console.warn(`[fetchWithReadability] Readability extracted no text from ${url}`);
      return null;
    }
    return text;
  } catch (err) {
    console.warn(`[fetchWithReadability] plain fetch threw for ${url}:`, err);
    return null;
  }
}

async function fetchWithJina(url: string): Promise<string | null> {
  const apiKey = process.env["JINA_API_KEY"];
  try {
    const headers: Record<string, string> = { "x-respond-with": "text" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const res = await fetch(`https://r.jina.ai/${url}`, { headers });
    if (!res.ok) {
      console.warn(`[fetchWithJina] failed for ${url}: HTTP ${res.status}`);
      return null;
    }

    const text = (await res.text()).trim();
    if (text.length === 0) {
      console.warn(`[fetchWithJina] returned empty body for ${url}`);
      return null;
    }
    return text;
  } catch (err) {
    console.warn(`[fetchWithJina] threw for ${url}:`, err);
    return null;
  }
}

export async function fetchSafe(url: string): Promise<string | null> {
  return (await fetchWithReadability(url)) ?? (await fetchWithJina(url));
}
