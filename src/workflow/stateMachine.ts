import {
  ActionExecutionResult,
  ActionPlan,
  Logger,
  RepoAction,
  RepoIdentifier,
  RepoTidyAgent,
  RepoTidyUI,
  Reporter,
  RunSummary,
  Selection,
  SkippedAction,
} from '../types.js';

export interface WorkflowOptions {
  repo: RepoIdentifier;
  dryRun: boolean;
  assumeYes: boolean;
  preselected: Selection;
  outputMode: 'table' | 'json' | 'both';
}

export interface WorkflowDependencies {
  agent: RepoTidyAgent;
  ui: RepoTidyUI;
  reporter: Reporter;
  logger: Logger;
  now: () => Date;
}

const SKIP_PROTECTED_REASON = 'Branch is protected or default and cannot be deleted.';

function buildActionKey(action: RepoAction): string {
  if (action.type === 'close-pr') {
    return `close-pr-${action.prNumber}`;
  }
  return `delete-branch-${action.branch}`;
}

export async function runRepoTidyWorkflow(
  options: WorkflowOptions,
  deps: WorkflowDependencies
): Promise<RunSummary> {
  const { repo, dryRun, assumeYes, preselected } = options;
  const { agent, ui, reporter, logger, now } = deps;

  const startedAt = now().toISOString();
  logger.info('state=LIST start', { repo });

  const listing = await agent.listRepository(repo);
  await Promise.resolve(ui.presentListing(listing));

  let selection: Selection = preselected;
  const needsPrompt =
    preselected.closePrNumbers.length === 0 && preselected.deleteBranches.length === 0;

  if (needsPrompt) {
    logger.info('state=SELECT prompt', { repo });
    selection = await ui.promptForSelection(listing);
  }

  const combinedSelection: Selection = {
    closePrNumbers: Array.from(
      new Set([...preselected.closePrNumbers, ...selection.closePrNumbers])
    ),
    deleteBranches: Array.from(
      new Set([...preselected.deleteBranches, ...selection.deleteBranches])
    ),
  };

  const plannedActions: RepoAction[] = [];
  const skipped: SkippedAction[] = [];

  const branchMap = new Map(listing.branches.map((branch) => [branch.name, branch]));
  const prMap = new Map(listing.pullRequests.map((pr) => [pr.number, pr]));

  const notifySkip = (action: RepoAction, reason: string) => {
    skipped.push({ action, reason });
    if (action.type === 'delete-branch') {
      ui.notifySkipped({ type: 'delete-branch', target: action.branch, reason });
    } else {
      ui.notifySkipped({ type: 'close-pr', target: action.prNumber, reason });
    }
    logger.warn('action=skip', { action, reason });
  };

  for (const prNumber of combinedSelection.closePrNumbers) {
    const action: RepoAction = { type: 'close-pr', prNumber };
    const pr = prMap.get(prNumber);
    if (!pr) {
      notifySkip(action, 'Pull request not found in listing.');
      continue;
    }
    if (!pr.canClose || pr.state !== 'open') {
      notifySkip(action, 'Pull request is already closed or cannot be closed.');
      continue;
    }
    plannedActions.push(action);
  }

  for (const branchName of combinedSelection.deleteBranches) {
    const action: RepoAction = { type: 'delete-branch', branch: branchName };
    const branchInfo = branchMap.get(branchName);
    if (!branchInfo) {
      notifySkip(action, 'Branch not found in listing.');
      continue;
    }
    if (branchInfo.isDefault || branchInfo.isProtected) {
      notifySkip(action, SKIP_PROTECTED_REASON);
      continue;
    }
    plannedActions.push(action);
  }

  const uniquePlannedActions = Array.from(
    new Map(plannedActions.map((action) => [buildActionKey(action), action])).values()
  );

  const summary: RunSummary = {
    repo,
    dryRun,
    startedAt,
    completedAt: startedAt,
    listing,
    plannedActions: uniquePlannedActions,
    actions: [],
    skipped,
    errors: [],
  };

  const plan: ActionPlan = {
    repo,
    actions: uniquePlannedActions,
    dryRun,
  };

  reporter.recordPlan(plan, summary);

  if (uniquePlannedActions.length === 0) {
    logger.info('state=REPORT no-actions', { repo });
    summary.completedAt = now().toISOString();
    await Promise.resolve(reporter.finalize(summary));
    return summary;
  }

  let confirmed = assumeYes || dryRun;
  if (!confirmed) {
    logger.info('state=CONFIRM prompt', { repo, actionCount: uniquePlannedActions.length });
    confirmed = await ui.confirmExecution(plan);
  }

  if (!confirmed) {
    logger.warn('state=EXECUTE aborted', { repo });
    summary.errors.push('User declined confirmation');
    summary.completedAt = now().toISOString();
    await Promise.resolve(reporter.finalize(summary));
    return summary;
  }

  if (dryRun) {
    logger.info('state=EXECUTE dry-run', { repo, actionCount: uniquePlannedActions.length });
    summary.actions = uniquePlannedActions.map((action): ActionExecutionResult => ({
      action,
      status: 'dry-run',
    }));
    summary.completedAt = now().toISOString();
    summary.actions.forEach((result) => reporter.recordResult(result, summary));
    await Promise.resolve(reporter.finalize(summary));
    return summary;
  }

  logger.info('state=EXECUTE apply', { repo, actionCount: uniquePlannedActions.length });
  try {
    const execution = await agent.executePlan(plan);
    summary.actions = execution.actions;
    execution.actions.forEach((result) => reporter.recordResult(result, summary));
    if (execution.errors) {
      summary.errors.push(...execution.errors);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error executing plan';
    summary.errors.push(message);
    logger.error('execution-error', { repo, message });
  }

  summary.completedAt = now().toISOString();
  await Promise.resolve(reporter.finalize(summary));
  return summary;
}
