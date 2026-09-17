// The closing summary: what was installed/written and what to do next.
import fs from "node:fs";
import path from "node:path";

const toPosix = (p) => String(p).split(path.sep).join("/");

export function buildSummary({ ctx, plan, results }) {
  const installed = plan.actions
    .filter((a) => a.type === "run" && a.cmd[1][0] !== "init")
    .flatMap((a) => a.cmd[1].filter((x) => !x.startsWith("-") && !["install", "add"].includes(x)));
  const lines = [];
  lines.push(`Framework        ${ctx.framework?.label ?? "not detected"}`);
  lines.push(`Package manager  ${ctx.pm}`);
  lines.push(`Theme            ${ctx.theme}`);
  lines.push(`Packages         ${installed.length ? installed.join(", ") : "nothing new (already installed)"}`);
  lines.push(`SCSS entry       ${toPosix(plan.entryFile)}`);
  lines.push(`Layout           ${plan.layout ? toPosix(plan.layout.file) : "not auto-wired (see Next steps)"}`);
  lines.push(`MCP              ${ctx.mcp ? ".mcp.json → npx css-is-awesome-mcp" : "skipped"}`);
  if (results?.some((r) => r.status === "skipped")) {
    lines.push("");
    lines.push("Some files already existed and were left untouched (listed above).");
  }
  return lines.join("\n");
}

export function buildNextSteps({ ctx, plan }) {
  const steps = [];
  if (plan.manual.length) steps.push(plan.manual.join("\n"));
  steps.push(
    `Your first cia button (~30 seconds):\n` +
      `  // Button.module.scss\n` +
      `  @use 'css-is-awesome/api' as cia;\n` +
      `  .btn { @include cia.btn(primary); }\n` +
      `  <button class="btn">Hello cia</button>`,
  );
  steps.push(`Try another theme any time: swap "${ctx.theme}" for sketchbook, press, prism, cupertino, glass, graphite or terminal.`);
  if (ctx.mcp) steps.push(`Ask your AI agent for real signatures: it can call list_mixins / get_recipe over MCP now.`);
  const recipes = countRecipes(ctx.dir);
  steps.push(`Browse the recipe book: npx cia add --list${recipes ? `   (${recipes} copy-paste patterns)` : ""}`);
  steps.push(`Docs for your theme + setup: https://cssisawesome.com/docs/install/`);
  return steps;
}

/**
 * Count the recipes shipped by the INSTALLED css-is-awesome (scss/recipes/*.md,
 * same skip rule as the package's own loaders: no `_` prefix, no README). The
 * number grows with every recipe, so it is never hard-coded here; when the
 * package isn't installed yet (dry run) the step simply omits it.
 */
export function countRecipes(cwd = process.cwd()) {
  try {
    const dir = path.join(cwd, "node_modules", "css-is-awesome", "scss", "recipes");
    return fs.readdirSync(dir).filter((f) => f.endsWith(".md") && !f.startsWith("_") && f !== "README.md").length;
  } catch {
    return 0;
  }
}
