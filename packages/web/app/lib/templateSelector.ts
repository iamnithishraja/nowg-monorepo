import JSZip from "jszip";
import { GitHubRepoImporter } from "./githubRepo";
import { getEnv, getEnvWithDefault } from "./env";
import {
  PROVIDER_MAINTENANCE_MESSAGE,
  isOpenRouterExhausted,
} from "./utils.server";

// Template definitions
interface Template {
  name: string;
  label: string;
  description: string;
  githubRepo: string;
  tags: string[];
  icon: string;
}

// Available starter templates - React only
const STARTER_TEMPLATES: Template[] = [
  {
    name: "Vite React",
    label: "React + Vite + TypeScript",
    description:
      "React starter template powered by Vite for fast development experience",
    githubRepo: "nithish932/bolt-vite-react-ts-template",
    tags: ["react", "vite", "frontend", "website", "app", "typescript"],
    icon: "i-bolt:react",
  },
];

// Types
interface TemplateSelection {
  template: string;
  title: string;
}

interface FileContent {
  name: string;
  path: string;
  content: string;
}

interface TemplateResult {
  assistantMessage: string;
  userMessage: string;
  files: FileContent[];
  repositoryUrl?: string;
  templateName?: string;
}

// Configuration
interface TemplateSelectorConfig {
  llmApiUrl?: string;
  githubToken?: string;
  useCloudflare?: boolean;
}

class TemplateSelector {
  private config: TemplateSelectorConfig;

  constructor(config: TemplateSelectorConfig = {}) {
    this.config = {
      llmApiUrl: "/api/llmcall",
      githubToken:
        getEnv("GITHUB_TOKEN") || getEnv("VITE_GITHUB_ACCESS_TOKEN") || "",
      useCloudflare: false,
      ...config,
    };
  }

  /**
   * Creates the prompt for template selection
   */
  private createTemplateSelectionPrompt(templates: Template[]): string {
    return `
You are an experienced developer who helps people choose the best starter template for their projects.
This platform ONLY generates React applications using Vite and TypeScript.

Available templates:
<template>
  <name>invalid</name>
  <description>Use this when the user input is gibberish, random characters, meaningless text, or not a valid project description</description>
  <tags>invalid, gibberish, random, meaningless</tags>
</template>
<template>
  <name>blank</name>
  <description>Empty starter for simple scripts and trivial tasks that don't require a full template setup</description>
  <tags>basic, script</tags>
</template>
<template>
  <name>Vite React</name>
  <description>React starter template powered by Vite for fast development experience with TypeScript</description>
  <tags>react, vite, frontend, website, app, typescript</tags>
</template>

Response Format:
<selection>
  <templateName>{selected template name}</templateName>
  <title>{a proper title for the project OR "Invalid Input" if gibberish}</title>
</selection>

Examples:

<example>
User: I need to build a todo app
Response:
<selection>
  <templateName>Vite React</templateName>
  <title>Simple React todo application</title>
</selection>
</example>

<example>
User: Write a script to generate numbers from 1 to 100
Response:
<selection>
  <templateName>blank</templateName>
  <title>script to generate numbers from 1 to 100</title>
</selection>
</example>

<example>
User: afhhjhjkji
Response:
<selection>
  <templateName>invalid</templateName>
  <title>Invalid Input</title>
</selection>
</example>

<example>
User: asdfghjkl qwerty zxcvbn
Response:
<selection>
  <templateName>invalid</templateName>
  <title>Invalid Input</title>
</selection>
</example>

Instructions:
1. FIRST check if the input is gibberish, random characters, or meaningless text - if so, use "invalid" template
2. For trivial tasks and simple scripts, always recommend the blank template
3. For any web application, UI, or frontend project, ALWAYS use "Vite React" template
4. Follow the exact XML format
5. This platform only supports React - do not suggest any other frameworks

Important: Provide only the selection tags in your response, no additional text.
MOST IMPORTANT: YOU DONT HAVE TIME TO THINK JUST START RESPONDING BASED ON HUNCH 
`;
  }

  /**
   * Parses the LLM response to extract template selection
   */
  private parseTemplateSelection(llmOutput: string): TemplateSelection | null {
    try {
      const templateNameMatch = llmOutput.match(
        /<templateName>(.*?)<\/templateName>/,
      );
      const titleMatch = llmOutput.match(/<title>(.*?)<\/title>/);

      if (!templateNameMatch) {
        return null;
      }

      return {
        template: templateNameMatch[1].trim(),
        title: titleMatch?.[1].trim() || "Untitled Project",
      };
    } catch (error) {
      console.error("Error parsing template selection:", error);
      return null;
    }
  }

