import { RunSummary } from '../types.js';

function formatAction(action: RunSummary['actions'][number]['action']): string {
  if (action.type === 'close-pr') {
    return `close-pr #${action.prNumber}`;
  }
  return `delete-branch ${action.branch}`;
}

function tableFromRows(title: string, rows: string[][]): string {
  if (rows.length === 0) {
    return `${title}: none`;
  }

  const columnWidths = rows[0].map((_, colIndex) =>
    Math.max(...rows.map((row) => row[colIndex].length))
  );

  const formattedRows = rows.map((row) =>
    row
      .map((cell, index) => cell.padEnd(columnWidths[index]))
      .join(' | ')
      .trim()
  );

  return `${title}\n${formattedRows.join('\n')}`;
}

export function buildHumanReport(summary: RunSummary): string {
  const lines: string[] = [];
  lines.push('Repo Tidy Summary');
  lines.push(`Repository: ${summary.repo.owner}/${summary.repo.name}`);
  lines.push(`Dry run: ${summary.dryRun ? 'yes' : 'no'}`);
  lines.push(`Started: ${summary.startedAt}`);
  lines.push(`Completed: ${summary.completedAt}`);
  lines.push('');

  const actionRows = summary.actions.map((entry) => [
    formatAction(entry.action),
    entry.status.toUpperCase(),
    entry.message ?? '',
  ]);
  if (actionRows.length > 0) {
    lines.push(tableFromRows('Actions', [['Action', 'Status', 'Message'], ...actionRows]));
  } else {
    lines.push('Actions: none');
  }

  const skippedRows = summary.skipped.map((skip) => [
    formatAction(skip.action),
    'SKIPPED',
    skip.reason,
  ]);
  if (skippedRows.length > 0) {
    lines.push('');
    lines.push(tableFromRows('Skipped', [['Action', 'Status', 'Reason'], ...skippedRows]));
  }

  if (summary.errors.length > 0) {
    lines.push('');
    lines.push('Errors:');
    summary.errors.forEach((error) => lines.push(`- ${error}`));
  }

  return lines.join('\n');
}

export function buildJsonSummary(summary: RunSummary) {
  return {
    repo: summary.repo,
    dryRun: summary.dryRun,
    startedAt: summary.startedAt,
    completedAt: summary.completedAt,
    listing: summary.listing,
    plannedActions: summary.plannedActions,
    actions: summary.actions,
    skipped: summary.skipped,
    errors: summary.errors,
  };
}
