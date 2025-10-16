import * as readline from 'node:readline/promises';
import { stdin as defaultInput, stdout as defaultOutput } from 'node:process';
import { RepoTidyUI, AgentListResponse, Selection, ActionPlan, Logger } from '../types.js';

function formatTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => row[index]?.length ?? 0))
  );

  const renderRow = (cells: string[]) =>
    cells
      .map((cell, index) => cell.padEnd(widths[index]))
      .join(' | ')
      .trim();

  const table = [renderRow(headers)];
  table.push(widths.map((width) => ''.padEnd(width, '-')).join('-+-'));
  rows.forEach((row) => table.push(renderRow(row)));
  return table.join('\n');
}

function parseNumbers(input: string): number[] {
  return input
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => Number.parseInt(part, 10))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function parseStrings(input: string): string[] {
  return input
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

class InteractiveUI implements RepoTidyUI {
  private rl: readline.Interface;

  constructor(
    private readonly logger: Logger,
    input = defaultInput,
    output = defaultOutput
  ) {
    this.rl = readline.createInterface({ input, output });
  }

  async presentListing(listing: AgentListResponse): Promise<void> {
    defaultOutput.write('\nBranches\n');
    const branchRows = listing.branches.map((branch) => [
      branch.name,
      branch.isDefault ? 'default' : '',
      branch.isProtected ? 'protected' : '',
      branch.lastCommitSha.slice(0, 7),
      new Date(branch.lastCommitAt).toISOString(),
      branch.linkedPullRequestNumbers.join(', ') || '—',
    ]);
    if (branchRows.length > 0) {
      defaultOutput.write(
        `${formatTable(['Name', 'Default', 'Protected', 'Last SHA', 'Last Commit', 'Linked PRs'], branchRows)}\n`
      );
    } else {
      defaultOutput.write('No branches returned by MCP.\n');
    }

    defaultOutput.write('\nOpen Pull Requests\n');
    const prRows = listing.pullRequests.map((pr) => [
      `#${pr.number}`,
      pr.title,
      pr.headRef,
      pr.state,
      pr.canClose ? 'closable' : 'locked',
    ]);
    if (prRows.length > 0) {
      defaultOutput.write(
        `${formatTable(['Number', 'Title', 'Head', 'State', 'Close?'], prRows)}\n`
      );
    } else {
      defaultOutput.write('No open pull requests.\n');
    }
  }

  async promptForSelection(listing: AgentListResponse): Promise<Selection> {
    const prAnswer = await this.rl.question(
      '\nEnter PR numbers to close (comma separated, leave blank to skip): '
    );
    const branchAnswer = await this.rl.question(
      'Enter branch names to delete (comma separated, leave blank to skip): '
    );

    const closePrNumbers = prAnswer ? parseNumbers(prAnswer) : [];
    const deleteBranches = branchAnswer ? parseStrings(branchAnswer) : [];

    this.logger.debug('ui-selection', {
      closePrCount: closePrNumbers.length,
      deleteBranchCount: deleteBranches.length,
    });

    return { closePrNumbers, deleteBranches };
  }

  async confirmExecution(plan: ActionPlan): Promise<boolean> {
    if (plan.actions.length === 0) {
      return true;
    }
    const answer = await this.rl.question(
      `\nAbout to ${plan.dryRun ? 'simulate' : 'execute'} ${plan.actions.length} action(s). Proceed? (y/N): `
    );
    const normalized = answer.trim().toLowerCase();
    return normalized === 'y' || normalized === 'yes';
  }

  notifySkipped(skip: {
    type: 'delete-branch' | 'close-pr';
    target: string | number;
    reason: string;
  }): void {
    defaultOutput.write(
      `Skipping ${skip.type === 'delete-branch' ? 'branch' : 'PR'} ${skip.target}: ${skip.reason}\n`
    );
  }

  dispose(): void {
    this.rl.close();
  }
}

class NonInteractiveUI implements RepoTidyUI {
  constructor(private readonly logger: Logger) {}

  async presentListing(listing: AgentListResponse): Promise<void> {
    // In non-interactive mode we still print a concise summary for logging.
    this.logger.info('listing', {
      branchCount: listing.branches.length,
      pullRequestCount: listing.pullRequests.length,
    });
  }

  async promptForSelection(_listing: AgentListResponse): Promise<Selection> {
    throw new Error(
      'Cannot prompt for selections in non-interactive mode. Provide --close-pr/--delete-branch flags.'
    );
  }

  async confirmExecution(_plan: ActionPlan): Promise<boolean> {
    return true;
  }

  notifySkipped(skip: {
    type: 'delete-branch' | 'close-pr';
    target: string | number;
    reason: string;
  }): void {
    this.logger.warn('skip', skip as Record<string, unknown>);
  }
}

export function createUi(logger: Logger, interactive: boolean): RepoTidyUI {
  if (interactive) {
    return new InteractiveUI(logger);
  }
  return new NonInteractiveUI(logger);
}
