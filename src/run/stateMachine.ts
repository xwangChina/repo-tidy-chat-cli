import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { RepoTidyAgent } from "../agent/agent";
import { parseCliArgs } from "../cli/args";
import { logStructured } from "../logging/structured";
import { promptForConfirmation, promptForSelections } from "../ui/menus";
import { computeExecutableActions } from "./planner";
import { buildReportPayload, formatBranchTable, formatPrTable } from "./report";
import type {
  BranchInfo,
  CliOptions,
  ExecutionResults,
  PullRequestInfo,
  ReportPayload,
  SelectedActions,
} from "../types/models";

interface RunStateMachineArgs {
  options: CliOptions;
  agent: RepoTidyAgent;
  stdio?: {
    input?: NodeJS.ReadableStream;
    output?: NodeJS.WritableStream;
  };
}

export async function runCli(argv: string[] = process.argv): Promise<void> {
  const options = parseCliArgs(argv);
  const agent = new RepoTidyAgent({ githubMcpUrl: options.mcpUrl });
  await runStateMachine({ options, agent });
}

export async function runStateMachine(args: RunStateMachineArgs): Promise<void> {
  const { options, agent } = args;
  logStructured({ event: "state.list.begin", data: { repo: options.repo } });
  const inventory = await agent.listRepository(options.repo);
  const branches: BranchInfo[] = inventory.branches.map((branch) => ({
    name: branch.name,
    commitSha: branch.commitSha,
    updatedAt: branch.updatedAt,
    isDefault: branch.isDefault,
    isProtected: branch.isProtected,
  }));
  const pullRequests: PullRequestInfo[] = inventory.pullRequests.map((pr) => ({
    number: pr.number,
    title: pr.title,
    state: pr.state as PullRequestInfo["state"],
    headRef: pr.headRef,
    url: pr.url,
    draft: pr.draft,
  }));
  logStructured({
    event: "state.list.complete",
    data: { branchCount: branches.length, prCount: pullRequests.length },
  });

  let selected: SelectedActions = {
    closePrs: [...options.closePrs],
    deleteBranches: [...options.deleteBranches],
  };

  const shouldPrompt =
    options.interactive &&
    isTty(args.stdio?.input) &&
    isTty(args.stdio?.output);

  if (shouldPrompt) {
    logStructured({ event: "state.select.interactive" });
    selected = await promptForSelections({
      branches,
      pullRequests,
      input: args.stdio?.input,
      output: args.stdio?.output,
    });
  } else if (options.interactive) {
    logStructured({ event: "state.select.auto_skipped", data: { reason: "non-tty" } });
  }

  logStructured({
    event: "state.select.complete",
    data: { closePrs: selected.closePrs.length, deleteBranches: selected.deleteBranches.length },
  });

  let confirmed = selected.closePrs.length === 0 && selected.deleteBranches.length === 0;
  if (!confirmed) {
    confirmed = options.yes
      ? true
      : await promptForConfirmation({
          message: `Close ${selected.closePrs.length} PR(s) and delete ${selected.deleteBranches.length} branch(es)?`,
          input: args.stdio?.input,
          output: args.stdio?.output,
        });
  }

  if (!confirmed) {
    logStructured({ event: "state.confirm.aborted", level: "warn" });
    await outputResults({
      options,
      inventory: { branches, pullRequests },
      selected,
      results: {
        closedPrs: [],
        deletedBranches: [],
        skippedBranches: [],
      },
      errors: [{ message: "User cancelled operation" }],
    });
    return;
  }

  const execution: ExecutionResults = {
    closedPrs: [],
    deletedBranches: [],
    skippedBranches: [],
  };

  if (selected.closePrs.length > 0) {
    if (options.dryRun) {
      execution.closedPrs = selected.closePrs.map((number) => ({
        number,
        status: "skipped" as const,
        reason: "dry-run",
      }));
    } else {
      execution.closedPrs = await agent.closePullRequests(options.repo, selected.closePrs);
    }
  }

  const branchPlan = computeExecutableActions({
    branches,
    selectedDeleteBranches: selected.deleteBranches,
    dryRun: options.dryRun,
  });
  execution.skippedBranches.push(...branchPlan.skippedBranches);

  if (!options.dryRun && branchPlan.deleteBranches.length > 0) {
    const deletionResults = await agent.deleteBranches(options.repo, branchPlan.deleteBranches);
    execution.deletedBranches.push(...deletionResults);
  }

  await outputResults({
    options,
    inventory: { branches, pullRequests },
    selected,
    results: execution,
    errors: [],
  });
}

interface OutputResultsArgs {
  options: CliOptions;
  inventory: {
    branches: BranchInfo[];
    pullRequests: PullRequestInfo[];
  };
  selected: SelectedActions;
  results: ExecutionResults;
  errors: Array<{ message: string }>;
}

async function outputResults(args: OutputResultsArgs): Promise<void> {
  const { options, inventory, selected, results, errors } = args;
  const payload: ReportPayload = buildReportPayload({
    repo: options.repo,
    options,
    selected,
    results,
    errors,
  });

  await writeAudit(payload);

  if (options.outputMode === "table" || options.outputMode === "both") {
    // eslint-disable-next-line no-console
    console.log("\nBranches\n" + formatBranchTable(inventory.branches));
    // eslint-disable-next-line no-console
    console.log("\nPull Requests\n" + formatPrTable(inventory.pullRequests));
    if (selected.closePrs.length > 0 || selected.deleteBranches.length > 0) {
      // eslint-disable-next-line no-console
      console.log("\nActions Summary\n" + JSON.stringify(results, null, 2));
    }
  }

  if (options.outputMode === "json" || options.outputMode === "both") {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(payload, null, 2));
  }
}

async function writeAudit(payload: ReportPayload): Promise<void> {
  const dir = path.join(process.cwd(), ".repo-tidy");
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, "last_run.json");
  await writeFile(filePath, JSON.stringify(payload, null, 2));
  logStructured({ event: "state.report.audit_written", data: { path: filePath } });
}

function isTty(stream?: NodeJS.ReadableStream | NodeJS.WritableStream): boolean {
  if (!stream) {
    return false;
  }
  const candidate = stream as NodeJS.ReadStream & NodeJS.WriteStream;
  return typeof candidate.isTTY === "boolean" ? Boolean(candidate.isTTY) : false;
}
