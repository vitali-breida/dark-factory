import { spawn } from "child_process";

export interface TestResult {
  passed: boolean;
  exitCode: number;
  durationMs: number;
  output: string;
  truncated: boolean;
}

const MAX_OUTPUT_CHARS = 8_000;

export function runTests(cwd: string, command: string, timeoutMs: number): Promise<TestResult> {
  return new Promise((resolve) => {
    const startedAt = Date.now();

    console.log(`[runner] Running: ${command} (timeout: ${timeoutMs / 1000}s)`);

    const proc = spawn(command, { cwd, shell: true });
    const chunks: string[] = [];

    proc.stdout.on("data", (d: Buffer) => chunks.push(d.toString()));
    proc.stderr.on("data", (d: Buffer) => chunks.push(d.toString()));

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      chunks.push("\n[runner] Process killed: timeout exceeded");
    }, timeoutMs);

    proc.on("close", (code) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startedAt;
      const raw = chunks.join("");
      const truncated = raw.length > MAX_OUTPUT_CHARS;
      const output = truncated ? raw.slice(-MAX_OUTPUT_CHARS) : raw;

      resolve({
        passed: code === 0,
        exitCode: code ?? -1,
        durationMs,
        output,
        truncated,
      });
    });
  });
}
