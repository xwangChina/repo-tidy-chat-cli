export interface RepoIdentifier {
  owner: string;
  name: string;
}

export interface BranchInfo {
  name: string;
  lastCommitSha: string;
  lastCommitAt: string;
  isDefault: boolean;
  isProtected: boolean;
  linkedPullRequestNumbers: number[];
}

export interface PullRequestInfo {
  number: number;
  title: string;
  headRef: string;
  state: 'open' | 'closed' | 'merged';
  canClose: boolean;
}

export type RepoAction =
  | { type: 'close-pr'; prNumber: number }
  | { type: 'delete-branch'; branch: string };

export type PlannedAction = RepoAction;

export interface ActionExecutionResult {
  action: RepoAction;
  status: 'success' | 'failed' | 'dry-run';
  message?: string;
}

export interface SkippedAction {
  action: RepoAction;
  reason: string;
}

export interface RunSummary {
  repo: RepoIdentifier;
  dryRun: boolean;
  startedAt: string;
  completedAt: string;
  listing: {
    branches: BranchInfo[];
    pullRequests: PullRequestInfo[];
  };
  plannedActions: PlannedAction[];
  actions: ActionExecutionResult[];
  skipped: SkippedAction[];
  errors: string[];
}

export interface ActionPlan {
  repo: RepoIdentifier;
  actions: RepoAction[];
  dryRun: boolean;
}

export interface AgentListResponse {
  repo: RepoIdentifier;
  branches: BranchInfo[];
  pullRequests: PullRequestInfo[];
}

export interface RepoTidyAgent {
  listRepository(repo: RepoIdentifier): Promise<AgentListResponse>;
  executePlan(plan: ActionPlan): Promise<{
    actions: ActionExecutionResult[];
    errors?: string[];
  }>;
}

export interface Selection {
  closePrNumbers: number[];
  deleteBranches: string[];
}

export interface RepoTidyUI {
  presentListing(listing: AgentListResponse): Promise<void> | void;
  promptForSelection(listing: AgentListResponse): Promise<Selection>;
  confirmExecution(plan: ActionPlan): Promise<boolean>;
  notifySkipped(skip: {
    type: 'delete-branch' | 'close-pr';
    target: string | number;
    reason: string;
  }): void;
  dispose?(): Promise<void> | void;
}

export interface Reporter {
  recordPlan(plan: ActionPlan, summary: RunSummary): void;
  recordResult(result: ActionExecutionResult, summary: RunSummary): void;
  finalize(summary: RunSummary): Promise<void> | void;
}

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}
