import { generateText } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";

export type CloneReport = {
  url: string;
  assets: {
    images: string[];
    svgs: string[];
    other: string[];
  };
  designSchema: {
    palette: Record<string, string>;
    typography: Record<string, any>;
    layout: Record<string, any>;
    components: string[];
  };
  notes: string[];
};

export async function generateCloneReport(
  model: string,
  input: {
    url: string;
    html: string;
    cssTexts: string[];
    jsTexts: string[];
    assetUrls: string[];
  }
): Promise<string> {
  const system = `You are a senior front-end engineer and UI systems expert. Analyze a scraped website snapshot to produce a JSON report capturing assets (images, SVGs, other), a concise design schema (palette, typography, layout, notable components), and implementation notes.

RESPONSE FORMAT: STRICT JSON ONLY, matching this TypeScript shape (keys only, extra keys not allowed):
{
  "url": "string",
  "assets": {
    "images": ["string"],
    "svgs": ["string"],
    "other": ["string"]
  },
  "designSchema": {
    "palette": { "primary": "#hex", "background": "#hex", "accent?": "#hex" },
    "typography": { "base": "font stack", "headings": {"h1": {"size": "", "weight": 0}} },
    "layout": { "breakpoints": {"sm": 640, "md": 768}, "grid": {"columns": 12, "gutter": 16} },
    "components": ["Header","Hero","Button","Card"]
  },
  "notes": ["short actionable implementation notes"]
}

RULES:
- Do not invent assets; use only provided URLs/content cues
- Infer palette from CSS vars and literal colors when possible
- Keep values concise and practical for implementation`;

  const prompt = `URL: ${input.url}
HTML_SNIPPET:
---
${input.html.slice(0, 20000)}
---

FIRST_CSS:
---
${(input.cssTexts[0] || "").slice(0, 15000)}
---

OTHER_CSS_COUNT: ${input.cssTexts.length}
JS_COUNT: ${input.jsTexts.length}
ASSET_URLS (top 50):
${input.assetUrls.slice(0, 50).join("\n")}

Produce the JSON now, matching the schema exactly.`;

  const resp = await generateText({ system, prompt, model: openrouter(model) });
  return resp.text || "";
}


