export interface RepoIdentifier {
  owner: string;
  name: string;
}

export interface BranchInfo {
  name: string;
  commitSha: string;
  updatedAt: string;
  isDefault: boolean;
  isProtected: boolean;
}

export interface PullRequestInfo {
  number: number;
  title: string;
  state: "open" | "closed" | "merged";
  headRef: string;
  url: string;
  draft: boolean;
}

export type OutputMode = "table" | "json" | "both";

export interface CliOptions {
  repo: RepoIdentifier;
  dryRun: boolean;
  yes: boolean;
  outputMode: OutputMode;
  mcpUrl?: string;
  closePrs: number[];
  deleteBranches: string[];
  interactive: boolean;
}

export interface SelectedActions {
  closePrs: number[];
  deleteBranches: string[];
}

export interface ActionResult {
  number?: number;
  branchName?: string;
  status: "success" | "skipped" | "failed";
  reason?: string;
}

export interface ExecutionResults {
  closedPrs: Array<{ number: number; status: "success" | "skipped" | "failed"; reason?: string }>;
  deletedBranches: Array<{ name: string; status: "success" | "skipped" | "failed"; reason?: string }>;
  skippedBranches: Array<{ name: string; reason: string }>;
}

export interface ReportPayload {
  timestamp: string;
  repo: {
    owner: string;
    name: string;
    fullName: string;
  };
  options: {
    dryRun: boolean;
    yes: boolean;
    outputMode: OutputMode;
  };
  selected: SelectedActions;
  results: ExecutionResults;
  errors: Array<{ message: string }>;
}
