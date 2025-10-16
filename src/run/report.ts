import type {
  BranchInfo,
  CliOptions,
  ExecutionResults,
  OutputMode,
  PullRequestInfo,
  RepoIdentifier,
  ReportPayload,
  SelectedActions,
} from "../types/models";

interface BuildReportPayloadArgs {
  repo: RepoIdentifier;
  options: Pick<CliOptions, "dryRun" | "yes" | "outputMode">;
  selected: SelectedActions;
  results: ExecutionResults;
  errors: Array<{ message: string }>;
}

function formatTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((header, index) => {
    const columnValues = rows.map((row) => row[index] ?? "");
    const columnLength = Math.max(header.length, ...columnValues.map((value) => value.length));
    return columnLength;
  });

  const renderRow = (cells: string[]): string =>
    cells
      .map((cell, index) => {
        const width = widths[index];
        const padded = cell.padEnd(width, " ");
        return ` ${padded} `;
      })
      .join("|");

  const separator = widths
    .map((width) => "-".repeat(width + 2))
    .join("+");

  const headerRow = renderRow(headers);
  const bodyRows = rows.map((row) => renderRow(row));

  return [headerRow, separator, ...bodyRows].join("\n");
}

function formatFlags(branch: BranchInfo): string {
  const flags: string[] = [];
  if (branch.isDefault) {
    flags.push("default");
  }
  if (branch.isProtected) {
    flags.push("protected");
  }
  return flags.length > 0 ? flags.join(", ") : "";
}

export function formatBranchTable(branches: BranchInfo[]): string {
  if (branches.length === 0) {
    return "No branches found.";
  }
  const headers = ["Branch", "Commit", "Updated", "Flags"];
  const rows = branches.map((branch) => [
    branch.name,
    branch.commitSha,
    new Date(branch.updatedAt).toISOString(),
    formatFlags(branch) || "—",
  ]);
  return formatTable(headers, rows);
}

export function formatPrTable(prs: PullRequestInfo[]): string {
  if (prs.length === 0) {
    return "No open pull requests.";
  }
  const headers = ["PR", "Title", "State", "Head"];
  const rows = prs.map((pr) => [
    `#${pr.number}`,
    pr.title,
    pr.state + (pr.draft ? " (draft)" : ""),
    pr.headRef,
  ]);
  return formatTable(headers, rows);
}

export function buildReportPayload(args: BuildReportPayloadArgs): ReportPayload {
  const { repo, options, selected, results, errors } = args;
  const payload: ReportPayload = {
    timestamp: new Date().toISOString(),
    repo: {
      owner: repo.owner,
      name: repo.name,
      fullName: `${repo.owner}/${repo.name}`,
    },
    options: {
      dryRun: options.dryRun,
      yes: options.yes,
      outputMode: options.outputMode as OutputMode,
    },
    selected,
    results,
    errors,
  };
  return payload;
}

export type { BuildReportPayloadArgs };
