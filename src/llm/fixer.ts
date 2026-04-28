import * as fs from "fs/promises";
import * as path from "path";
import { Config } from "../config.js";
import { GitHubIssue } from "../github/issues.js";
import { FileChange } from "../git/workspace.js";
import { getAnthropic } from "./client.js";
import {
  buildFileSelectorPrompt,
  buildFileContentsBlock,
  buildFixPrompt,
  buildRetryPrompt,
  RelevantFile,
} from "./prompts.js";

interface CachedTextBlock {
  type: "text";
  text: string;
  cache_control: { type: "ephemeral" };
}

export interface LLMFixResponse {
  reasoning: string;
  changes: FileChange[];
}

function parseJsonObject<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in LLM response");
  return JSON.parse(raw.slice(start, end + 1)) as T;
}

function parseJsonArray(text: string): string[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("No JSON array found in LLM response");
  return JSON.parse(raw.slice(start, end + 1)) as string[];
}

function truncateFile(content: string, maxLines: number): string {
  const lines = content.split("\n");
  if (lines.length <= maxLines) return content;
  return lines.slice(0, maxLines).join("\n") + `\n// ... truncated (${lines.length} lines total)`;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

async function selectRelevantFiles(
  config: Config,
  issue: GitHubIssue,
  repoTree: string,
  workspaceDir: string
): Promise<RelevantFile[]> {
  const anthropic = getAnthropic(config);

  const response = await anthropic.messages.create({
    model: config.fixModel,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: buildFileSelectorPrompt(issue, repoTree),
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  let filePaths: string[] = parseJsonArray(text);
  filePaths = filePaths.slice(0, config.maxRelevantFiles);

  console.log(`[llm] Selected files: ${filePaths.join(", ")}`);

  const files: RelevantFile[] = [];
  for (const filePath of filePaths) {
    const absPath = path.join(workspaceDir, filePath);
    try {
      const content = await fs.readFile(absPath, "utf-8");
      files.push({ path: filePath, content: truncateFile(content, config.maxFileLines) });
    } catch {
      console.warn(`[llm] Could not read file: ${filePath}`);
    }
  }

  return files;
}

export async function generateFix(
  config: Config,
  issue: GitHubIssue,
  repoTree: string,
  workspaceDir: string
): Promise<LLMFixResponse> {
  const anthropic = getAnthropic(config);
  const relevantFiles = await selectRelevantFiles(config, issue, repoTree, workspaceDir);

  const fileContentsBlock = buildFileContentsBlock(relevantFiles);
  const dynamicBlock = buildFixPrompt(issue);

  const totalEstimate = estimateTokens(repoTree + fileContentsBlock + dynamicBlock);
  if (totalEstimate > config.maxInputTokens) {
    console.warn(`[llm] Token estimate (${totalEstimate}) exceeds budget — some files may be excluded`);
  }

  console.log(`[llm] Generating fix (~${totalEstimate} input tokens, this may take 30-60s)...`);
  const response = await anthropic.messages.create({
    model: config.fixModel,
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `REPOSITORY FILE TREE:\n${repoTree}`,
            cache_control: { type: "ephemeral" },
          } satisfies CachedTextBlock,
          {
            type: "text",
            text: `RELEVANT FILE CONTENTS:\n\n${fileContentsBlock}`,
            cache_control: { type: "ephemeral" },
          } satisfies CachedTextBlock,
          {
            type: "text",
            text: dynamicBlock,
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const result = parseJsonObject<LLMFixResponse>(text);

  const cached = (response.usage as unknown as Record<string, number>).cache_read_input_tokens ?? 0;
  console.log(`[llm] Fix generated. Cached tokens: ${cached}`);

  return result;
}

export async function generateRetryFix(
  config: Config,
  issue: GitHubIssue,
  repoTree: string,
  workspaceDir: string,
  testOutput: string
): Promise<LLMFixResponse> {
  const anthropic = getAnthropic(config);
  const relevantFiles = await selectRelevantFiles(config, issue, repoTree, workspaceDir);
  const fileContentsBlock = buildFileContentsBlock(relevantFiles);

  const response = await anthropic.messages.create({
    model: config.fixModel,
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `REPOSITORY FILE TREE:\n${repoTree}`,
            cache_control: { type: "ephemeral" },
          } satisfies CachedTextBlock,
          {
            type: "text",
            text: `RELEVANT FILE CONTENTS:\n\n${fileContentsBlock}`,
            cache_control: { type: "ephemeral" },
          } satisfies CachedTextBlock,
          {
            type: "text",
            text: buildRetryPrompt(issue, testOutput),
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return parseJsonObject<LLMFixResponse>(text);
}
