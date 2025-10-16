#!/usr/bin/env node
import { logStructured } from "../src/logging/structured";
import { runCli } from "../src/run/stateMachine";

runCli(process.argv).catch((error) => {
  logStructured({ event: "cli.error", level: "error", error: error as Error });
  process.exitCode = 1;
});
