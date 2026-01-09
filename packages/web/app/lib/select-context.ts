import { generateText } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import ignore from "ignore";
import { IGNORE_PATTERNS, type FileMap, WORK_DIR } from "~/utils/constants";

// Types kept minimal to match current UI usage
export type UIMessage = {
  role: "user" | "assistant" | "system";
  content: string | Array<{ type: string; text?: string }>;
};

const ig = ignore().add(IGNORE_PATTERNS);

export function createFilesContext(files: FileMap, useRelativePath?: boolean) {
  let filePaths = Object.keys(files || {});
  filePaths = filePaths.filter((x) => {
    const relPath = x.replace(`${WORK_DIR}/`, "");
    return !ig.ignores(relPath);
  });

  const fileContexts = filePaths
    .filter((x) => files[x] && files[x]?.type === "file")
    .map((path) => {
      const dirent = files[path];
      if (!dirent || dirent.type === "folder") return "";

      const code = dirent.content.split("\n").join("\n");

      let filePath = path;
      if (useRelativePath) filePath = path.replace(`${WORK_DIR}/`, "");

      return `<nowgaiAction type="file" filePath="${filePath}">${code}</nowgaiAction>`;
    });

  return `<nowgaiArtifact id="code-content" title="Code Content" >\n${fileContexts.join(
    "\n"
  )}\n</nowgaiArtifact>`;
}

export function getFilePaths(files: FileMap) {
  let filePaths = Object.keys(files || {});
  filePaths = filePaths.filter((x) => {
    const relPath = x.replace(`${WORK_DIR}/`, "");
    return !ig.ignores(relPath);
  });
  return filePaths;
}

function extractTextContent(message: UIMessage): string {
  if (Array.isArray(message.content)) {
    return (
      (message.content.find((item) => item.type === "text")?.text as string) ||
      ""
    );
  }
  return message.content as string;
}

/**
 * Parse <updateContextBuffer> selection from model output.
 */
function parseContextSelection(text: string) {
  const match = text.match(
    /<updateContextBuffer>([\s\S]*?)<\/updateContextBuffer>/
  );
  if (!match) return { include: [] as string[], exclude: [] as string[] };

  const body = match[1] || "";
  const include: string[] = [];
  const exclude: string[] = [];

  const includeTagRegex = /<includeFile\s+[^>]*path=\"(.*?)\"[^>]*>/g;
  const excludeTagRegex = /<excludeFile\s+[^>]*path=\"(.*?)\"[^>]*>/g;

  let m: RegExpExecArray | null;
  while ((m = includeTagRegex.exec(body)) !== null) {
    include.push(m[1]);
  }
  while ((m = excludeTagRegex.exec(body)) !== null) {
    exclude.push(m[1]);
  }

  return { include, exclude };
}

/**
 * Select a minimal set of relevant files using an LLM.
 * API: (model, messages, files) => filtered FileMap
 * - Provider is always OpenRouter; API key is server-side.
 */
export async function selectContext(
  model: string,
  messages: UIMessage[],
  files: FileMap
): Promise<FileMap> {
  const bufferLimit = 5;

  // Build candidate file list (absolute paths)
  let filePaths = getFilePaths(files || {});

  // Present relative paths to the model
  const relativePaths = filePaths.map((p) => p.replace(`${WORK_DIR}/`, ""));

  // Current buffer is empty for now (no annotations in our UI yet)
  const currentContextFiles: FileMap = {};
  const currentRelative: string[] = [];

  const context = createFilesContext(currentContextFiles, true);

  const lastUserMessage = messages.filter((m) => m.role === "user").pop();
  if (!lastUserMessage) throw new Error("No user message found");

  const summaryText = "";

  const system = `
You are a software engineer. You are working on a project. You have access to the following files:

AVAILABLE FILES PATHS
---
${relativePaths.map((path) => `- ${path}`).join("\n")}
---

You have the following code loaded in the context buffer that you can refer to:

CURRENT CONTEXT BUFFER
---
${context}
---

Now, you are given a task. You need to select the files that are relevant to the task from the list of files above.

RESPONSE FORMAT:
Your response MUST be in the following format only:
---
<updateContextBuffer>
    <includeFile path="path/to/file"/>
    <excludeFile path="path/to/file"/>
</updateContextBuffer>
---
Rules:
* Start with <updateContextBuffer> and end with </updateContextBuffer>.
* You can include multiple <includeFile/> and <excludeFile/> tags.
* Do NOT include any other text.
* Do NOT include any file that is not in the list of files above.
* Do NOT include any file that is already in the context buffer.
* If no changes are needed, return an empty <updateContextBuffer> block.
* Only ${bufferLimit} files can be placed in the context buffer at a time.
* If the buffer would exceed ${bufferLimit}, exclude less relevant files and include the most relevant ones.
`;

  const prompt = `
${summaryText}

Users Question: ${extractTextContent(lastUserMessage)}

Update the context buffer with the files that are relevant to the task from the list of files above.

CRITICAL RULES:
* Only include absolutely necessary files.
* Only use paths from the AVAILABLE FILES PATHS list.
* If no changes are needed, return an empty <updateContextBuffer>.
* Maximum of ${bufferLimit} files can be included.
`;

  const resp = await generateText({
    system,
    prompt,
    model: openrouter(model),
  });

  const { include, exclude } = parseContextSelection(resp.text || "");

  // Start from current buffer (empty) → apply exclusions and inclusions
  const contextFiles: FileMap = { ...currentContextFiles };

  exclude.forEach((rel) => {
    // Always relative in selection
    delete contextFiles[`${WORK_DIR}/${rel}`];
  });

  const filteredFiles: FileMap = {};

  for (const rel of include) {
    const full = rel.startsWith("/") ? rel : `${WORK_DIR}/${rel}`;

    // Validate the file is within provided files and not ignored
    const exists = filePaths.includes(full);
    if (!exists) {
      // Skip invalid selections silently
      continue;
    }

    if (currentRelative.includes(rel)) {
      continue; // already in buffer
    }

    filteredFiles[rel] = files[full];

    // Respect buffer limit strictly
    if (Object.keys(filteredFiles).length >= bufferLimit) break;
  }

  const total = Object.keys(filteredFiles).length;
  if (total === 0) {
    throw new Error("Failed to select any relevant files for context");
  }

  return filteredFiles;
}

