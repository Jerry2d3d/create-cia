// A plan is a list of actions computed from the answers. `--dry-run` prints
// it; a real run applies it. Keeping the two apart is what makes the wizard
// testable without touching the network.
import fs from "node:fs";
import path from "node:path";
import { hasDependency } from "./detect.mjs";
import { addCommand, initCommand, formatCommand, run } from "./install.mjs";
import {
  findLayout,
  injectDataTheme,
  injectImports,
  mergeMcpConfig,
  relativeImport,
  scssEntryContent,
  scssEntryPath,
  themeImportSpecifier,
  themeLinkTag,
} from "./wire.mjs";

/**
 * @param {object} ctx  { dir, pkg, pkgExists, framework, pm, theme, mcp }
 * @returns {{ actions: Action[], entryFile: string, layout: object|null, manual: string[] }}
 *
 * Action shapes:
 *   { type: "run",   cmd: [bin, args], why }
 *   { type: "write", file, content, why }          // only when file is absent
 *   { type: "edit",  file, apply: (src) => ({ source, changed, note }), why }
 *   { type: "json",  file, merge: (obj) => ({ config, changed }), why }
 */
export function buildPlan(ctx) {
  const { dir, pkg, pkgExists, framework, pm, theme, mcp } = ctx;
  const actions = [];
  const manual = [];

  if (!pkgExists) {
    actions.push({ type: "run", cmd: initCommand(), why: "no package.json here — create one first" });
  }

  // ── installs ────────────────────────────────────────────────────────────
  const deps = [];
  if (!hasDependency(pkg, "css-is-awesome")) deps.push("css-is-awesome");
  if (deps.length) actions.push({ type: "run", cmd: addCommand(pm, deps), why: "the design system" });

  const devDeps = [];
  const needsSass = framework?.id !== "angular"; // Angular CLI bundles its own Sass
  if (needsSass && !hasDependency(pkg, "sass") && !hasDependency(pkg, "sass-embedded")) devDeps.push("sass");
  if (mcp && !hasDependency(pkg, "css-is-awesome-mcp")) devDeps.push("css-is-awesome-mcp");
  if (devDeps.length) {
    actions.push({
      type: "run",
      cmd: addCommand(pm, devDeps, { dev: true }),
      why: devDeps.includes("sass") ? "SCSS compiler + tooling (dev only)" : "tooling (dev only)",
    });
  }

  // ── SCSS entry (never overwrite) ────────────────────────────────────────
  const entryFile = scssEntryPath(framework, dir);
  actions.push({
    type: "write",
    file: entryFile,
    content: scssEntryContent(),
    why: "root stylesheet — the `@use 'css-is-awesome'` half of the two-import model",
  });

  // ── layout wiring ───────────────────────────────────────────────────────
  const layout = findLayout(framework, dir);
  const themeSpec = themeImportSpecifier(theme);
  if (layout?.kind === "next-layout") {
    const entryImport = relativeImport(layout.file, entryFile);
    actions.push({
      type: "edit",
      file: layout.file,
      why: `import the theme + root stylesheet, set data-theme="${theme}" on <html>`,
      apply: (src) => {
        const a = injectImports(src, [themeSpec, entryImport]);
        const b = injectDataTheme(a.source, theme);
        const notes = [];
        if (a.added.length) notes.push(`added ${a.added.map((s) => `import "${s}"`).join(", ")}`);
        if (b.added) notes.push(`added data-theme="${theme}"`);
        return { source: b.source, changed: a.added.length > 0 || b.added, note: notes.join("; ") || "already wired" };
      },
    });
  } else if (layout?.kind === "vite-main") {
    const entryImport = relativeImport(layout.file, entryFile);
    actions.push({
      type: "edit",
      file: layout.file,
      why: "import the theme + root stylesheet",
      apply: (src) => {
        const a = injectImports(src, [themeSpec, entryImport]);
        return { source: a.source, changed: a.added.length > 0, note: a.added.length ? `added ${a.added.map((s) => `import "${s}"`).join(", ")}` : "already wired" };
      },
    });
    if (layout.html) {
      actions.push({
        type: "edit",
        file: layout.html,
        why: `set data-theme="${theme}" on <html>`,
        apply: (src) => {
          const b = injectDataTheme(src, theme);
          return { source: b.source, changed: b.added, note: b.added ? `added data-theme="${theme}"` : "already set" };
        },
      });
    }
  } else {
    manual.push(
      `Import the theme and the root stylesheet once, from your root layout / main entry:`,
      `  import "${themeSpec}";`,
      `  import "./${toPosix(entryFile)}";   // adjust the relative path`,
      `Or, without a bundler, link the theme directly:`,
      `  ${themeLinkTag(theme)}`,
      `Then set <html data-theme="${theme}"> (optional for a single theme file, required for the all-in-one bundle).`,
    );
  }

  // ── MCP for AI agents ───────────────────────────────────────────────────
  if (mcp) {
    actions.push({
      type: "json",
      file: ".mcp.json",
      why: "connect AI agents (Claude Code, Cursor, …) to cia's real API via css-is-awesome-mcp",
      merge: mergeMcpConfig,
    });
  }

  return { actions, entryFile, layout, manual };
}

