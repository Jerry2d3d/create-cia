// Orchestration: gather context, ask (or default), build the plan, apply it.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import * as p from "@clack/prompts";
import { parseArgs, USAGE } from "./args.mjs";
import { detectFramework, detectPackageManager, readPackageJson, FRAMEWORKS, FRAMEWORK_CHOICES } from "./detect.mjs";
import { DEFAULT_THEME, isKnownTheme, themeChoices } from "./themes.mjs";
import { buildPlan, applyPlan, describeAction } from "./plan.mjs";
import { buildSummary, buildNextSteps } from "./summary.mjs";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

function bail(v) {
  if (p.isCancel(v)) {
    p.cancel("Cancelled — nothing was changed.");
    process.exit(130);
  }
  return v;
}

export async function main(argv = process.argv.slice(2)) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    console.error(err.message);
    return 2;
  }
  if (args.help) {
    console.log(USAGE);
    return 0;
  }
  if (args.version) {
    console.log(version);
    return 0;
  }

  const dir = path.resolve(args.dir);
  if (!fs.existsSync(dir)) {
    console.error(`Directory does not exist: ${dir}`);
    return 2;
  }
  const interactive = !args.yes && process.stdin.isTTY && !process.env.CI;

  p.intro(`create-cia v${version}${args.dryRun ? "  (dry run — nothing will be changed)" : ""}`);

  // ── context ─────────────────────────────────────────────────────────────
  const pkgInfo = readPackageJson(dir);
  if (pkgInfo.error) {
    p.log.error(pkgInfo.error);
    p.outro("Fix package.json and run create-cia again.");
    return 2;
  }
  const pkg = pkgInfo.pkg;
  let framework = args.framework ? FRAMEWORKS[args.framework] ?? null : detectFramework(pkg);
  if (args.framework && !framework) {
    p.log.error(`Unknown --framework "${args.framework}". Known: ${Object.keys(FRAMEWORKS).join(", ")}`);
    return 2;
  }
  const detectedPm = detectPackageManager(dir, pkg);
  const pm = args.pm ?? detectedPm.id;

  if (!pkgInfo.exists) {
    p.log.warn("No package.json found — this looks like a new directory.");
    if (interactive) {
      const ok = bail(await p.confirm({ message: "Run `npm init -y` first, then continue?", initialValue: true }));
      if (!ok) {
        p.outro("create-cia wires existing projects. Create one first, then run it again.");
        return 0;
      }
    } else {
      p.log.info("Will run `npm init -y` first (use --yes to accept defaults).");
    }
  }

  // ── framework ───────────────────────────────────────────────────────────
  if (framework) {
    p.log.info(`Detected: ${framework.label}${detectedPm.source !== "default" ? ` · ${pm} (${detectedPm.source})` : ""}`);
    if (interactive && !args.framework) {
      const keep = bail(await p.confirm({ message: `Detected: ${framework.label} — use this?`, initialValue: true }));
      if (!keep) framework = null;
    }
  }
  if (!framework) {
    if (interactive) {
      const id = bail(await p.select({ message: "Which framework?", options: FRAMEWORK_CHOICES, initialValue: "vite-react" }));
      framework = FRAMEWORKS[id];
    } else {
      framework = pkgInfo.exists ? FRAMEWORKS.vanilla : FRAMEWORKS["vite-react"];
      p.log.info(`Framework not detected — assuming ${framework.label} (pass --framework to override).`);
    }
  }

  // ── theme ───────────────────────────────────────────────────────────────
  let theme = args.theme;
  if (theme && !isKnownTheme(theme, dir)) {
    p.log.error(`Unknown theme "${theme}". Families: ${themeChoices().map((t) => t.value).join(", ")} (plus -light / -dark variants).`);
    return 2;
  }
  if (!theme) {
    if (interactive) {
      theme = bail(await p.select({ message: "Which theme to start with?", options: themeChoices(), initialValue: DEFAULT_THEME, maxItems: 8 }));
    } else {
      theme = DEFAULT_THEME;
    }
  }

  // ── MCP ─────────────────────────────────────────────────────────────────
  let mcp = args.mcp;
  if (interactive && argv.every((a) => a !== "--no-mcp" && a !== "--mcp")) {
    mcp = bail(await p.confirm({ message: "Wire the MCP server so AI agents (Claude Code, Cursor, …) read cia's real API?", initialValue: true }));
  }

  // ── plan + apply ────────────────────────────────────────────────────────
  const ctx = { dir, pkg, pkgExists: pkgInfo.exists, framework, pm, theme, mcp };
  const plan = buildPlan(ctx);

  p.log.step(args.dryRun ? "Plan" : "Applying");
  const log = (line) => p.log.message(line, { spacing: 0 });
  if (args.dryRun) {
    for (const a of plan.actions) log(`would ${describeAction(a)}`);
  }
  let results;
  try {
    results = args.dryRun ? plan.actions.map((action) => ({ action, status: "planned" })) : await applyPlan(plan, { dir, dryRun: false, log });
  } catch (err) {
    p.log.error(err.message);
    p.outro("Install failed — fix the error above and run create-cia again. Files already written are safe to keep.");
    return 1;
  }

  p.note(buildSummary({ ctx, plan, results }), args.dryRun ? "Summary (dry run)" : "Summary");
  p.note(buildNextSteps({ ctx, plan }).join("\n\n"), "Next steps");
  p.outro(args.dryRun ? "Dry run complete — nothing was changed." : "cia is wired. Go build something.");
  return 0;
}
