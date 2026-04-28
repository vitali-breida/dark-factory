import { Config } from "../config.js";
import { GitHubIssue } from "../github/issues.js";
import { getAnthropic } from "./client.js";

interface CachedTextBlock {
  type: "text";
  text: string;
  cache_control: { type: "ephemeral" };
}

const FILTER_INSTRUCTIONS = `You are a triage engineer evaluating GitHub issues for automated fixing.

An issue is suitable for automated fixing if ALL of the following are true:
- It describes a specific, concrete bug (not a feature request or question)
- It contains enough detail to understand what is broken
- The expected vs actual behavior is clear (explicitly or implicitly)
- It does not require access to external systems, credentials, or user-specific data
- It does not require a major architectural change

Respond with ONLY a JSON object, no explanation outside it:
{ "suitable": true | false, "reason": "one sentence explanation" }`;

export interface FilterResult {
  issue: GitHubIssue;
  suitable: boolean;
  reason: string;
}

export async function filterIssuesWithLLM(
  config: Config,
  issues: GitHubIssue[]
): Promise<GitHubIssue[]> {
  const anthropic = getAnthropic(config);
  const results: FilterResult[] = [];

  console.log(`[filter] Evaluating ${issues.length} issue(s) with LLM...`);

  for (const issue of issues) {
    const response = await anthropic.messages.create({
      model: config.filterModel,
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: FILTER_INSTRUCTIONS,
              cache_control: { type: "ephemeral" },
            } satisfies CachedTextBlock,
            {
              type: "text",
              text: `ISSUE #${issue.number}: ${issue.title}\n\n${issue.body}`,
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "{}";

    try {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      const parsed = JSON.parse(text.slice(start, end + 1)) as {
        suitable: boolean;
        reason: string;
      };
      results.push({ issue, suitable: parsed.suitable, reason: parsed.reason });
      const cached = (response.usage as unknown as Record<string, number>).cache_read_input_tokens ?? 0;
      const icon = parsed.suitable ? "✓" : "✗";
      console.log(`[filter] ${icon} #${issue.number} — ${issue.title}`);
      console.log(`         reason:  ${parsed.reason}`);
      if (cached > 0) console.log(`         cached:  ${cached} tokens`);
    } catch {
      console.warn(`[filter] Could not parse response for issue #${issue.number}, skipping`);
      results.push({ issue, suitable: false, reason: "parse error" });
    }
  }

  return results.filter((r) => r.suitable).map((r) => r.issue);
}
