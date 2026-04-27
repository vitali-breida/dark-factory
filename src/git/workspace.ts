import { simpleGit } from "simple-git";
import * as fs from "fs/promises";
import * as path from "path";
import { Config } from "../config.js";
import { GitHubIssue } from "../github/issues.js";

export interface FileChange {
  path: string;
  content: string;
  action: "create" | "modify" | "delete";
}

export class WorkspaceManager {
  private workspaceDir: string;
  private branchName: string = "";
  private config: Config;

  constructor(config: Config, workspaceDir: string) {
    this.config = config;
    this.workspaceDir = workspaceDir;
  }

  static async cloneRepo(config: Config, issue: GitHubIssue): Promise<WorkspaceManager> {
    const [owner, repo] = config.targetRepo.split("/");
    const timestamp = Date.now();
    const workspaceDir = path.join(config.workspacesDir, `${repo}-${issue.number}-${timestamp}`);

    await fs.mkdir(workspaceDir, { recursive: true });

    const repoUrl = `https://x-access-token:${config.githubToken}@github.com/${owner}/${repo}.git`;

    const git = simpleGit();
    await git.clone(repoUrl, workspaceDir, ["--depth", "1", "--branch", config.targetBranch]);

    console.log(`[workspace] Cloned ${config.targetRepo} into ${workspaceDir}`);
    return new WorkspaceManager(config, workspaceDir);
  }

  async listFiles(): Promise<string> {
    const git = simpleGit(this.workspaceDir);
    const result = await git.raw(["ls-files"]);
    return result.trim();
  }

  async createBranch(branchName: string): Promise<void> {
    this.branchName = branchName;
    const git = simpleGit(this.workspaceDir);
    await git.checkoutLocalBranch(branchName);
    console.log(`[workspace] Created branch: ${branchName}`);
  }

  async applyFileChanges(changes: FileChange[]): Promise<void> {
    for (const change of changes) {
      const filePath = path.join(this.workspaceDir, change.path);

      if (change.action === "delete") {
        await fs.rm(filePath, { force: true });
        console.log(`[workspace] Deleted: ${change.path}`);
      } else {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, change.content, "utf-8");
        console.log(`[workspace] Written: ${change.path}`);
      }
    }
  }

  async resetChanges(): Promise<void> {
    const git = simpleGit(this.workspaceDir);
    await git.checkout(["-f", "."]);
    console.log(`[workspace] Reset all changes`);
  }

  async commitAndPush(message: string): Promise<void> {
    const git = simpleGit(this.workspaceDir);
    await git.add(".");
    await git.commit(message);
    await git.push("origin", this.branchName);
    console.log(`[workspace] Committed and pushed branch: ${this.branchName}`);
  }

  async cleanup(): Promise<void> {
    await fs.rm(this.workspaceDir, { recursive: true, force: true });
    console.log(`[workspace] Cleaned up: ${this.workspaceDir}`);
  }

  getDir(): string {
    return this.workspaceDir;
  }
}
