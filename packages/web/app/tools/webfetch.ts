import { z } from "zod";
import { Tool } from "./tool";
import DESCRIPTION from "./webfetch.txt?raw";

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_TIMEOUT = 30 * 1000; // 30 seconds
const MAX_TIMEOUT = 120 * 1000; // 2 minutes

/**
 * Metadata returned by the webfetch tool
 */
interface WebFetchMetadata {
  /** The URL that was fetched */
  url: string;
  /** The content type of the response */
  contentType: string;
  /** The format the content was converted to */
  format: string;
  /** Whether the content was truncated */
  truncated: boolean;
}

/**
 * WebFetch tool for fetching content from URLs
 *
 * This tool fetches content from a specified URL and can convert it to
 * different formats (markdown, text, html). It runs in the browser environment
 * and is useful for retrieving and analyzing web content.
 */
export const WebFetchTool = Tool.define<
  z.ZodObject<{
    url: z.ZodString;
    format: z.ZodDefault<z.ZodEnum<["text", "markdown", "html"]>>;
    timeout: z.ZodOptional<z.ZodNumber>;
  }>,
  WebFetchMetadata
>("webfetch", {
  description: DESCRIPTION,
  parameters: z.object({
    url: z.string().describe("The URL to fetch content from"),
    format: z
      .enum(["text", "markdown", "html"])
      .default("markdown")
      .describe(
        "The format to return the content in (text, markdown, or html). Defaults to markdown."
      ),
    timeout: z.coerce
      .number()
      .describe("Optional timeout in seconds (max 120)")
      .optional(),
  }),

  async execute(params, ctx) {
    // Validate URL
    if (
      !params.url.startsWith("http://") &&
      !params.url.startsWith("https://")
    ) {
      throw new Error("URL must start with http:// or https://");
    }

    const timeout = Math.min(
      (params.timeout ?? DEFAULT_TIMEOUT / 1000) * 1000,
      MAX_TIMEOUT
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Build Accept header based on requested format with q parameters for fallbacks
    let acceptHeader = "*/*";
    switch (params.format) {
      case "markdown":
        acceptHeader =
          "text/markdown;q=1.0, text/x-markdown;q=0.9, text/plain;q=0.8, text/html;q=0.7, */*;q=0.1";
        break;
      case "text":
        acceptHeader =
          "text/plain;q=1.0, text/markdown;q=0.9, text/html;q=0.8, */*;q=0.1";
        break;
      case "html":
        acceptHeader =
          "text/html;q=1.0, application/xhtml+xml;q=0.9, text/plain;q=0.8, text/markdown;q=0.7, */*;q=0.1";
        break;
      default:
        acceptHeader =
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8";
    }

    // Combine abort signals if context has one
    const signals: AbortSignal[] = [controller.signal];
    if (ctx.abort) {
      signals.push(ctx.abort);
    }

    let response: Response;
    try {
      response = await fetch(params.url, {
        signal:
          signals.length > 1
            ? AbortSignal.any(signals)
            : controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: acceptHeader,
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(
          `Request timed out after ${timeout / 1000} seconds`
        );
      }
      throw new Error(`Failed to fetch URL: ${(error as Error).message}`);
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Request failed with status code: ${response.status}`);
    }

    // Check content length
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
      throw new Error("Response too large (exceeds 5MB limit)");
    }

    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await response.arrayBuffer();
    } catch (error) {
      throw new Error(`Failed to read response: ${(error as Error).message}`);
    }

    if (arrayBuffer.byteLength > MAX_RESPONSE_SIZE) {
      throw new Error("Response too large (exceeds 5MB limit)");
    }

    const content = new TextDecoder().decode(arrayBuffer);
    const contentType = response.headers.get("content-type") || "text/plain";
    const title = `${params.url} (${contentType})`;

    // Handle content based on requested format and actual content type
    let output: string;
    let truncated = false;

    switch (params.format) {
      case "markdown":
        if (contentType.includes("text/html")) {
          output = convertHTMLToMarkdown(content);
        } else {
          output = content;
        }
        break;

      case "text":
        if (contentType.includes("text/html")) {
          output = extractTextFromHTML(content);
        } else {
          output = content;
        }
        break;

      case "html":
      default:
        output = content;
        break;
    }

    // Check if we need to truncate
    const maxOutputLength = 100000; // 100KB of text
    if (output.length > maxOutputLength) {
      output = output.substring(0, maxOutputLength) + "\n\n(Content truncated)";
      truncated = true;
    }

    return {
      output,
      title,
      metadata: {
        url: params.url,
        contentType,
        format: params.format,
        truncated,
      },
    };
  },
});

/**
 * Extract plain text from HTML by removing tags and scripts
 */
function extractTextFromHTML(html: string): string {
  // Remove script and style elements
  let text = html.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    ""
  );
  text = text.replace(
    /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
    ""
  );
  text = text.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, "");
  
  // Replace common block elements with newlines
  text = text.replace(/<\/?(p|div|br|hr|h[1-6]|li|tr|td|th|blockquote)[^>]*>/gi, "\n");
  
  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");
  
  // Decode HTML entities
  text = decodeHTMLEntities(text);
  
  // Clean up whitespace
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n\s*\n/g, "\n\n");
  text = text.trim();
  
  return text;
}

/**
 * Convert HTML to Markdown
 */
function convertHTMLToMarkdown(html: string): string {
  // Remove script and style elements first
  let markdown = html.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    ""
  );
  markdown = markdown.replace(
    /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
    ""
  );

  // Convert headings
  markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n");
  markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n");
  markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n");
  markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, "#### $1\n\n");
  markdown = markdown.replace(/<h5[^>]*>(.*?)<\/h5>/gi, "##### $1\n\n");
  markdown = markdown.replace(/<h6[^>]*>(.*?)<\/h6>/gi, "###### $1\n\n");

  // Convert bold and italic
  markdown = markdown.replace(/<(strong|b)[^>]*>(.*?)<\/\1>/gi, "**$2**");
  markdown = markdown.replace(/<(em|i)[^>]*>(.*?)<\/\1>/gi, "*$2*");

  // Convert links
  markdown = markdown.replace(
    /<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi,
    "[$2]($1)"
  );

  // Convert images
  markdown = markdown.replace(
    /<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*\/?>/gi,
    "![$2]($1)"
  );
  markdown = markdown.replace(
    /<img[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']+)["'][^>]*\/?>/gi,
    "![$1]($2)"
  );
  markdown = markdown.replace(
    /<img[^>]*src=["']([^"']+)["'][^>]*\/?>/gi,
    "![]($1)"
  );

  // Convert code blocks
  markdown = markdown.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, "```\n$1\n```\n\n");
  markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`");

  // Convert lists
  markdown = markdown.replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n");
  markdown = markdown.replace(/<\/?[uo]l[^>]*>/gi, "\n");

  // Convert paragraphs and line breaks
  markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n");
  markdown = markdown.replace(/<br\s*\/?>/gi, "\n");
  markdown = markdown.replace(/<hr\s*\/?>/gi, "\n---\n");

  // Convert blockquotes
  markdown = markdown.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content) => {
    return content.split('\n').map((line: string) => `> ${line}`).join('\n') + '\n\n';
  });

  // Remove remaining HTML tags
  markdown = markdown.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  markdown = decodeHTMLEntities(markdown);

  // Clean up whitespace
  markdown = markdown.replace(/[ \t]+/g, " ");
  markdown = markdown.replace(/\n{3,}/g, "\n\n");
  markdown = markdown.trim();

  return markdown;
}

/**
 * Decode common HTML entities
 */
function decodeHTMLEntities(text: string): string {
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": "\"",
    "&#39;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
    "&copy;": "\u00A9",
    "&reg;": "\u00AE",
    "&trade;": "\u2122",
    "&mdash;": "\u2014",
    "&ndash;": "\u2013",
    "&hellip;": "\u2026",
    "&lsquo;": "\u2018",
    "&rsquo;": "\u2019",
    "&ldquo;": "\u201C",
    "&rdquo;": "\u201D",
    "&bull;": "\u2022",
  };

  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, "g"), char);
  }

  // Handle numeric entities
  decoded = decoded.replace(/&#(\d+);/g, (_, num) =>
    String.fromCharCode(parseInt(num, 10))
  );
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );

  return decoded;
}

export default WebFetchTool;
