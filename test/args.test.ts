import { describe, expect, it } from "vitest";
import { parseCliArgs } from "../src/cli/args";

describe("parseCliArgs", () => {
  it("parses owner/name repo identifiers", () => {
    const opts = parseCliArgs(["node", "repo-tidy", "--repo", "openai/repo-tidy", "--dry-run", "--output", "both"]);
    expect(opts.repo).toEqual({ owner: "openai", name: "repo-tidy" });
    expect(opts.dryRun).toBe(true);
    expect(opts.outputMode).toBe("both");
  });

  it("parses GitHub URLs", () => {
    const opts = parseCliArgs([
      "node",
      "repo-tidy",
      "--repo",
      "https://github.com/octocat/hello-world",
      "--close-pr",
      "1,2",
      "--delete-branch",
      "feature/foo,bugfix/bar",
    ]);
    expect(opts.repo).toEqual({ owner: "octocat", name: "hello-world" });
    expect(opts.closePrs).toEqual([1, 2]);
    expect(opts.deleteBranches).toEqual(["feature/foo", "bugfix/bar"]);
    expect(opts.interactive).toBe(false);
  });

  it("throws when repo flag missing", () => {
    expect(() => parseCliArgs(["node", "repo-tidy"])).toThrow(/--repo/);
  });

  it("throws on invalid repo identifier", () => {
    expect(() => parseCliArgs(["node", "repo-tidy", "--repo", "badvalue"]))
      .toThrow(/owner\/name/);
  });
});
