import type { LoaderFunctionArgs } from "react-router";
import JSZip from "jszip";
import { PRELOAD_CONFIG } from "../config/preload.config";

interface FileEntry {
  path: string;
  content: string; // base64 encoded for binary data
  isDirectory: boolean;
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const { owner, repo, branch, nodeModulesPath } = PRELOAD_CONFIG.repository;

    console.log(`[Preload API] Downloading from ${owner}/${repo}/${branch}...`);

    // Use GitHub API zipball endpoint (server-side, no CORS issues)
    const baseUrl = "https://api.github.com";
    const zipballUrl = `${baseUrl}/repos/${owner}/${repo}/zipball/${branch}`;

    const response = await fetch(zipballUrl, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        // Use GitHub token from environment if available
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download zipball: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const sizeMB = (arrayBuffer.byteLength / 1024 / 1024).toFixed(2);
    console.log(`[Preload API] Downloaded ${sizeMB} MB`);

    console.log(`[Preload API] Extracting files...`);
    const zip = await JSZip.loadAsync(arrayBuffer);

    const files: FileEntry[] = [];
    const zipFiles = Object.keys(zip.files);

    // GitHub zipball format: owner-repo-sha/path
    const rootDir = zipFiles.length > 0 ? zipFiles[0].split('/')[0] : '';
    const nodeModulesPrefix = `${rootDir}/${nodeModulesPath}/`;

    let processed = 0;
    const total = zipFiles.filter(path => path.startsWith(nodeModulesPrefix)).length;

    console.log(`[Preload API] Found ${total} node_modules files`);

    for (const filePath of zipFiles) {
      if (!filePath.startsWith(nodeModulesPrefix)) {
        continue;
      }

      const zipEntry = zip.files[filePath];
      const relativePath = filePath.substring(`${rootDir}/`.length);

      if (zipEntry.dir) {
        files.push({
          path: relativePath,
          content: "",
          isDirectory: true,
        });
      } else {
        // Extract as base64 to safely transfer binary files over JSON
        const content = await zipEntry.async("base64");
        files.push({
          path: relativePath,
          content,
          isDirectory: false,
        });

        processed++;
        if (processed % 1000 === 0) {
          console.log(`[Preload API] Extracted ${processed}/${total} files...`);
        }
      }
    }

    console.log(`[Preload API] Successfully extracted ${files.length} files`);

    return new Response(
      JSON.stringify({
        success: true,
        files,
        totalFiles: files.length,
        sizeMB: parseFloat(sizeMB),
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          // Cache for 1 hour to avoid re-downloading
          "Cache-Control": "public, max-age=3600",
        },
      }
    );
  } catch (error) {
    console.error("[Preload API] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
