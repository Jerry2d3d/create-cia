import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { injectImports, injectDataTheme, mergeMcpConfig, relativeImport, scssEntryPath, scssEntryContent, findLayout } from "../lib/wire.mjs";
import { FRAMEWORKS } from "../lib/detect.mjs";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "create-cia-"));

test("injectImports: adds after a 'use client' directive and is idempotent", () => {
  const src = `"use client";\nimport React from "react";\nexport default function X() {}\n`;
  const a = injectImports(src, ["css-is-awesome/themes/prism", "./styles/cia.scss"]);
  assert.deepEqual(a.added, ["css-is-awesome/themes/prism", "./styles/cia.scss"]);
  assert.match(a.source, /^"use client";\nimport "css-is-awesome\/themes\/prism";\nimport "\.\/styles\/cia\.scss";\nimport React/);
  const b = injectImports(a.source, ["css-is-awesome/themes/prism", "./styles/cia.scss"]);
  assert.deepEqual(b.added, []);
  assert.equal(b.source, a.source);
});

test("injectImports: skips a leading comment block", () => {
  const src = `// eslint-disable\n/* header */\nimport x from "y";\n`;
  const a = injectImports(src, ["a"]);
  assert.equal(a.source, `// eslint-disable\n/* header */\nimport "a";\nimport x from "y";\n`);
});

test("injectDataTheme: JSX and HTML, idempotent", () => {
  const jsx = `<html lang="en">\n<body/></html>`;
  const a = injectDataTheme(jsx, "glass");
  assert.equal(a.added, true);
  assert.match(a.source, /<html data-theme="glass" lang="en">/);
  const b = injectDataTheme(a.source, "press");
  assert.equal(b.added, false);
  assert.equal(b.source, a.source);
  const bare = injectDataTheme("<html>\n</html>", "press");
  assert.match(bare.source, /<html data-theme="press">/);
  const none = injectDataTheme("no html tag here", "press");
  assert.equal(none.added, false);
});

test("mergeMcpConfig: adds the server without clobbering others, idempotent", () => {
  const a = mergeMcpConfig({ mcpServers: { other: { command: "x" } } });
  assert.equal(a.changed, true);
  assert.deepEqual(a.config.mcpServers.other, { command: "x" });
  assert.deepEqual(a.config.mcpServers["css-is-awesome"], { command: "npx", args: ["-y", "css-is-awesome-mcp"] });
  const b = mergeMcpConfig(a.config);
  assert.equal(b.changed, false);
  const c = mergeMcpConfig(null);
  assert.equal(c.changed, true);
  assert.ok(c.config.mcpServers["css-is-awesome"]);
});

test("relativeImport: posix ./-prefixed path between files", () => {
  assert.equal(relativeImport(path.join("app", "layout.tsx"), path.join("app", "styles", "cia.scss")), "./styles/cia.scss");
  assert.equal(relativeImport(path.join("src", "main.tsx"), path.join("src", "styles", "cia.scss")), "./styles/cia.scss");
  assert.equal(relativeImport(path.join("src", "app", "layout.tsx"), path.join("styles", "cia.scss")), "../../styles/cia.scss");
});

test("scssEntryPath + findLayout per framework layout", () => {
  const d = tmp();
  fs.mkdirSync(path.join(d, "app"));
  fs.writeFileSync(path.join(d, "app", "layout.tsx"), "");
  assert.equal(scssEntryPath(FRAMEWORKS.next, d), path.join("app", "styles", "cia.scss"));
  assert.deepEqual(findLayout(FRAMEWORKS.next, d), { file: "app/layout.tsx", kind: "next-layout" });

  const v = tmp();
  fs.mkdirSync(path.join(v, "src"));
  fs.writeFileSync(path.join(v, "src", "main.ts"), "");
  fs.writeFileSync(path.join(v, "index.html"), "");
  assert.equal(scssEntryPath(FRAMEWORKS["vite-vue"], v), path.join("src", "styles", "cia.scss"));
  assert.deepEqual(findLayout(FRAMEWORKS["vite-vue"], v), { file: "src/main.ts", kind: "vite-main", html: "index.html" });

  const e = tmp();
  assert.equal(scssEntryPath(FRAMEWORKS.vanilla, e), path.join("styles", "cia.scss"));
  assert.equal(findLayout(FRAMEWORKS.vanilla, e), null);
  assert.equal(findLayout(FRAMEWORKS.astro, e), null);
});

test("scssEntryContent: the two-import model, verbatim", () => {
  const c = scssEntryContent();
  assert.match(c, /^\/\/ cia\.scss/);
  assert.match(c, /\n@use 'css-is-awesome';\n/);
  assert.match(c, /@use 'css-is-awesome\/api' as cia;/);
  assert.match(c, /Never `@use 'css-is-awesome'`/);
});
