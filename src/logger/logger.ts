import * as fs from "fs/promises";
import * as path from "path";

export type LogEventType =
  | "run_started"
  | "issues_fetched"
  | "issue_started"
  | "workspace_cloned"
  | "fix_generated"
  | "fix_applied"
  | "tests_passed"
  | "tests_failed"
  | "retry_attempted"
  | "pr_created"
  | "fix_abandoned"
  | "issue_errored"
  | "run_completed";

export interface LogEvent {
  timestamp: string;
  event: LogEventType;
  issueNumber?: number;
  payload: Record<string, unknown>;
}

export class Logger {
  private events: LogEvent[] = [];
  private logPath: string;

  constructor(logsDir: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    this.logPath = path.join(logsDir, `run-${timestamp}.jsonl`);
  }

  log(event: LogEventType, payload: Record<string, unknown> = {}, issueNumber?: number): void {
    const entry: LogEvent = {
      timestamp: new Date().toISOString(),
      event,
      ...(issueNumber !== undefined && { issueNumber }),
      payload,
    };
    this.events.push(entry);
    console.log(`[log] ${event}${issueNumber !== undefined ? ` #${issueNumber}` : ""}`);
  }

  async flush(): Promise<void> {
    await fs.mkdir(path.dirname(this.logPath), { recursive: true });
    const lines = this.events.map((e) => JSON.stringify(e)).join("\n");
    await fs.writeFile(this.logPath, lines + "\n", "utf-8");
  }

  getEvents(): LogEvent[] {
    return this.events;
  }

  getLogPath(): string {
    return this.logPath;
  }
}
