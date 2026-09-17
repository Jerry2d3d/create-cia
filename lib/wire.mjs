// Wiring: where the SCSS entry goes, what it contains, and how the theme +
// entry get connected to the root layout. Every function here is pure or
// returns a description; plan.mjs applies them.
import fs from "node:fs";
import path from "node:path";

const exists = (p) => fs.existsSync(p);

/**
 * The two-import model, exactly as css-is-awesome's README/AGENTS document it:
 * the ROOT stylesheet emits tokens + base once via `@use 'css-is-awesome'`;
 * every component uses the zero-emit `/api` barrel.
 */
export function scssEntryContent() {
  return `// cia.scss — the ROOT stylesheet. Import this file exactly ONCE, from your
// root layout / main entry. It emits the tokens, resets and base rules.
@use 'css-is-awesome';

// Two imports, two jobs. In each COMPONENT stylesheet (Card.module.scss, …)
// use the zero-emit authoring barrel instead, and only call mixins:
//
//   @use 'css-is-awesome/api' as cia;
//   .card { @include cia.card-base; }
//
// Never \`@use 'css-is-awesome'\` (the bundle) from a component file — it
// re-emits :root, which CSS Modules pure mode rejects.
// Docs: https://cssisawesome.com/docs/install/
`;
}

/** Where the root SCSS entry lives for each framework. */
export function scssEntryPath(framework, dir) {
  const id = framework?.id ?? "vanilla";
  if (id === "next") {
    if (exists(path.join(dir, "src", "app"))) return path.join("src", "app", "styles", "cia.scss");
    if (exists(path.join(dir, "app"))) return path.join("app", "styles", "cia.scss");
    return path.join("styles", "cia.scss"); // pages router or unknown layout
  }
  if (id === "remix") return path.join("app", "styles", "cia.scss");
  if (id === "nuxt") return path.join("assets", "styles", "cia.scss");
  if (id === "vanilla" && !exists(path.join(dir, "src"))) return path.join("styles", "cia.scss");
  return path.join("src", "styles", "cia.scss");
}

/**
 * Find the file that should import the theme + entry, per framework.
 * Returns { file, kind } or null when we aren't confident.
 *   kind: "next-layout" | "vite-main" | "vite-html"
 */
export function findLayout(framework, dir) {
  const id = framework?.id ?? "vanilla";
  const first = (cands) => cands.find((c) => exists(path.join(dir, c))) ?? null;
  if (id === "next") {
    const file = first([
      "app/layout.tsx", "app/layout.jsx", "app/layout.js",
      "src/app/layout.tsx", "src/app/layout.jsx", "src/app/layout.js",
    ]);
    return file ? { file, kind: "next-layout" } : null;
  }
  if (id.startsWith("vite")) {
    const main = first(["src/main.tsx", "src/main.ts", "src/main.jsx", "src/main.js"]);
    const html = first(["index.html"]);
    return main ? { file: main, kind: "vite-main", html } : null;
  }
  return null;
}

/** Module specifier for a theme's compiled CSS (package `exports` "./themes/*"). */
export function themeImportSpecifier(theme) {
  return `css-is-awesome/themes/${theme}`;
}

/** Relative import path from `fromFile` to `entryFile` (posix, ./-prefixed). */
export function relativeImport(fromFile, entryFile) {
  let rel = path.posix.relative(path.posix.dirname(toPosix(fromFile)), toPosix(entryFile));
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return rel;
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}

/**
 * Insert `import "<spec>";` lines at the top of a JS/TS module (after any
 * leading "use client"/"use strict" directive and comment block). Idempotent:
 * a line already importing the same specifier is left alone.
 */
export function injectImports(source, specifiers) {
  let out = source;
  const missing = specifiers.filter((s) => !new RegExp(`import\\s+["']${escapeRe(s)}["']`).test(out));
  if (!missing.length) return { source: out, added: [] };
  const lines = missing.map((s) => `import "${s}";`).join("\n") + "\n";
  // Skip a leading directive ("use client") and any leading comments/blank lines.
  const m = /^(\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*|\n)*(?:["']use (?:client|server|strict)["'];?\s*\n)?)/.exec(out);
  const head = m ? m[1] : "";
  out = head + lines + out.slice(head.length);
  return { source: out, added: missing };
}

/**
 * Add data-theme="<theme>" to the first <html …> tag in HTML or JSX.
 * Idempotent: if any data-theme attribute is present, nothing changes.
 */
export function injectDataTheme(source, theme) {
  if (/<html\b[^>]*\bdata-theme=/.test(source)) return { source, added: false };
  const out = source.replace(/<html(\b[^>]*)>/, (whole, attrs) => `<html data-theme="${theme}"${attrs}>`);
  return { source: out, added: out !== source };
}

/**
 * Merge the css-is-awesome MCP entry into an existing .mcp.json object,
 * never clobbering other servers. Returns { config, changed }.
 */
export function mergeMcpConfig(existing) {
  const config = existing && typeof existing === "object" ? structuredClone(existing) : {};
  if (!config.mcpServers || typeof config.mcpServers !== "object") config.mcpServers = {};
  if (config.mcpServers["css-is-awesome"]) return { config, changed: false };
  config.mcpServers["css-is-awesome"] = { command: "npx", args: ["-y", "css-is-awesome-mcp"] };
  return { config, changed: true };
}

/** The copy-paste line for the no-bundler case (matches the README). */
export function themeLinkTag(theme) {
  return `<link rel="stylesheet" href="node_modules/css-is-awesome/public/themes/${theme}/theme.css">`;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}
