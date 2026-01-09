import path from "node:path";
import { URL } from "node:url";
import mime from "mime-types";
import * as cheerio from "cheerio";

export type ScrapedFile = { path: string; content: string };

export type ScrapeResult = {
  files: ScrapedFile[];
  reportInputs: {
    url: string;
    html: string;
    cssTexts: string[];
    jsTexts: string[];
    assetUrls: string[];
  };
};

function resolveUrl(baseUrl: string, resourceUrl: string): string {
  try {
    return new URL(resourceUrl, baseUrl).toString();
  } catch {
    return resourceUrl;
  }
}

function sanitizeAssetPath(u: string): string {
  try {
    const url = new URL(u);
    const pathname = url.pathname || "/asset";
    const base = pathname.split("/").filter(Boolean).join("/");
    const guessed = base || `asset-${Date.now()}`;
    const withDir = guessed.startsWith("assets/") ? guessed : `assets/${guessed}`;
    return withDir.replace(/\/+/, "/");
  } catch {
    const noQuery = u.split("?")[0].split("#")[0];
    const base = noQuery.replace(/^\/+/, "");
    const guessed = base || `assets/asset-${Date.now()}`;
    return guessed.replace(/\/+/, "/");
  }
}

function ensureExtension(assetPath: string, contentType?: string | false): string {
  const hasExt = path.extname(assetPath);
  if (hasExt) return assetPath;
  const ext = contentType ? mime.extension(contentType) : undefined;
  if (ext) return `${assetPath}.${ext}`;
  return assetPath;
}

async function fetchText(url: string): Promise<{ text: string; contentType: string | undefined }> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const contentType = res.headers.get("content-type") || undefined;
  const text = await res.text();
  return { text, contentType };
}

export async function scrapeWebsite(targetUrl: string): Promise<ScrapeResult> {
  const files: ScrapedFile[] = [];
  const cssTexts: string[] = [];
  const jsTexts: string[] = [];
  const assetUrls = new Set<string>();

  const { text: html, contentType } = await fetchText(targetUrl);
  if (!contentType || !contentType.includes("text/html")) {
    throw new Error("Provided URL does not appear to be an HTML page");
  }

  const $ = cheerio.load(html);

  // Collect stylesheets
  const stylesheetLinks = new Set<string>();
  $("link[rel='stylesheet']").each((_, el) => {
    const href = $(el).attr("href");
    if (href) stylesheetLinks.add(resolveUrl(targetUrl, href));
  });

  // Collect scripts
  const scriptLinks = new Set<string>();
  $("script[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (src) scriptLinks.add(resolveUrl(targetUrl, src));
  });

  // Collect images and other assets (keep as remote for v1)
  $("img[src], source[src], video[src], audio[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (src) assetUrls.add(resolveUrl(targetUrl, src));
  });
  // srcset (pick first candidate)
  $("img[srcset], source[srcset]").each((_, el) => {
    const srcset = $(el).attr("srcset");
    if (srcset) {
      const first = srcset.split(",")[0]?.trim().split(" ")[0];
      if (first) assetUrls.add(resolveUrl(targetUrl, first));
    }
  });

  // Inline styles
  $("style").each((_, el) => {
    const css = $(el).html() || "";
    if (css) cssTexts.push(css);
  });

  // Download external CSS and rewrite url() to remote absolute URLs (v1)
  for (const href of stylesheetLinks) {
    try {
      const { text: css } = await fetchText(href);
      cssTexts.push(css);
    } catch {}
  }

  // Inline scripts
  $("script:not([src])").each((_, el) => {
    const js = $(el).html() || "";
    if (js) jsTexts.push(js);
  });

  // Download external JS
  for (const src of scriptLinks) {
    try {
      const { text: js } = await fetchText(src);
      jsTexts.push(js);
    } catch {}
  }

  // Rewrite HTML to point to local files for CSS/JS, keep images remote in v1
  const htmlClone = cheerio.load(html);
  let cssIndex = 0;
  htmlClone("link[rel='stylesheet']").each((_, el) => {
    const filePath = `assets/style-${cssIndex++}.css`;
    htmlClone(el).attr("href", `./${filePath}`);
  });
  let jsIndex = 0;
  htmlClone("script[src]").each((_, el) => {
    const filePath = `assets/script-${jsIndex++}.js`;
    htmlClone(el).attr("src", `./${filePath}`);
  });
  // Ensure <base> does not break relative rewrites
  htmlClone("base").remove();

  const rewrittenHtml = htmlClone.html() || html;

  // Build files
  files.push({ path: "index.html", content: rewrittenHtml });
  cssTexts.forEach((css, i) => files.push({ path: `assets/style-${i}.css`, content: css }));
  jsTexts.forEach((js, i) => files.push({ path: `assets/script-${i}.js`, content: js }));

  return {
    files,
    reportInputs: {
      url: targetUrl,
      html,
      cssTexts,
      jsTexts,
      assetUrls: Array.from(assetUrls),
    },
  };
}


