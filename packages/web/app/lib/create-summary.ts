import { generateText } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import type { FileMap } from "~/utils/constants";

export type UIMessage = {
  role: "user" | "assistant" | "system";
  content: string | Array<{ type: string; text?: string }>;
  id?: string;
};

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
 * Create a chat summary in the strict structure requested.
 * API: (model, messages, files) => string
 * - Provider is always OpenRouter; API key is server-side.
 * - Files are currently unused by the summary prompt but kept for API parity.
 */
export async function createSummary(
  model: string,
  messages: UIMessage[],
  _files: FileMap
): Promise<string> {
  const system = `
You are a software engineer. You are working on a project. you need to summarize the work till now and provide a summary of the chat till now.

Please only use the following format to generate the summary:
---
# Project Overview
- **Project**: {project_name} - {brief_description}
- **Current Phase**: {phase}
- **Tech Stack**: {languages}, {frameworks}, {key_dependencies}
- **Environment**: {critical_env_details}

# Conversation Context
- **Last Topic**: {main_discussion_point}
- **Key Decisions**: {important_decisions_made}
- **User Context**:
  - Technical Level: {expertise_level}
  - Preferences: {coding_style_preferences}
  - Communication: {preferred_explanation_style}

# Implementation Status
## Current State
- **Active Feature**: {feature_in_development}
- **Progress**: {what_works_and_what_doesn't}
- **Blockers**: {current_challenges}

## Code Evolution
- **Recent Changes**: {latest_modifications}
- **Working Patterns**: {successful_approaches}
- **Failed Approaches**: {attempted_solutions_that_failed}

# Requirements
- **Implemented**: {completed_features}
- **In Progress**: {current_focus}
- **Pending**: {upcoming_features}
- **Technical Constraints**: {critical_constraints}

# Critical Memory
- **Must Preserve**: {crucial_technical_context}
- **User Requirements**: {specific_user_needs}
- **Known Issues**: {documented_problems}

# Next Actions
- **Immediate**: {next_steps}
- **Open Questions**: {unresolved_issues}

---
Note:
4. Keep entries concise and focused on information needed for continuity


---

RULES:
* Only provide the whole summary of the chat till now.
* Do not provide any new information.
* DO not need to think too much just start writing imidiately
* do not write any thing other that the summary with with the provided structure

IMPORTANT: To save tokens and avoid noise, do NOT propose or discuss changes to build/styling configs unless the user explicitly asks: tailwind.config.js/ts, postcss.config.js/ts, vite.config.js/ts.
`;

  const textMessages = messages
    .map((m) => `---\n[${m.role}] ${extractTextContent(m)}\n---`)
    .join("\n");

  const prompt = `
Below is the chat:
---
${textMessages}
---
Please provide a summary of the chat till now using the exact structure above. If additional context is provided, align terminology and priorities with it without inventing new facts.`;

  const resp = await generateText({
    system,
    prompt,
    model: openrouter(model),
  });

  return resp.text || "";
}

