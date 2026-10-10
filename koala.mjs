#!/usr/bin/env node
import { buildClientProgram } from "./src/client.mjs";
buildClientProgram().then((program) => program.parseAsync(process.argv)).catch((err) => {
  console.error(err instanceof Error ? err.message : "couldn't show task status.");
  process.exitCode = 1;
});
