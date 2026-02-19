import type { Message } from "../types/chat";

/**
 * Format timestamp for messages
 */
function formatMessageTime(timestamp?: string | Date): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (isToday) {
    return timeStr;
  } else if (isYesterday) {
    return `Yesterday at ${timeStr}`;
  } else {
    return (
      date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }) + ` at ${timeStr}`
    );
  }
}

/**
 * Clean message content by removing artifacts
 */
function cleanMessageContent(message: Message): string {
  if (typeof message.content !== "string") {
    return JSON.stringify(message.content);
  }

  let content = message.content;

  // Remove artifact tags and their content
  content = content.replace(
    /<nowgaiArtifact[^>]*>[\s\S]*?<\/nowgaiArtifact>/g,
    ""
  );
  content = content.replace(
    /<nowgaiAction[^>]*>[\s\S]*?<\/nowgaiAction>/g,
    ""
  );

  // Remove file checklist markup since we show it separately
  content = content.replace(
    /<div class=\"__nowgai_file_checklist__\">([\s\S]*?)<\/div>/g,
    ""
  );

  // Only remove excessive blank lines (3+ consecutive newlines) but preserve normal paragraph breaks
  content = content.replace(/\n\n\n+/g, "\n\n");

  return content.trim();
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Convert markdown-like text to HTML
 */
function formatMessageContent(content: string): string {
  // Escape HTML first
  let html = escapeHtml(content);

  // Convert code blocks
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const escapedCode = escapeHtml(code.trim());
    return `<pre><code${lang ? ` class="language-${lang}"` : ""}>${escapedCode}</code></pre>`;
  });

  // Convert inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Convert headers
  html = html.replace(/^### (.*$)/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.*$)/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.*$)/gm, "<h1>$1</h1>");

  // Convert bold
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Convert italic
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // Convert links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Convert line breaks to paragraphs
  const paragraphs = html.split(/\n\n+/).filter(p => p.trim());
  html = paragraphs.map(p => {
    const trimmed = p.trim();
    // Don't wrap code blocks or headers in paragraphs
    if (trimmed.startsWith('<pre>') || trimmed.startsWith('<h')) {
      return trimmed;
    }
    return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  return html;
}

/**
 * Download messages as HTML file
 */
export function downloadMessagesAsHTML(
  messages: Message[],
  conversationTitle?: string,
  conversationId?: string,
  chatId?: string
): void {
  const projectTitle = conversationTitle || "Chat History";
  
  // Build HTML content
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(projectTitle)} - Chat History</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
      max-width: 900px;
      margin: 0 auto;
    }
    .header {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header h1 {
      font-size: 24px;
      margin-bottom: 10px;
      color: #1a1a1a;
    }
    .metadata {
      font-size: 14px;
      color: #666;
      margin-top: 10px;
    }
    .metadata div {
      margin: 5px 0;
    }
    .message {
      background: white;
      padding: 20px;
      margin-bottom: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .message-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #f0f0f0;
    }
    .message-role {
      font-weight: 600;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .message-role.user {
      color: #2563eb;
    }
    .message-role.assistant {
      color: #059669;
    }
    .message-timestamp {
      font-size: 12px;
      color: #999;
    }
    .message-content {
      line-height: 1.8;
    }
    .message-content p {
      margin-bottom: 10px;
    }
    .message-content pre {
      background: #f8f8f8;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      padding: 12px;
      overflow-x: auto;
      margin: 15px 0;
    }
    .message-content code {
      background: #f0f0f0;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 0.9em;
    }
    .message-content pre code {
      background: none;
      padding: 0;
    }
    .message-content h1, .message-content h2, .message-content h3 {
      margin: 15px 0 10px 0;
    }
    .message-content h1 {
      font-size: 24px;
    }
    .message-content h2 {
      font-size: 20px;
    }
    .message-content h3 {
      font-size: 18px;
    }
    .message-content a {
      color: #2563eb;
      text-decoration: none;
    }
    .message-content a:hover {
      text-decoration: underline;
    }
    .tool-calls, .tool-results, .attachments {
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid #f0f0f0;
    }
    .tool-calls h4, .tool-results h4, .attachments h4 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 10px;
      color: #666;
    }
    .tool-item, .attachment-item {
      background: #f8f8f8;
      padding: 10px;
      border-radius: 4px;
      margin-bottom: 8px;
      font-size: 13px;
    }
    .tool-item strong {
      color: #333;
    }
    .attachment-item {
      color: #666;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding: 20px;
      color: #999;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(projectTitle)}</h1>
    <div class="metadata">
      ${conversationId ? `<div><strong>Conversation ID:</strong> ${escapeHtml(conversationId)}</div>` : ''}
      ${chatId ? `<div><strong>Chat ID:</strong> ${escapeHtml(chatId)}</div>` : ''}
      <div><strong>Exported:</strong> ${new Date().toLocaleString()}</div>
      <div><strong>Messages:</strong> ${messages.length}</div>
    </div>
  </div>
`;

  // Add each message
  messages.forEach((message, index) => {
    const timestamp = formatMessageTime(
      (message as any).createdAt || (message as any).timestamp
    );
    
    const role = message.role === "toolcall" ? "ASSISTANT (Tool Call)" : message.role.toUpperCase();
    const roleClass = message.role === "user" ? "user" : "assistant";
    
    html += `  <div class="message">
    <div class="message-header">
      <span class="message-role ${roleClass}">${escapeHtml(role)}</span>
      ${timestamp ? `<span class="message-timestamp">${escapeHtml(timestamp)}</span>` : ''}
    </div>
    <div class="message-content">`;

    // Add message content
    if (typeof message.content === "string") {
      const cleanContent = cleanMessageContent(message);
      if (cleanContent) {
        html += formatMessageContent(cleanContent);
      }
    } else if (message.content) {
      html += `<pre><code>${escapeHtml(JSON.stringify(message.content, null, 2))}</code></pre>`;
    }

    // Add tool calls if present
    const toolCalls = (message as any).toolCalls || [];
    if (toolCalls.length > 0) {
      html += `    <div class="tool-calls">
      <h4>Tool Calls</h4>`;
      toolCalls.forEach((tc: any) => {
        html += `      <div class="tool-item">
        <strong>${escapeHtml(tc.name || "Unknown Tool")}</strong><br>`;
        if (tc.args) {
          html += `        <span style="color: #666;">Arguments: ${escapeHtml(JSON.stringify(tc.args, null, 2))}</span><br>`;
        }
        if (tc.result) {
          const resultOutput = tc.result.output || tc.result.error || JSON.stringify(tc.result);
          html += `        <span style="color: #666;">Result: ${escapeHtml(String(resultOutput))}</span>`;
        }
        html += `      </div>`;
      });
      html += `    </div>`;
    }

    // Add tool results if present
    const toolResults = (message as any).toolResults || [];
    if (toolResults.length > 0) {
      html += `    <div class="tool-results">
      <h4>Tool Results</h4>`;
      toolResults.forEach((tr: any) => {
        html += `      <div class="tool-item">
        <strong>${escapeHtml(tr.toolName || "Unknown Tool")}</strong><br>`;
        if (tr.output) {
          html += `        <span style="color: #666;">Output: ${escapeHtml(String(tr.output))}</span>`;
        }
        html += `      </div>`;
      });
      html += `    </div>`;
    }

    // Add file attachments if present
    if (message.files && message.files.length > 0) {
      html += `    <div class="attachments">
      <h4>Attachments</h4>`;
      message.files.forEach((file) => {
        html += `      <div class="attachment-item">${escapeHtml(file.name)} (${escapeHtml(file.type)})</div>`;
      });
      html += `    </div>`;
    }

    html += `    </div>
  </div>
`;
  });

  html += `  <div class="footer">
    Exported from NowGai on ${new Date().toLocaleString()}
  </div>
</body>
</html>`;

  // Create and download the file
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const sanitizedTitle = projectTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  link.href = url;
  link.download = `${sanitizedTitle}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up
  URL.revokeObjectURL(url);
}
