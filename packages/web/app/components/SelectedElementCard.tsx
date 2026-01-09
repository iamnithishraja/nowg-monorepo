import { useMemo, useEffect, useState, useCallback } from "react";
import {
  parseTailwindClasses,
  summarizeAttributes,
} from "../lib/inspectorParser";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";

interface SelectedElementCardProps {
  info: any;
}

export default function SelectedElementCard({
  info,
}: SelectedElementCardProps) {
  const classList: string[] = Array.isArray(info?.classList)
    ? info.classList
    : String(info?.className || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
  const parsed = useMemo(
    () => parseTailwindClasses(classList),
    [classList.join(" ")]
  );
  const attrSummary = useMemo(
    () => summarizeAttributes(info?.attributes, info?.tagName),
    [info?.attributes, info?.tagName]
  );
  const computed = info?.styles || {};

  // --- Typography local state (preview-only, applied as inline styles in iframe) ---
  const [fontSize, setFontSize] = useState<string>("");
  const [fontWeight, setFontWeight] = useState<string>("");
  const [lineHeight, setLineHeight] = useState<string>("");
  const [letterSpacing, setLetterSpacing] = useState<string>("");
  const [textAlign, setTextAlign] = useState<string>("");
  const [fontStyle, setFontStyle] = useState<"normal" | "italic">("normal");
  const [textDecoration, setTextDecoration] = useState<string>("");
  const [color, setColor] = useState<string>("");
  const [backgroundColor, setBackgroundColor] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [attrValues, setAttrValues] = useState<Record<string, string>>({});
  // --- Sizing ---
  const [width, setWidth] = useState<string>("");
  const [height, setHeight] = useState<string>("");
  // --- Spacing: Padding ---
  const [paddingTop, setPaddingTop] = useState<string>("");
  const [paddingRight, setPaddingRight] = useState<string>("");
  const [paddingBottom, setPaddingBottom] = useState<string>("");
  const [paddingLeft, setPaddingLeft] = useState<string>("");
  // --- Spacing: Margin ---
  const [marginTop, setMarginTop] = useState<string>("");
  const [marginRight, setMarginRight] = useState<string>("");
  const [marginBottom, setMarginBottom] = useState<string>("");
  const [marginLeft, setMarginLeft] = useState<string>("");

  // Convert rgb/rgba colors to hex for color input if possible
  const rgbToHex = (rgb: string | undefined): string | "" => {
    if (!rgb) return "";
    const m = rgb
      .trim()
      .match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d\.]+)?\)$/i);
    if (!m) return "";
    const r = Math.max(0, Math.min(255, parseInt(m[1], 10)));
    const g = Math.max(0, Math.min(255, parseInt(m[2], 10)));
    const b = Math.max(0, Math.min(255, parseInt(m[3], 10)));
    const toHex = (n: number) => n.toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  // Initialize on selection change only (avoid resetting while typing)
  useEffect(() => {
    const initialFontSize =
      parsed.typography.fontSize || computed["font-size"] || "";
    const initialFontWeight =
      parsed.typography.fontWeight || computed["font-weight"] || "";
    const initialLineHeight =
      parsed.typography.lineHeight || computed["line-height"] || "";
    const initialLetterSpacing =
      parsed.typography.letterSpacing || computed["letter-spacing"] || "";
    const initialTextAlign = computed["text-align"] || "";
    const initialFontStyle = (computed["font-style"] || "normal") as
      | "normal"
      | "italic";
    const initialTextDecoration = computed["text-decoration"] || "";
    const initialColor = rgbToHex(computed["color"]) || "";
    let initialBg = rgbToHex(computed["background-color"]) || "";
    if (!initialBg) {
      const tokenBg = parsed.colors.backgroundColor;
      if (tokenBg) {
        if (tokenBg.startsWith("#")) {
          initialBg = tokenBg;
        } else if (/^rgba?\(/i.test(tokenBg)) {
          initialBg = rgbToHex(tokenBg) || "";
        }
      }
    }
    const initialContent = String(info?.textContent || "");
    const initialAttrs: Record<string, string> =
      info?.attributes && typeof info.attributes === "object"
        ? { ...info.attributes }
        : {};
    // Sizing
    const initialWidth = parsed.sizing.width || computed["width"] || "";
    const initialHeight = parsed.sizing.height || computed["height"] || "";
    // Padding (prefer parsed tailwind tokens, fallback to computed)
    const initialPt =
      parsed.spacing.padding?.top || computed["padding-top"] || "";
    const initialPr =
      parsed.spacing.padding?.right || computed["padding-right"] || "";
    const initialPb =
      parsed.spacing.padding?.bottom || computed["padding-bottom"] || "";
    const initialPl =
      parsed.spacing.padding?.left || computed["padding-left"] || "";
    // Margin
    const initialMt =
      parsed.spacing.margin?.top || computed["margin-top"] || "";
    const initialMr =
      parsed.spacing.margin?.right || computed["margin-right"] || "";
    const initialMb =
      parsed.spacing.margin?.bottom || computed["margin-bottom"] || "";
    const initialMl =
      parsed.spacing.margin?.left || computed["margin-left"] || "";

    setFontSize(initialFontSize);
    setFontWeight(initialFontWeight);
    setLineHeight(initialLineHeight);
    setLetterSpacing(initialLetterSpacing);
    setTextAlign(initialTextAlign);
    setFontStyle(initialFontStyle);
    setTextDecoration(initialTextDecoration);
    setColor(initialColor);
    setBackgroundColor(initialBg);
    setContent(initialContent);
    setAttrValues(initialAttrs);
    // Sizing
    setWidth(initialWidth);
    setHeight(initialHeight);
    // Padding
    setPaddingTop(initialPt);
    setPaddingRight(initialPr);
    setPaddingBottom(initialPb);
    setPaddingLeft(initialPl);
    // Margin
    setMarginTop(initialMt);
    setMarginRight(initialMr);
    setMarginBottom(initialMb);
    setMarginLeft(initialMl);
  }, [info?.uid, info?.selector, info?.elementPath]);

  const sendStyleUpdate = useCallback(
    (partial: Record<string, string>) => {
      try {
        const payload = {
          selector: info?.selector,
          elementPath: info?.elementPath,
          uid: info?.uid,
          styles: partial,
        };
        window.postMessage({ type: "HOST_APPLY_INLINE_STYLES", payload }, "*");
      } catch {}
    },
    [info?.selector, info?.elementPath]
  );

  const handleChange = (key: string, value: string) => {
    // Update local state and propagate
    switch (key) {
      case "fontSize":
        setFontSize(value);
        break;
      case "fontWeight":
        setFontWeight(value);
        break;
      case "lineHeight":
        setLineHeight(value);
        break;
      case "letterSpacing":
        setLetterSpacing(value);
        break;
      case "textAlign":
        setTextAlign(value);
        break;
      case "fontStyle":
        setFontStyle((value as any) || "normal");
        break;
      case "textDecoration":
        setTextDecoration(value);
        break;
      case "color":
        setColor(value);
        break;
      case "backgroundColor":
        setBackgroundColor(value);
        break;
      case "width":
        setWidth(value);
        break;
      case "height":
        setHeight(value);
        break;
      case "padding-top":
        setPaddingTop(value);
        break;
      case "padding-right":
        setPaddingRight(value);
        break;
      case "padding-bottom":
        setPaddingBottom(value);
        break;
      case "padding-left":
        setPaddingLeft(value);
        break;
      case "margin-top":
        setMarginTop(value);
        break;
      case "margin-right":
        setMarginRight(value);
        break;
      case "margin-bottom":
        setMarginBottom(value);
        break;
      case "margin-left":
        setMarginLeft(value);
        break;
    }
    sendStyleUpdate({ [key]: value });
  };

  const canEditContent = useMemo(() => {
    const t = String(info?.tagName || "").toLowerCase();
    const allowed = [
      "p",
      "span",
      "div",
      "button",
      "a",
      "label",
      "li",
      "strong",
      "em",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "small",
    ];
    return allowed.includes(t);
  }, [info?.tagName]);

  const sendContentUpdate = useCallback(
    (next: string) => {
      try {
        const payload = {
          selector: info?.selector,
          elementPath: info?.elementPath,
          uid: info?.uid,
          content: next,
        };
        window.postMessage({ type: "HOST_APPLY_TEXT_CONTENT", payload }, "*");
      } catch {}
    },
    [info?.selector, info?.elementPath]
  );

  const sendAttributeUpdate = useCallback(
    (name: string, value: string) => {
      try {
        const payload = {
          selector: info?.selector,
          elementPath: info?.elementPath,
          uid: info?.uid,
          name,
          value,
        };
        window.postMessage({ type: "HOST_SET_ATTRIBUTE", payload }, "*");
      } catch {}
    },
    [info?.selector, info?.elementPath]
  );

  return (
    <div className="w-full text-foreground p-3 md:p-4">

      {/* Accordion Sections */}
      <div className="space-y-4">
        <Accordion
          type="multiple"
          className="w-full"
          collapsible
          defaultValue={[
            ...(canEditContent ? ["content"] : []),
            "typography",
            "size",
            "spacing",
            "attributes",
          ]}
        >
          {/* Content Section */}
          {canEditContent && (
            <AccordionItem
              value="content"
              className="border-b border-border/30 rounded-none bg-transparent"
            >
              <AccordionTrigger className="px-0 py-2 hover:no-underline">
                <div className="flex items-center gap-2 text-left w-full">
                  <div className="w-2 h-2 rounded-full bg-gradient-to-r from-primary/60 to-accent/60 animate-pulse"></div>
                  <span className="text-xs font-bold text-foreground/90 uppercase tracking-wider">
                    Content
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pt-2">
                  <textarea
                    className="w-full px-3 py-2 text-sm rounded-md border border-border/50 bg-background/80 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all duration-200 min-h-24 font-mono resize-none"
                    value={content}
                    onChange={(e) => {
                      const v = e.target.value;
                      setContent(v);
                      sendContentUpdate(v);
                    }}
                    placeholder="Edit text inside the element..."
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Typography Section */}
          <AccordionItem
            value="typography"
            className="border-b border-border/30 rounded-none bg-transparent"
          >
            <AccordionTrigger className="px-0 py-2 hover:no-underline">
              <div className="flex items-center gap-2 text-left w-full">
                <div className="w-2 h-2 rounded-full bg-gradient-to-r from-blue/60 to-cyan/60 animate-pulse"></div>
                <span className="text-xs font-bold text-foreground/90 uppercase tracking-wider">
                  Typography
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="px-1 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {/* Font Size */}
                  <div className="col-span-1 space-y-1.5">
                    <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue/50"></div>
                      Font Size
                    </label>
                    <div className="relative">
                      <input
                        className="w-full px-3 py-2.5 text-sm rounded-lg border border-border/60 bg-background/90 focus:border-blue/50 focus:ring-2 focus:ring-blue/20 focus:ring-offset-0 focus:ring-offset-background/50 transition-all duration-300 font-mono shadow-inner hover:shadow-md hover:shadow-blue/10"
                        value={fontSize}
                        placeholder="e.g. 16px or 1rem"
                        onChange={(e) =>
                          handleChange("fontSize", e.target.value)
                        }
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60 font-mono">
                        px
                      </div>
                    </div>
                  </div>
                  {/* Font Weight */}
                  <div className="col-span-1 space-y-1.5">
                    <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple/50"></div>
                      Weight
                    </label>
                    <select
                      className="w-full px-3 py-2.5 text-sm rounded-lg border border-border/60 bg-background/90 focus:border-purple/50 focus:ring-2 focus:ring-purple/20 focus:ring-offset-0 focus:ring-offset-background/50 transition-all duration-300 shadow-inner hover:shadow-md hover:shadow-purple/10 appearance-none cursor-pointer"
                      value={fontWeight}
                      onChange={(e) =>
                        handleChange("fontWeight", e.target.value)
                      }
                    >
                      <option value="">Default</option>
                      <option value="100">100</option>
                      <option value="200">200</option>
                      <option value="300">300</option>
                      <option value="400">400 (Normal)</option>
                      <option value="500">500</option>
                      <option value="600">600</option>
                      <option value="700">700 (Bold)</option>
                      <option value="800">800</option>
                      <option value="900">900</option>
                      <option value="normal">normal</option>
                      <option value="bold">bold</option>
                      <option value="bolder">bolder</option>
                      <option value="lighter">lighter</option>
                    </select>
                  </div>
                  {/* Line Height */}
                  <div className="col-span-1 space-y-1.5">
                    <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green/50"></div>
                      Line Height
                    </label>
                    <input
                      className="w-full px-3 py-2.5 text-sm rounded-lg border border-border/60 bg-background/90 focus:border-green/50 focus:ring-2 focus:ring-green/20 focus:ring-offset-0 focus:ring-offset-background/50 transition-all duration-300 font-mono shadow-inner hover:shadow-md hover:shadow-green/10"
                      value={lineHeight}
                      placeholder="e.g. 1.5 or 24px"
                      onChange={(e) =>
                        handleChange("lineHeight", e.target.value)
                      }
                    />
                  </div>
                  {/* Letter Spacing */}
                  <div className="col-span-1 space-y-1.5">
                    <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange/50"></div>
                      Letter Spacing
                    </label>
                    <input
                      className="w-full px-3 py-2.5 text-sm rounded-lg border border-border/60 bg-background/90 focus:border-orange/50 focus:ring-2 focus:ring-orange/20 focus:ring-offset-0 focus:ring-offset-background/50 transition-all duration-300 font-mono shadow-inner hover:shadow-md hover:shadow-orange/10"
                      value={letterSpacing}
                      placeholder="e.g. 0.02em"
                      onChange={(e) =>
                        handleChange("letterSpacing", e.target.value)
                      }
                    />
                  </div>
                  {/* Alignment */}
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-pink/50"></div>
                      Alignment
                    </label>
                    <div className="inline-flex gap-1">
                      {(["left", "center", "right", "justify"] as const).map(
                        (pos) => (
                          <button
                            key={pos}
                            type="button"
                            className={`px-4 py-2 text-xs font-bold rounded-md border transition-all duration-300 hover:scale-105 ${
                              textAlign === pos
                                ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground border-primary/50 shadow-lg shadow-primary/25"
                                : "bg-background/80 border-border/40 text-foreground/70 hover:bg-background hover:border-primary/30 hover:text-foreground hover:shadow-md"
                            }`}
                            onClick={() => handleChange("textAlign", pos)}
                          >
                            {pos}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                  {/* Decoration & Style */}
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo/50"></div>
                      Decoration
                    </label>
                    <div className="inline-flex gap-1">
                      <button
                        type="button"
                        className={`px-3 py-2 text-xs font-bold rounded-md border transition-all duration-300 hover:scale-105 ${
                          fontStyle === "italic"
                            ? "bg-gradient-to-r from-indigo to-indigo/90 text-indigo-foreground border-indigo/50 shadow-lg shadow-indigo/25"
                            : "bg-background/80 border-border/40 text-foreground/70 hover:bg-background hover:border-indigo/30 hover:text-foreground hover:shadow-md"
                        }`}
                        onClick={() =>
                          handleChange(
                            "fontStyle",
                            fontStyle === "italic" ? "normal" : "italic"
                          )
                        }
                        style={{ fontStyle: "italic" }}
                      >
                        italic
                      </button>
                      {(["underline", "line-through", "overline"] as const).map(
                        (dec) => {
                          const active = textDecoration.includes(dec);
                          const next = active
                            ? textDecoration
                                .split(" ")
                                .filter(Boolean)
                                .filter((d) => d !== dec)
                                .join(" ") || "none"
                            : (textDecoration === "none"
                                ? dec
                                : `${textDecoration} ${dec}`
                              ).trim();
                          return (
                            <button
                              key={dec}
                              type="button"
                              className={`px-3 py-2 text-xs font-bold rounded-md border transition-all duration-300 hover:scale-105 ${
                                active
                                  ? "bg-gradient-to-r from-indigo to-indigo/90 text-indigo-foreground border-indigo/50 shadow-lg shadow-indigo/25"
                                  : "bg-background/80 border-border/40 text-foreground/70 hover:bg-background hover:border-indigo/30 hover:text-foreground hover:shadow-md"
                              }`}
                              onClick={() =>
                                handleChange("textDecoration", next)
                              }
                              style={{ textDecoration: dec }}
                            >
                              {dec}
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>
                  {/* Color Controls */}
                  <div className="col-span-2 grid grid-cols-2 gap-4">
                    {/* Text Color */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-red/50"></div>
                        Text Color
                      </label>
                      <div className="flex items-center gap-3">
                        <div className="relative group">
                          <input
                            type="color"
                            className="w-12 h-12 rounded-xl border-2 border-border/40 bg-background/80 cursor-pointer transition-all duration-300 hover:scale-110 hover:border-red/50 hover:shadow-lg hover:shadow-red/25"
                            value={color || "#000000"}
                            onChange={(e) =>
                              handleChange("color", e.target.value)
                            }
                          />
                          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-red/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                        </div>
                        <div className="flex-1 relative">
                          <input
                            className="w-full px-4 py-3 text-sm rounded-lg border border-border/60 bg-background/90 focus:border-red/50 focus:ring-2 focus:ring-red/20 focus:ring-offset-0 focus:ring-offset-background/50 transition-all duration-300 font-mono shadow-inner hover:shadow-md hover:shadow-red/10"
                            placeholder="#000000 or rgb(0,0,0)"
                            value={color}
                            onChange={(e) =>
                              handleChange("color", e.target.value)
                            }
                          />
                          <div
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md border-2 border-border/40 shadow-sm"
                            style={{ backgroundColor: color || "#000000" }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    {/* Background Color */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue/50"></div>
                        Background Color
                      </label>
                      <div className="flex items-center gap-3">
                        <div className="relative group">
                          <input
                            type="color"
                            className="w-12 h-12 rounded-xl border-2 border-border/40 bg-background/80 cursor-pointer transition-all duration-300 hover:scale-110 hover:border-blue/50 hover:shadow-lg hover:shadow-blue/25"
                            value={backgroundColor || "#ffffff"}
                            onChange={(e) =>
                              handleChange("backgroundColor", e.target.value)
                            }
                          />
                          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                        </div>
                        <div className="flex-1 relative">
                          <input
                            className="w-full px-4 py-3 text-sm rounded-lg border border-border/60 bg-background/90 focus:border-blue/50 focus:ring-2 focus:ring-blue/20 focus:ring-offset-0 focus:ring-offset-background/50 transition-all duration-300 font-mono shadow-inner hover:shadow-md hover:shadow-blue/10"
                            placeholder="#ffffff or rgb(255,255,255)"
                            value={backgroundColor}
                            onChange={(e) =>
                              handleChange("backgroundColor", e.target.value)
                            }
                          />
                          <div
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md border-2 border-border/40 shadow-sm"
                            style={{
                              backgroundColor: backgroundColor || "#ffffff",
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Size Section */}
          <AccordionItem
            value="size"
            className="border-b border-border/30 rounded-none bg-transparent"
          >
            <AccordionTrigger className="px-0 py-2 hover:no-underline">
              <div className="flex items-center gap-2 text-left w-full">
                <div className="w-2 h-2 rounded-full bg-gradient-to-r from-emerald/60 to-teal/60 animate-pulse"></div>
                <span className="text-xs font-bold text-foreground/90 uppercase tracking-wider">
                  Size
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="px-1">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="col-span-1 space-y-1.5">
                    <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald/50"></div>
                      Width
                    </label>
                    <div className="relative">
                      <input
                        className="w-full px-3 py-2.5 text-sm rounded-lg border border-border/60 bg-background/90 focus:border-emerald/50 focus:ring-2 focus:ring-emerald/20 focus:ring-offset-0 focus:ring-offset-background/50 transition-all duration-300 font-mono shadow-inner hover:shadow-md hover:shadow-emerald/10"
                        value={width}
                        placeholder="e.g. 100%, 200px, 20rem"
                        onChange={(e) => handleChange("width", e.target.value)}
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60 font-mono">
                        w
                      </div>
                    </div>
                  </div>
                  <div className="col-span-1 space-y-1.5">
                    <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-teal/50"></div>
                      Height
                    </label>
                    <div className="relative">
                      <input
                        className="w-full px-3 py-2.5 text-sm rounded-lg border border-border/60 bg-background/90 focus:border-teal/50 focus:ring-2 focus:ring-teal/20 focus:ring-offset-0 focus:ring-offset-background/50 transition-all duration-300 font-mono shadow-inner hover:shadow-md hover:shadow-teal/10"
                        value={height}
                        placeholder="e.g. auto, 200px, 50vh"
                        onChange={(e) => handleChange("height", e.target.value)}
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60 font-mono">
                        h
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Spacing Section */}
          <AccordionItem
            value="spacing"
            className="border-b border-border/30 rounded-none bg-transparent"
          >
            <AccordionTrigger className="px-0 py-2 hover:no-underline">
              <div className="flex items-center gap-2 text-left w-full">
                <div className="w-2 h-2 rounded-full bg-gradient-to-r from-amber/60 to-yellow/60 animate-pulse"></div>
                <span className="text-xs font-bold text-foreground/90 uppercase tracking-wider">
                  Spacing
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="px-1 space-y-6">
                {/* Margin */}
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-foreground/80 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber/50"></div>
                    Margin
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      {
                        label: "Top",
                        value: marginTop,
                        onChange: (v: string) => handleChange("margin-top", v),
                      },
                      {
                        label: "Right",
                        value: marginRight,
                        onChange: (v: string) =>
                          handleChange("margin-right", v),
                      },
                      {
                        label: "Bottom",
                        value: marginBottom,
                        onChange: (v: string) =>
                          handleChange("margin-bottom", v),
                      },
                      {
                        label: "Left",
                        value: marginLeft,
                        onChange: (v: string) => handleChange("margin-left", v),
                      },
                    ].map((item) => (
                      <div key={item.label} className="space-y-1">
                        <label className="text-xs font-medium text-foreground/70">
                          {item.label}
                        </label>
                        <input
                          className="w-full px-2 py-2 text-xs rounded-lg border border-border/60 bg-background/90 focus:border-amber/50 focus:ring-2 focus:ring-amber/20 focus:ring-offset-0 focus:ring-offset-background/50 transition-all duration-300 font-mono shadow-inner hover:shadow-md hover:shadow-amber/10"
                          value={item.value}
                          placeholder="1rem"
                          onChange={(e) => item.onChange(e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Padding */}
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-foreground/80 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-yellow/50"></div>
                    Padding
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      {
                        label: "Top",
                        value: paddingTop,
                        onChange: (v: string) => handleChange("padding-top", v),
                      },
                      {
                        label: "Right",
                        value: paddingRight,
                        onChange: (v: string) =>
                          handleChange("padding-right", v),
                      },
                      {
                        label: "Bottom",
                        value: paddingBottom,
                        onChange: (v: string) =>
                          handleChange("padding-bottom", v),
                      },
                      {
                        label: "Left",
                        value: paddingLeft,
                        onChange: (v: string) =>
                          handleChange("padding-left", v),
                      },
                    ].map((item) => (
                      <div key={item.label} className="space-y-1">
                        <label className="text-xs font-medium text-foreground/70">
                          {item.label}
                        </label>
                        <input
                          className="w-full px-2 py-2 text-xs rounded-lg border border-border/60 bg-background/90 focus:border-yellow/50 focus:ring-2 focus:ring-yellow/20 focus:ring-offset-0 focus:ring-offset-background/50 transition-all duration-300 font-mono shadow-inner hover:shadow-md hover:shadow-yellow/10"
                          value={item.value}
                          placeholder="1rem"
                          onChange={(e) => item.onChange(e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Attributes Section */}
          <AccordionItem
            value="attributes"
            className="border-b border-border/30 rounded-none bg-transparent"
          >
            <AccordionTrigger className="px-0 py-2 hover:no-underline">
              <div className="flex items-center gap-2 text-left w-full">
                <div className="w-2 h-2 rounded-full bg-gradient-to-r from-cyan/60 to-sky/60 animate-pulse"></div>
                <span className="text-xs font-bold text-foreground/90 uppercase tracking-wider">
                  Attributes
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="px-1 space-y-3 text-sm">
                {attrSummary.filter(
                  (a) => a.name !== "class" && a.name !== "data-nowgai-uid"
                ).length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground/50 text-xs italic">
                    No attributes
                  </div>
                ) : (
                  attrSummary
                    .filter(
                      (a) => a.name !== "class" && a.name !== "data-nowgai-uid"
                    )
                    .slice(0, 12)
                    .map((a) => (
                      <div
                        key={a.name}
                        className="flex items-center gap-3 p-2"
                      >
                        <div className="min-w-28 text-xs font-bold text-foreground/80 uppercase tracking-wider">
                          {a.name}
                        </div>
                        <input
                          className="flex-1 px-3 py-2 text-xs rounded-lg border border-border/60 bg-background/90 focus:border-cyan/50 focus:ring-2 focus:ring-cyan/20 focus:ring-offset-0 focus:ring-offset-background/50 transition-all duration-300 font-mono shadow-inner hover:shadow-md hover:shadow-cyan/10"
                          value={attrValues[a.name] ?? a.value ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setAttrValues((prev) => ({ ...prev, [a.name]: v }));
                            sendAttributeUpdate(a.name, v);
                          }}
                        />
                      </div>
                    ))
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          </Accordion>
      </div>
    </div>
  );
}
