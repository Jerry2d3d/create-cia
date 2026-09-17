// applyPlan against real temp dirs — with the `run` actions stripped, so no
// package manager is spawned and no network is touched.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildPlan, applyPlan, describeAction } from "../lib/plan.mjs";
import { FRAMEWORKS } from "../lib/detect.mjs";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "create-cia-"));
const noRuns = (plan) => ({ ...plan, actions: plan.actions.filter((a) => a.type !== "run") });

function nextFixture() {
  const d = tmp();
  fs.mkdirSync(path.join(d, "app"));
  fs.writeFileSync(path.join(d, "package.json"), JSON.stringify({ dependencies: { next: "16" } }));
  fs.writeFileSync(path.join(d, "app", "layout.tsx"), `export default function L({ children }) {\n  return (<html lang="en"><body>{children}</body></html>);\n}\n`);
  return d;
}

test("buildPlan: Next.js — installs, entry, layout edit, mcp merge", () => {
  const d = nextFixture();
  const ctx = { dir: d, pkg: { dependencies: { next: "16" } }, pkgExists: true, framework: FRAMEWORKS.next, pm: "pnpm", theme: "sketchbook", mcp: true };
  const plan = buildPlan(ctx);
  const lines = plan.actions.map(describeAction);
  assert.match(lines[0], /^run\s+pnpm add css-is-awesome/);
  assert.match(lines[1], /^run\s+pnpm add -D sass css-is-awesome-mcp/);
  assert.match(lines[2], /^write\s+app\/styles\/cia\.scss/);
  assert.match(lines[3], /^edit\s+app\/layout\.tsx/);
  assert.match(lines[4], /^merge\s+\.mcp\.json/);
  assert.equal(plan.manual.length, 0);
});

test("buildPlan: skips packages already installed, angular needs no sass, --no-mcp drops the merge", () => {
  const d = tmp();
  const pkg = { dependencies: { "@angular/core": "20", "css-is-awesome": "1.0.0" } };
  const plan = buildPlan({ dir: d, pkg, pkgExists: true, framework: FRAMEWORKS.angular, pm: "npm", theme: "prism", mcp: false });
  assert.deepEqual(plan.actions.filter((a) => a.type === "run"), []);
  assert.ok(plan.actions.every((a) => a.type !== "json"));
  assert.ok(plan.manual.length > 0, "angular is not auto-wired, so manual steps are printed");
});

test("buildPlan: no package.json → npm init first", () => {
  const d = tmp();
  const plan = buildPlan({ dir: d, pkg: null, pkgExists: false, framework: FRAMEWORKS["vite-react"], pm: "npm", theme: "boilerplate", mcp: true });
  assert.match(describeAction(plan.actions[0]), /^run\s+npm init -y/);
});

test("applyPlan: writes the entry, wires the layout, merges .mcp.json; second run is a no-op", async () => {
  const d = nextFixture();
  fs.writeFileSync(path.join(d, ".mcp.json"), JSON.stringify({ mcpServers: { keep: { command: "k" } } }));
  const ctx = { dir: d, pkg: { dependencies: { next: "16" } }, pkgExists: true, framework: FRAMEWORKS.next, pm: "npm", theme: "glass", mcp: true };
  const plan = noRuns(buildPlan(ctx));
  const log1 = [];
  const r1 = await applyPlan(plan, { dir: d, dryRun: false, log: (l) => log1.push(l) });
  assert.deepEqual(r1.map((r) => r.status), ["written", "edited", "merged"]);

  const entry = fs.readFileSync(path.join(d, "app", "styles", "cia.scss"), "utf8");
  assert.match(entry, /@use 'css-is-awesome';/);
  const layout = fs.readFileSync(path.join(d, "app", "layout.tsx"), "utf8");
  assert.match(layout, /^import "css-is-awesome\/themes\/glass";\nimport "\.\/styles\/cia\.scss";\n/);
  assert.match(layout, /<html data-theme="glass" lang="en">/);
  const mcp = JSON.parse(fs.readFileSync(path.join(d, ".mcp.json"), "utf8"));
  assert.deepEqual(mcp.mcpServers.keep, { command: "k" });
  assert.deepEqual(mcp.mcpServers["css-is-awesome"], { command: "npx", args: ["-y", "css-is-awesome-mcp"] });

  const r2 = await applyPlan(plan, { dir: d, dryRun: false });
  assert.deepEqual(r2.map((r) => r.status), ["skipped", "skipped", "skipped"]);
  assert.equal(fs.readFileSync(path.join(d, "app", "layout.tsx"), "utf8"), layout, "layout untouched on re-run");
});

test("applyPlan: never overwrites an existing cia.scss", async () => {
  const d = nextFixture();
  fs.mkdirSync(path.join(d, "app", "styles"));
  fs.writeFileSync(path.join(d, "app", "styles", "cia.scss"), "// mine\n");
  const plan = noRuns(buildPlan({ dir: d, pkg: {}, pkgExists: true, framework: FRAMEWORKS.next, pm: "npm", theme: "press", mcp: false }));
  await applyPlan(plan, { dir: d, dryRun: false });
  assert.equal(fs.readFileSync(path.join(d, "app", "styles", "cia.scss"), "utf8"), "// mine\n");
});

test("applyPlan: dryRun touches nothing", async () => {
  const d = nextFixture();
  const before = fs.readdirSync(d).sort();
  const plan = buildPlan({ dir: d, pkg: {}, pkgExists: true, framework: FRAMEWORKS.next, pm: "npm", theme: "press", mcp: true });
  const log = [];
  await applyPlan(plan, { dir: d, dryRun: true, log: (l) => log.push(l) });
  assert.deepEqual(fs.readdirSync(d).sort(), before);
  assert.ok(log.every((l) => l.startsWith("would ")));
});
