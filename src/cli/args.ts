import type { CliOptions, OutputMode, RepoIdentifier } from "../types/models";

function parseRepoIdentifier(input: string): RepoIdentifier {
  const trimmed = input.trim();

  if (trimmed.startsWith("http")) {
    try {
      const url = new URL(trimmed);
      if (url.hostname !== "github.com") {
        throw new Error("Only github.com URLs are supported for --repo");
      }
      const parts = url.pathname.replace(/\.git$/, "").split("/").filter(Boolean);
      if (parts.length < 2) {
        throw new Error("GitHub URL must include owner and repository name");
      }
      return { owner: parts[0], name: parts[1] };
    } catch (error) {
      throw new Error(`Invalid GitHub URL for --repo: ${trimmed}`);
    }
  }

  const match = trimmed.match(/^[\w.-]+\/[\w.-]+$/);
  if (!match) {
    throw new Error("--repo must be in owner/name format or a GitHub URL");
  }
  const [owner, name] = trimmed.split("/");
  return { owner, name };
}

function parseOutputMode(input: string | undefined): OutputMode {
  if (!input) {
    return "table";
  }
  const value = input.toLowerCase();
  if (value === "table" || value === "json" || value === "both") {
    return value;
  }
  throw new Error(`Invalid --output value: ${input}`);
}

function parseNumberList(raw: string | undefined): number[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => {
      const parsed = Number.parseInt(value, 10);
      if (Number.isNaN(parsed) || parsed <= 0) {
        throw new Error(`Invalid pull request number: ${value}`);
      }
      return parsed;
    });
}

function parseStringList(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function parseCliArgs(argv: string[]): CliOptions {
  const args = argv.slice(2);
  let repo: RepoIdentifier | undefined;
  let dryRun = false;
  let yes = false;
  let outputMode: OutputMode = "table";
  let mcpUrl: string | undefined;
  const closePrs: number[] = [];
  const deleteBranches: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    switch (token) {
      case "--repo": {
        const value = args[index + 1];
        if (!value) {
          throw new Error("--repo requires a value");
        }
        repo = parseRepoIdentifier(value);
        index += 1;
        break;
      }
      case "--dry-run":
        dryRun = true;
        break;
      case "--yes":
        yes = true;
        break;
      case "--output": {
        const value = args[index + 1];
        if (!value) {
          throw new Error("--output requires a value");
        }
        outputMode = parseOutputMode(value);
        index += 1;
        break;
      }
      case "--mcp-url": {
        const value = args[index + 1];
        if (!value) {
          throw new Error("--mcp-url requires a value");
        }
        mcpUrl = value;
        index += 1;
        break;
      }
      case "--close-pr": {
        const value = args[index + 1];
        if (!value) {
          throw new Error("--close-pr requires a comma separated list of numbers");
        }
        const values = parseNumberList(value);
        closePrs.push(...values);
        index += 1;
        break;
      }
      case "--delete-branch": {
        const value = args[index + 1];
        if (!value) {
          throw new Error("--delete-branch requires a comma separated list of branch names");
        }
        const values = parseStringList(value);
        deleteBranches.push(...values);
        index += 1;
        break;
      }
      default: {
        if (token.startsWith("--")) {
          throw new Error(`Unknown flag: ${token}`);
        }
        break;
      }
    }
  }

  if (!repo) {
    throw new Error("--repo flag is required");
  }

  const interactive = closePrs.length === 0 && deleteBranches.length === 0;

  return {
    repo,
    dryRun,
    yes,
    outputMode,
    mcpUrl,
    closePrs,
    deleteBranches,
    interactive,
  };
}

export { parseRepoIdentifier };
