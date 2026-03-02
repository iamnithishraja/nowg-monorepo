(function () {
  let isInspectorActive = false;
  let inspectorStyle = null;
  let currentHighlight = null;
  let uidCounter = 1;

  // Function to get relevant styles
  function getRelevantStyles(element) {
    const computedStyles = window.getComputedStyle(element);
    const relevantProps = [
      "display",
      "position",
      "width",
      "height",
      "margin",
      "margin-top",
      "margin-right",
      "margin-bottom",
      "margin-left",
      "padding",
      "padding-top",
      "padding-right",
      "padding-bottom",
      "padding-left",
      "gap",
      "border",
      "border-color",
      "border-width",
      "border-radius",
      "box-shadow",
      "background",
      "background-color",
      "background-image",
      "color",
      "opacity",
      "font-size",
      "font-family",
      "font-weight",
      "line-height",
      "letter-spacing",
      "text-align",
      "flex-direction",
      "justify-content",
      "align-items",
    ];

    const styles = {};
    relevantProps.forEach((prop) => {
      const value = computedStyles.getPropertyValue(prop);
      if (value) styles[prop] = value;
    });

    return styles;
  }

  // Collect all attributes on an element as a simple object
  function getAllAttributes(element) {
    const attrs = {};
    try {
      if (element && element.attributes) {
        for (let i = 0; i < element.attributes.length; i++) {
          const attr = element.attributes[i];
          if (attr && attr.name) {
            attrs[attr.name] = attr.value ?? "";
          }
        }
      }
    } catch {}
    return attrs;
  }

  // Function to create a readable element selector
  function createReadableSelector(element) {
    let selector = element.tagName.toLowerCase();

    // Add ID if present
    if (element.id) {
      selector += `#${element.id}`;
    }

    // Add classes if present
    let className = "";
    if (element.className) {
      if (typeof element.className === "string") {
        className = element.className;
      } else if (element.className.baseVal !== undefined) {
        className = element.className.baseVal;
      } else {
        className = element.className.toString();
      }

      if (className.trim()) {
        const classes = className.trim().split(/\s+/).slice(0, 3); // Limit to first 3 classes
        selector += `.${classes.join(".")}`;
      }
    }

    return selector;
  }

  // Function to create element display text
  function createElementDisplayText(element) {
    const tagName = element.tagName.toLowerCase();
    let displayText = `<${tagName}`;

    // Add ID attribute
    if (element.id) {
      displayText += ` id="${element.id}"`;
    }

    // Add class attribute (limit to first 3 classes for readability)
    let className = "";
    if (element.className) {
      if (typeof element.className === "string") {
        className = element.className;
      } else if (element.className.baseVal !== undefined) {
        className = element.className.baseVal;
      } else {
        className = element.className.toString();
      }

      if (className.trim()) {
        const classes = className.trim().split(/\s+/);
        const displayClasses =
          classes.length > 3
            ? classes.slice(0, 3).join(" ") + "..."
            : classes.join(" ");
        displayText += ` class="${displayClasses}"`;
      }
    }

    // Add other important attributes
    const importantAttrs = ["type", "name", "href", "src", "alt", "title"];
    importantAttrs.forEach((attr) => {
      const value = element.getAttribute(attr);
      if (value) {
        const truncatedValue =
          value.length > 30 ? value.substring(0, 30) + "..." : value;
        displayText += ` ${attr}="${truncatedValue}"`;
      }
    });

    displayText += ">";

    // Add text content preview for certain elements
    const textElements = [
      "span",
      "p",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "button",
      "a",
      "label",
    ];
    if (textElements.includes(tagName) && element.textContent) {
      const textPreview = element.textContent.trim().substring(0, 50);
      if (textPreview) {
        displayText +=
          textPreview.length < element.textContent.trim().length
            ? textPreview + "..."
            : textPreview;
      }
    }

    displayText += `</${tagName}>`;

    return displayText;
  }

  // Function to create element info
  function createElementInfo(element) {
    const rect = element.getBoundingClientRect();
    const uid = getOrAssignUid(element);

    return {
      tagName: element.tagName,
      className: getElementClassName(element),
      id: element.id || "",
      // Do not trim text content; host may allow full editing
      textContent: element.textContent || "",
      styles: getRelevantStyles(element),
      inlineStyle: element.getAttribute("style") || "",
      attributes: getAllAttributes(element),
      classList:
        getElementClassName(element).trim()
          ? getElementClassName(element).trim().split(/\s+/)
          : [],
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left,
      },
      // Add new readable formats
      selector: createReadableSelector(element),
      displayText: createElementDisplayText(element),
      elementPath: getElementPath(element),
      // Include page URL for host-side logging
      pageUrl: window.location.href,
      uid: uid,
    };
  }

  // Helper function to get element class name consistently
  function getElementClassName(element) {
    if (!element.className) return "";

    if (typeof element.className === "string") {
      return element.className;
    } else if (element.className.baseVal !== undefined) {
      return element.className.baseVal;
    } else {
      return element.className.toString();
    }
  }

  // Assign a stable UID to an element for future updates
  function getOrAssignUid(el) {
    if (!el) return "";
    const existing = el.getAttribute("data-nowgai-uid");
    if (existing) return existing;
    const uid = String(uidCounter++);
    try { el.setAttribute("data-nowgai-uid", uid); } catch {}
    return uid;
  }

  // Function to get element path (breadcrumb)
  function getElementPath(element) {
    const path = [];
    let current = element;

    while (
      current &&
      current !== document.body &&
      current !== document.documentElement
    ) {
      let pathSegment = current.tagName.toLowerCase();

      if (current.id) {
        pathSegment += `#${current.id}`;
      } else if (current.className) {
        const className = getElementClassName(current);
        if (className.trim()) {
          const firstClass = className.trim().split(/\s+/)[0];
          pathSegment += `.${firstClass}`;
        }
      }

      path.unshift(pathSegment);
      current = current.parentElement;

      // Limit path length
      if (path.length >= 5) break;
    }

    return path.join(" > ");
  }

  // Event handlers
  function handleMouseMove(e) {
    if (!isInspectorActive) return;

    const target = e.target;
    if (
      !target ||
      target === document.body ||
      target === document.documentElement
    )
      return;

    // Remove previous highlight
    if (currentHighlight) {
      currentHighlight.classList.remove("inspector-highlight");
    }

    // Add highlight to current element
    target.classList.add("inspector-highlight");
    currentHighlight = target;

    const elementInfo = createElementInfo(target);

    // Show hover label near cursor
    try {
      let label = document.getElementById("__inspector_label__");
      if (!label) {
        label = document.createElement("div");
        label.id = "__inspector_label__";
        label.style.position = "fixed";
        label.style.zIndex = "999999";
        label.style.pointerEvents = "none";
        label.style.background = "rgba(17,24,39,0.9)";
        label.style.color = "white";
        label.style.fontSize = "12px";
        label.style.padding = "4px 6px";
        label.style.borderRadius = "4px";
        label.style.fontFamily = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
        document.body.appendChild(label);
      }
      const tag = target.tagName ? target.tagName.toLowerCase() : "element";
      const idPart = target.id ? `#${target.id}` : "";
      const className = getElementClassName(target).trim();
      const classPart = className ? `.${className.split(/\s+/)[0]}` : "";
      label.textContent = `${tag}${idPart}${classPart}`;
      const x = Math.min(e.clientX + 12, window.innerWidth - 12);
      const y = Math.min(e.clientY + 12, window.innerHeight - 12);
      label.style.left = `${x}px`;
      label.style.top = `${y}px`;
    } catch {}

    // Send message to parent
    window.parent.postMessage(
      {
        type: "INSPECTOR_HOVER",
        elementInfo: elementInfo,
      },
      "*"
    );
  }

  function handleClick(e) {
    if (!isInspectorActive) return;

    e.preventDefault();
    e.stopPropagation();

    const target = e.target;
    if (
      !target ||
      target === document.body ||
      target === document.documentElement
    )
      return;

    const elementInfo = createElementInfo(target);

    // Send message to parent
    window.parent.postMessage(
      {
        type: "INSPECTOR_CLICK",
        elementInfo: elementInfo,
      },
      "*"
    );
  }

  function handleMouseLeave() {
    if (!isInspectorActive) return;

    // Remove highlight
    if (currentHighlight) {
      currentHighlight.classList.remove("inspector-highlight");
      currentHighlight = null;
    }

    // Remove hover label
    try {
      const label = document.getElementById("__inspector_label__");
      if (label) label.remove();
    } catch {}

    // Send message to parent
    window.parent.postMessage(
      {
        type: "INSPECTOR_LEAVE",
      },
      "*"
    );
  }

  // Function to activate/deactivate inspector
  function setInspectorActive(active) {
    isInspectorActive = active;

    if (active) {
      // Add inspector styles
      if (!inspectorStyle) {
        inspectorStyle = document.createElement("style");
        inspectorStyle.textContent = `
            .inspector-active * {
              cursor: crosshair !important;
            }
            .inspector-highlight {
              outline: 2px solid #3b82f6 !important;
              outline-offset: -2px !important;
              background-color: rgba(59, 130, 246, 0.1) !important;
            }
          `;
        document.head.appendChild(inspectorStyle);
      }

      document.body.classList.add("inspector-active");

      // Add event listeners
      document.addEventListener("mousemove", handleMouseMove, true);
      document.addEventListener("click", handleClick, true);
      document.addEventListener("mouseleave", handleMouseLeave, true);
    } else {
      document.body.classList.remove("inspector-active");

      // Remove highlight
      if (currentHighlight) {
        currentHighlight.classList.remove("inspector-highlight");
        currentHighlight = null;
      }

      // Remove event listeners
      document.removeEventListener("mousemove", handleMouseMove, true);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("mouseleave", handleMouseLeave, true);

      // Remove styles
      if (inspectorStyle) {
        inspectorStyle.remove();
        inspectorStyle = null;
      }

      // Cleanup hover label
      try {
        const label = document.getElementById("__inspector_label__");
        if (label) label.remove();
      } catch {}
    }
  }

  // Listen for messages from parent
  window.addEventListener("message", function (event) {
    if (event.data.type === "INSPECTOR_ACTIVATE") {
      setInspectorActive(event.data.active);
    } else if (event.data.type === "APPLY_INLINE_STYLES") {
      try {
        const { selector, elementPath, styles, uid } = event.data.payload || {};
        let target = null;
        // 1) Prefer UID which is stable
        if (uid) {
          target = document.querySelector(`[data-nowgai-uid="${CSS.escape(String(uid))}"]`);
        }
        // Try via elementPath (breadcrumb) first for better specificity
        if (!target && elementPath) {
          const segments = String(elementPath).split(" > ");
          // Traverse down using a simple query strategy
          let current = document;
          for (const seg of segments) {
            // Build a CSS selector for this segment; supports id and first class
            const m = seg.match(/^(\w+)(#[^\.]+)?(\.[^#]+)?$/);
            let query = seg;
            if (m) query = m[0];
            const scope = current instanceof Document ? current : current;
            const next = scope.querySelector(query);
            if (!next) { current = null; break; }
            current = next;
          }
          if (current && current instanceof Element) target = current;
        }
        // Fallback to simple selector string
        if (!target && selector) {
          try { target = document.querySelector(selector); } catch {}
        }
        // Last resort: currently highlighted element
        if (!target && currentHighlight) target = currentHighlight;
        if (!target || !(target instanceof Element)) return;

        // Map from UI keys to real CSS properties
        const map = {
          fontSize: "font-size",
          fontWeight: "font-weight",
          lineHeight: "line-height",
          letterSpacing: "letter-spacing",
          textAlign: "text-align",
          fontStyle: "font-style",
          textDecoration: "text-decoration",
          color: "color",
          backgroundColor: "background-color",
        };
        Object.keys(styles || {}).forEach((k) => {
          const cssProp = map[k] || k;
          const value = styles[k];
          if (value === "" || value == null) {
            target.style.removeProperty(cssProp);
          } else {
            target.style.setProperty(cssProp, String(value));
          }
        });

        // Send back an updated snapshot so host can reflect current styles if needed
        const elementInfo = createElementInfo(target);
        window.parent.postMessage(
          {
            type: "INSPECTOR_CLICK",
            elementInfo,
          },
          "*"
        );
      } catch {}
    } else if (event.data.type === "APPLY_TEXT_CONTENT") {
      try {
        const { selector, elementPath, content, uid } = event.data.payload || {};
        let target = null;
        if (uid) {
          target = document.querySelector(`[data-nowgai-uid="${CSS.escape(String(uid))}"]`);
        }
        if (!target && elementPath) {
          const segments = String(elementPath).split(" > ");
          let current = document;
          for (const seg of segments) {
            const m = seg.match(/^(\w+)(#[^\.]+)?(\.[^#]+)?$/);
            let query = seg;
            if (m) query = m[0];
            const scope = current instanceof Document ? current : current;
            const next = scope.querySelector(query);
            if (!next) { current = null; break; }
            current = next;
          }
          if (current && current instanceof Element) target = current;
        }
        if (!target && selector) {
          try { target = document.querySelector(selector); } catch {}
        }
        if (!target && currentHighlight) target = currentHighlight;
        if (!target || !(target instanceof Element)) return;

        // Update text content for common text elements; avoid altering inputs
        const tag = target.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea') {
          (target).value = content ?? '';
        } else {
          target.textContent = content ?? '';
        }

        const elementInfo = createElementInfo(target);
        window.parent.postMessage({ type: "INSPECTOR_CLICK", elementInfo }, "*");
      } catch {}
    } else if (event.data.type === "HOST_SET_ATTRIBUTE") {
      try {
        const { selector, elementPath, name, value, uid } = event.data.payload || {};
        let target = null;
        if (uid) {
          target = document.querySelector(`[data-nowgai-uid="${CSS.escape(String(uid))}"]`);
        }
        if (!target && elementPath) {
          const segments = String(elementPath).split(" > ");
          let current = document;
          for (const seg of segments) {
            const m = seg.match(/^(\w+)(#[^\.]+)?(\.[^#]+)?$/);
            let query = seg;
            if (m) query = m[0];
            const next = (current instanceof Document ? current : current).querySelector(query);
            if (!next) { current = null; break; }
            current = next;
          }
          if (current && current instanceof Element) target = current;
        }
        if (!target && selector) {
          try { target = document.querySelector(selector); } catch {}
        }
        if (!target && currentHighlight) target = currentHighlight;
        if (!target || !(target instanceof Element)) return;

        if (value === "" || value == null) {
          target.removeAttribute(name);
        } else {
          target.setAttribute(name, String(value));
        }

        const elementInfo = createElementInfo(target);
        window.parent.postMessage({ type: "INSPECTOR_CLICK", elementInfo }, "*");
      } catch {}
    } else if (event.data.type === "GET_PREVIEW_HTML") {
      try {
        var html = document.documentElement
          ? document.documentElement.outerHTML
          : (document.body && document.body.outerHTML) || "";
        window.parent.postMessage({ type: "PREVIEW_HTML", html: html }, "*");
      } catch (e) {
        window.parent.postMessage(
          { type: "PREVIEW_HTML_ERROR", error: (e && e.message) || "Failed to get HTML" },
          "*"
        );
      }
    }
  });

  // Auto-inject if inspector is already active
  window.parent.postMessage({ type: "INSPECTOR_READY" }, "*");
})();
