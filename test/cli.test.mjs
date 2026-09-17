// End-to-end through the real bin with --dry-run --yes (no prompts, no
// installs, no writes). Covers the three project shapes the epic names plus
// the malformed-package.json path and the arg parser.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "../lib/args.mjs";

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "bin", "create-cia.mjs");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "create-cia-"));

function cli(args, cwd) {
  const r = spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: "utf8", env: { ...process.env, CI: "1" } });
  return { code: r.status, out: r.stdout + r.stderr };
}

test("cli: Next.js fixture — full plan, layout auto-wired", () => {
  const d = tmp();
  fs.mkdirSync(path.join(d, "app"));
  fs.writeFileSync(path.join(d, "package.json"), JSON.stringify({ dependencies: { next: "16", react: "19" } }));
  fs.writeFileSync(path.join(d, "app", "layout.tsx"), "<html lang='en'></html>");
  fs.writeFileSync(path.join(d, "pnpm-lock.yaml"), "");
  const { code, out } = cli([d, "--dry-run", "--yes", "--theme", "sketchbook"], d);
  assert.equal(code, 0, out);
  assert.match(out, /Detected: Next\.js/);
  assert.match(out, /would run\s+pnpm add css-is-awesome/);
  assert.match(out, /would run\s+pnpm add -D sass css-is-awesome-mcp/);
  assert.match(out, /would write\s+app\/styles\/cia\.scss/);
  assert.match(out, /would edit\s+app\/layout\.tsx/);
  assert.match(out, /would merge\s+\.mcp\.json/);
  assert.match(out, /Theme\s+sketchbook/);
  assert.match(out, /Dry run complete/);
  assert.deepEqual(fs.readdirSync(d).sort(), ["app", "package.json", "pnpm-lock.yaml"], "nothing written");
});

test("cli: Vite + React fixture — main.tsx and index.html wired, --no-mcp respected", () => {
  const d = tmp();
  fs.mkdirSync(path.join(d, "src"));
  fs.writeFileSync(path.join(d, "package.json"), JSON.stringify({ dependencies: { react: "19" }, devDependencies: { vite: "7" } }));
  fs.writeFileSync(path.join(d, "src", "main.tsx"), "");
  fs.writeFileSync(path.join(d, "index.html"), "<html></html>");
  const { code, out } = cli(["--dry-run", "--yes", "--no-mcp"], d);
  assert.equal(code, 0, out);
  assert.match(out, /Detected: Vite \+ React/);
  assert.match(out, /would run\s+npm install css-is-awesome/);
  assert.match(out, /would run\s+npm install -D sass\s/);
  assert.doesNotMatch(out, /css-is-awesome-mcp/);
  assert.match(out, /would write\s+src\/styles\/cia\.scss/);
  assert.match(out, /would edit\s+src\/main\.tsx/);
  assert.match(out, /would edit\s+index\.html/);
  assert.match(out, /MCP\s+skipped/);
});

test("cli: empty directory — npm init first, defaults applied, manual wiring printed", () => {
  const d = tmp();
  const { code, out } = cli([d, "--dry-run", "--yes"], d);
  assert.equal(code, 0, out);
  assert.match(out, /No package\.json found/);
  assert.match(out, /would run\s+npm init -y/);
  assert.match(out, /would run\s+npm install css-is-awesome/);
  assert.match(out, /not auto-wired/);
  assert.match(out, /import "css-is-awesome\/themes\/boilerplate";/);
  assert.equal(fs.readdirSync(d).length, 0, "nothing written");
});

test("cli: malformed package.json exits 2 with a clear message", () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, "package.json"), "{ nope");
  const { code, out } = cli(["--dry-run", "--yes"], d);
  assert.equal(code, 2);
  assert.match(out, /package\.json is not valid JSON/);
});

test("cli: unknown theme / framework / pm are rejected", () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, "package.json"), "{}");
  assert.equal(cli(["--dry-run", "--yes", "--theme", "nope"], d).code, 2);
  assert.equal(cli(["--dry-run", "--yes", "--framework", "nope"], d).code, 2);
  assert.equal(cli(["--dry-run", "--yes", "--pm", "nope"], d).code, 2);
});

test("cli: --help and --version", () => {
  const d = tmp();
  const h = cli(["--help"], d);
  assert.equal(h.code, 0);
  assert.match(h.out, /Usage/);
  const v = cli(["--version"], d);
  assert.equal(v.code, 0);
  assert.match(v.out.trim(), /^\d+\.\d+\.\d+/);
});

test("parseArgs: flags, values, positional, errors", () => {
  const a = parseArgs(["proj", "-y", "--dry-run", "--pm=bun", "--theme", "glass", "--framework", "next", "--no-mcp"]);
  assert.equal(a.dir, "proj");
  assert.equal(a.yes, true);
  assert.equal(a.dryRun, true);
  assert.equal(a.pm, "bun");
  assert.equal(a.theme, "glass");
  assert.equal(a.framework, "next");
  assert.equal(a.mcp, false);
  assert.throws(() => parseArgs(["--pm"]), /Missing value/);
  assert.throws(() => parseArgs(["--bogus"]), /Unknown option/);
  assert.throws(() => parseArgs(["a", "b"]), /at most one directory/);
});