  /**
   * Calls OpenRouter LLM to select appropriate template
   */
  private async callLLMForTemplateSelection(
    message: string,
    model: string = "anthropic/claude-4.5-sonnet",
    apiKey?: string,
  ): Promise<TemplateSelection> {
    const templates = STARTER_TEMPLATES;
    const systemPrompt = this.createTemplateSelectionPrompt(templates);

    if (!apiKey) {
      return {
        template: "blank",
        title: "Untitled Project",
      };
    }

    try {
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": getEnvWithDefault(
              "OPENROUTER_SITE_URL",
              "http://localhost:5173",
            ),
            "X-Title": getEnvWithDefault("OPENROUTER_SITE_NAME", "Nowgai"),
          },
          body: JSON.stringify({
            model: model,
            messages: [
              {
                role: "system",
                content: systemPrompt,
              },
              {
                role: "user",
                content: message,
              },
            ],
            temperature: 0.7,
            max_tokens: 1000,
          }),
        },
      );

      if (!response.ok) {
        let errorData: any = { statusCode: response.status };
        try {
          const text = await response.text();
          errorData = JSON.parse(text);
          errorData.statusCode = response.status;
        } catch (e) {
          // ignore parsing errors
        }

        if (isOpenRouterExhausted(errorData)) {
          throw new Error(PROVIDER_MAINTENANCE_MESSAGE);
        }
        
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();
      const llmOutput = data.choices?.[0]?.message?.content || "";
      const selectedTemplate = this.parseTemplateSelection(llmOutput);

      if (selectedTemplate) {
        return selectedTemplate;
      } else {
        return {
          template: "blank",
          title: "",
        };
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === PROVIDER_MAINTENANCE_MESSAGE
      ) {
        throw error;
      }
      console.error("Error calling OpenRouter:", error);
      return {
        template: "blank",
        title: "Untitled Project",
      };
    }
  }

  /**
   * Fetches files from GitHub repository using GitHubRepoImporter
   */
  private async fetchGitHubRepoContent(
    repoUrl: string,
  ): Promise<FileContent[]> {
    try {
      const importer = new GitHubRepoImporter({
        githubToken: this.config.githubToken,
        useCloudflare: this.config.useCloudflare,
      });

      const result = await importer.importRepository(repoUrl);

      if (!result.success) {
        throw new Error(result.error || "Failed to import repository");
      }

      // Convert to FileContent format
      return result.files.map((file) => ({
        name: file.path.split("/").pop() || "",
        path: file.path,
        content: file.content,
      }));
    } catch (error) {
      console.error("Error fetching repository contents:", error);
      throw error;
    }
  }

  /**
   * Main function to select template and fetch files
   */
  async selectAndCloneTemplate(
    userPrompt: string,
    model: string = "anthropic/claude-4.5-sonnet",
    apiKey?: string,
  ): Promise<TemplateResult> {
    // Step 1: Select template using LLM
    const selection = await this.callLLMForTemplateSelection(
      userPrompt,
      model,
      apiKey,
    );

    // Step 2: Handle invalid input
    if (selection.template === "invalid") {
      return {
        assistantMessage:
          "Please enter a valid project description. Your input doesn't appear to be a meaningful request.",
        userMessage: "",
        files: [],
        repositoryUrl: undefined,
        templateName: "invalid",
      };
    }

    // Step 3: Handle blank template
    if (selection.template === "blank") {
      return {
        assistantMessage: "Starting with a blank project.",
        userMessage:
          "You can now create files and start building your project.",
        files: [],
        repositoryUrl: undefined,
        templateName: "blank",
      };
    }

    // Step 4: Find the selected template
    const template = STARTER_TEMPLATES.find(
      (t) => t.name === selection.template,
    );

    if (!template) {
      throw new Error(`Template not found: ${selection.template}`);
    }

    // Step 5: Fetch files from GitHub
    const githubUrl = `https://github.com/${template.githubRepo}`;
    const files = await this.fetchGitHubRepoContent(githubUrl);

    // Step 6: Filter files
    let filteredFiles = files.filter((x) => !x.path.startsWith(".git"));
    filteredFiles = filteredFiles.filter((x) => !x.path.startsWith(".bolt"));

    // Step 7: Check for ignore file in .bolt folder
    const templateIgnoreFile = files.find(
      (x) => x.path.startsWith(".bolt") && x.name === "ignore",
    );
    const ignoredFiles: FileContent[] = [];

    if (templateIgnoreFile) {
      const ignorePatterns = templateIgnoreFile.content
        .split("\n")
        .map((x) => x.trim());
      // Simple pattern matching (you might want to use a proper ignore library)
      ignoredFiles.push(
        ...filteredFiles.filter((file) =>
          ignorePatterns.some((pattern) => file.path.includes(pattern)),
        ),
      );
    }

    // Step 8: Create messages
    const assistantMessage = `
Nowgai is initializing your project with the required files using the ${
      template.name
    } template.
<nowgaiArtifact id="imported-files" title="${
      selection.title || "Create initial files"
    }" type="bundled">
${filteredFiles
  .map(
    (file) =>
      `<nowgaiAction type="file" filePath="${file.path}">
${file.content}
</nowgaiAction>`,
  )
  .join("\n")}
</nowgaiArtifact>
`;

    let templateUserMessage = "";
    const templatePromptFile = files.find(
      (x) => x.path.startsWith(".bolt") && x.name === "prompt",
    );

    if (templatePromptFile) {
      templateUserMessage = `
TEMPLATE INSTRUCTIONS:
${templatePromptFile.content}

---
`;
    }

    if (ignoredFiles.length > 0) {
      templateUserMessage += `
STRICT FILE ACCESS RULES - READ CAREFULLY:

The following files are READ-ONLY and must never be modified:
${ignoredFiles.map((file) => `- ${file.path}`).join("\n")}

Permitted actions:
✓ Import these files as dependencies
✓ Read from these files
✓ Reference these files

Strictly forbidden actions:
❌ Modify any content within these files
❌ Delete these files
❌ Rename these files
❌ Move these files
❌ Create new versions of these files
❌ Suggest changes to these files

Any attempt to modify these protected files will result in immediate termination of the operation.

If you need to make changes to functionality, create new files instead of modifying the protected ones listed above.
---
`;
    }

    templateUserMessage += `
---
template import is done, and you can now use the imported files,
edit only the files that need to be changed, and you can create new files as needed.
DO NOT EDIT/WRITE ANY FILES THAT ALREADY EXIST IN THE PROJECT AND DOES NOT NEED TO BE MODIFIED
---
Now that the Template is imported please continue with my original request

IMPORTANT: Don't Forget to install the dependencies before running the app by using \`npm install && npm run dev\`
`;

    return {
      assistantMessage,
      userMessage: templateUserMessage,
      files: filteredFiles,
      repositoryUrl: `https://github.com/${template.githubRepo}`,
      templateName: template.name,
    };
  }

  /**
   * Get all available templates
   */
  getAvailableTemplates(): Template[] {
    return STARTER_TEMPLATES;
  }

  /**
   * Manually select a template by name
   */
  async cloneTemplateByName(
    templateName: string,
    title?: string,
  ): Promise<TemplateResult> {
    const template = STARTER_TEMPLATES.find((t) => t.name === templateName);

    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    const githubUrl = `https://github.com/${template.githubRepo}`;
    const files = await this.fetchGitHubRepoContent(githubUrl);
    let filteredFiles = files.filter((x) => !x.path.startsWith(".git"));
    filteredFiles = filteredFiles.filter((x) => !x.path.startsWith(".bolt"));

    const assistantMessage = `
Nowgai is initializing your project with the required files using the ${
      template.name
    } template.
<nowgaiArtifact id="imported-files" title="${
      title || "Create initial files"
    }" type="bundled">
${filteredFiles
  .map(
    (file) =>
      `<nowgaiAction type="file" filePath="${file.path}">
${file.content}
</nowgaiAction>`,
  )
  .join("\n")}
</nowgaiArtifact>
`;

    return {
      assistantMessage,
      userMessage:
        "Template imported successfully. You can now start building your project.",
      files: filteredFiles,
      repositoryUrl: `https://github.com/${template.githubRepo}`,
      templateName: template.name,
    };
  }
}

// Export the class and types
export { TemplateSelector, STARTER_TEMPLATES };
export type {
  Template,
  TemplateSelection,
  FileContent,
  TemplateResult,
  TemplateSelectorConfig,
};
