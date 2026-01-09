// Parse and execute actions from synthetic messages (for reconstruction)
// This allows us to reuse the same action execution logic for both LLM responses and reconstruction

interface ActionHandlers {
  onFileAction: (action: any) => Promise<void>;
  onShellAction: (action: any) => Promise<void>;
}

export async function parseAndExecuteActions(
  content: string,
  handlers: ActionHandlers
): Promise<void> {
  // Extract file actions
  const fileRegex =
    /<nowgaiAction[^>]*type="file"[^>]*filePath="([^"]+)"[^>]*>([\s\S]*?)<\/nowgaiAction>/gi;
  let fileMatch: RegExpExecArray | null;

  const fileActions: Array<{ filePath: string; content: string }> = [];

  while ((fileMatch = fileRegex.exec(content)) !== null) {
    const filePath = (fileMatch[1] || "").trim();
    let fileContent = (fileMatch[2] || "").trim();

    // Add trailing newline like parser does for non-md files
    if (!/\.md$/i.test(filePath)) {
      if (!fileContent.endsWith("\n")) fileContent += "\n";
    }

    if (filePath) {
      fileActions.push({ filePath, content: fileContent });
    }
  }

  // Extract shell actions
  const shellRegex =
    /<nowgaiAction[^>]*type="shell"[^>]*>([\s\S]*?)<\/nowgaiAction>/gi;
  let shellMatch: RegExpExecArray | null;

  const shellActions: string[] = [];

  while ((shellMatch = shellRegex.exec(content)) !== null) {
    const command = (shellMatch[1] || "").trim();
    if (command && !command.includes("<nowgaiAction")) {
      shellActions.push(command);
    }
  }

  // Execute file actions first
  for (const action of fileActions) {
    await handlers.onFileAction(action);
  }

  // Then execute shell actions in sequence
  for (const command of shellActions) {
    await handlers.onShellAction({ command, content: command });
  }
}
