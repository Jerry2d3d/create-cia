#!/usr/bin/env node
import { main } from "../lib/run.mjs";

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error(err?.stack ?? String(err));
    process.exitCode = 1;
  });