/** Human-readable line per action, used by --dry-run and the summary. */
export function describeAction(a) {
  switch (a.type) {
    case "run":
      return `run    ${formatCommand(a.cmd)}   — ${a.why}`;
    case "write":
      return `write  ${toPosix(a.file)}   — ${a.why}`;
    case "edit":
      return `edit   ${toPosix(a.file)}   — ${a.why}`;
    case "json":
      return `merge  ${toPosix(a.file)}   — ${a.why}`;
    default:
      return JSON.stringify(a);
  }
}

/**
 * Apply the plan. `log(line)` receives one line per action outcome.
 * With `dryRun`, nothing is written or spawned.
 */
export async function applyPlan(plan, { dir, dryRun, log = () => {} }) {
  const results = [];
  for (const a of plan.actions) {
    const abs = a.file ? path.join(dir, a.file) : null;
    if (dryRun) {
      log(`would ${describeAction(a)}`);
      results.push({ action: a, status: "planned" });
      continue;
    }
    if (a.type === "run") {
      log(`→ ${formatCommand(a.cmd)}`);
      await run(a.cmd, dir);
      results.push({ action: a, status: "ran" });
    } else if (a.type === "write") {
      if (fs.existsSync(abs)) {
        log(`skip   ${toPosix(a.file)} (already exists — left untouched)`);
        results.push({ action: a, status: "skipped" });
      } else {
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, a.content, "utf8");
        log(`wrote  ${toPosix(a.file)}`);
        results.push({ action: a, status: "written" });
      }
    } else if (a.type === "edit") {
      const src = fs.readFileSync(abs, "utf8");
      const { source, changed, note } = a.apply(src);
      if (changed) {
        fs.writeFileSync(abs, source, "utf8");
        log(`edited ${toPosix(a.file)} (${note})`);
        results.push({ action: a, status: "edited", note });
      } else {
        log(`skip   ${toPosix(a.file)} (${note})`);
        results.push({ action: a, status: "skipped", note });
      }
    } else if (a.type === "json") {
      let existing = {};
      if (fs.existsSync(abs)) {
        try {
          existing = JSON.parse(fs.readFileSync(abs, "utf8"));
        } catch {
          log(`skip   ${toPosix(a.file)} (not valid JSON — add the css-is-awesome server by hand)`);
          results.push({ action: a, status: "skipped", note: "invalid json" });
          continue;
        }
      }
      const { config, changed } = a.merge(existing);
      if (changed) {
        fs.writeFileSync(abs, JSON.stringify(config, null, 2) + "\n", "utf8");
        log(`merged ${toPosix(a.file)} (css-is-awesome server added)`);
        results.push({ action: a, status: "merged" });
      } else {
        log(`skip   ${toPosix(a.file)} (css-is-awesome server already present)`);
        results.push({ action: a, status: "skipped" });
      }
    }
  }
  return results;
}

function toPosix(p) {
  return String(p).split(path.sep).join("/");
}
