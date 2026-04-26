import { Octokit } from "@octokit/rest";
import { Config } from "../config.js";

let _octokit: Octokit | null = null;

export function getOctokit(config: Config): Octokit {
  if (!_octokit) {
    _octokit = new Octokit({ auth: config.githubToken });
  }
  return _octokit;
}
