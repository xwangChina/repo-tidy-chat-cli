import { describe, expect, it } from "vitest";
import { buildReportPayload, formatBranchTable, formatPrTable } from "../src/run/report";
import type { BranchInfo, PullRequestInfo } from "../src/types/models";

describe("report helpers", () => {
  const branches: BranchInfo[] = [
    {
      name: "main",
      commitSha: "abc123",
      updatedAt: "2024-01-01T00:00:00Z",
      isDefault: true,
      isProtected: true,
    },
    {
      name: "feature/foo",
      commitSha: "def456",
      updatedAt: "2024-02-02T00:00:00Z",
      isDefault: false,
      isProtected: false,
    },
  ];

  const prs: PullRequestInfo[] = [
    {
      number: 17,
      title: "Add new feature",
      state: "open",
      headRef: "feature/foo",
      url: "https://github.com/octocat/hello-world/pull/17",
      draft: false,
    },
  ];

  it("formats branch table", () => {
    const table = formatBranchTable(branches);
    expect(table).toContain("Branch");
    expect(table).toContain("main");
    expect(table).toContain("feature/foo");
    expect(table).toMatch(/default/i);
  });

  it("formats PR table", () => {
    const table = formatPrTable(prs);
    expect(table).toContain("#17");
    expect(table).toContain("Add new feature");
  });

  it("builds JSON payload", () => {
    const payload = buildReportPayload({
      repo: { owner: "octocat", name: "hello-world" },
      options: { dryRun: true, yes: false, outputMode: "both" },
      selected: {
        closePrs: [17],
        deleteBranches: ["feature/foo"],
      },
      results: {
        closedPrs: [
          {
            number: 17,
            status: "skipped",
            reason: "dry-run",
          },
        ],
        deletedBranches: [],
        skippedBranches: [
          {
            name: "main",
            reason: "protected",
          },
        ],
      },
      errors: [],
    });

    expect(payload.repo.fullName).toBe("octocat/hello-world");
    expect(payload.options.dryRun).toBe(true);
    expect(payload.results.skippedBranches).toHaveLength(1);
  });
});
