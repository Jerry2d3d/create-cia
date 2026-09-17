# create-cia

[![npm](https://img.shields.io/npm/v/create-cia?logo=npm&color=cb3837)](https://www.npmjs.com/package/create-cia) [![CI](https://github.com/Jerry2d3d/create-cia/actions/workflows/ci.yml/badge.svg)](https://github.com/Jerry2d3d/create-cia/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

The guided installer for [css-is-awesome](https://github.com/Jerry2d3d/css-is-awesome) ("cia") — a token-driven SCSS design system.

```bash
npm create cia@latest
```

Run it inside an existing project. It detects your framework and package
manager, installs cia, writes the root SCSS entry with the two-import model
already correct, wires your theme into the root layout, and (optionally)
connects the MCP server so AI agents read cia's real API instead of
guessing. Four questions, then a summary with your next steps.

**Existing projects only.** create-cia is not a scaffolder — it does not
create a Next.js/Vite/Astro app for you. Make the project with your
framework's own tool, then run create-cia in it. If there is no
`package.json` yet it offers to `npm init -y` first, and that's as far as
scaffolding goes.

## What it asks

1. **Framework** — skipped when detected (`Detected: Next.js — use this?`).
   Otherwise: React, Vue, Svelte, Angular, Vanilla.
2. **Theme** — one of cia's 8 theme families (default `boilerplate`).
3. **MCP** — wire `css-is-awesome-mcp` into `.mcp.json` for AI agents (default yes).

Detection reads `package.json` dependencies (Next.js, Vite + React/Vue/Svelte,
Astro, Nuxt, SvelteKit, Remix/React Router, Angular) and the lockfile or
`packageManager` field (npm, pnpm, yarn, bun).

## What it writes

| Action | Detail |
|---|---|
| Install | `css-is-awesome` as a dependency; `sass` and `css-is-awesome-mcp` as dev dependencies (each only if missing — Angular skips `sass`, it bundles its own) |
| Root stylesheet | `app/styles/cia.scss` (Next.js app router) or `src/styles/cia.scss` (Vite and most others) containing `@use 'css-is-awesome';` plus a comment showing the per-component `@use 'css-is-awesome/api' as cia;` — the **two-import model** from cia's docs. Never overwritten if it already exists. |
| Root layout | Next.js: `import "css-is-awesome/themes/<theme>";` and `import "./styles/cia.scss";` added to `app/layout.tsx`, plus `data-theme="<theme>"` on `<html>`. Vite: the same imports in `src/main.*`, `data-theme` in `index.html`. Idempotent — running twice changes nothing. |
| `.mcp.json` | Adds the `css-is-awesome` server (`npx -y css-is-awesome-mcp`), merged into whatever servers you already have. |

For frameworks it can't wire with confidence (Astro, Nuxt, SvelteKit, Remix,
Angular, plain HTML) it prints the exact import or `<link>` line to paste.

## Flags

```
npx create-cia [dir] [options]

  --yes, -y          No prompts: apply defaults and print a summary
  --dry-run          Print every action without touching disk or installing
  --pm <name>        npm | pnpm | yarn | bun            (default: detected)
  --theme <name>     boilerplate | sketchbook | press | prism | cupertino |
                     glass | graphite | terminal (+ -light / -dark variants)
  --framework <id>   next | vite-react | vite-vue | vite-svelte | vite | astro |
                     nuxt | sveltekit | remix | angular | vanilla
  --no-mcp           Skip the MCP wiring
  --help, -h         Show help
  --version, -v      Print the version
```

`--dry-run --yes` is the safe way to see exactly what would happen in a
project before letting it run. It never spawns a package manager.

## Local development

```bash
npm install
npm test                                  # node --test, fully offline
node bin/create-cia.mjs ../some-app --dry-run --yes
```

The test suite covers framework/package-manager detection over fixture
`package.json` files, the idempotent layout injection, `.mcp.json` merging,
and the real CLI end-to-end under `--dry-run --yes` for a Next.js project, a
Vite + React project and an empty directory. CI runs it on Ubuntu and
Windows, Node 20 and 24.

## Publishing

Releases are cut by GitHub Actions only, never from a terminal:
[semantic-release](https://github.com/semantic-release/semantic-release) runs
after green CI on `main`, derives the version from conventional commits,
publishes to npm, and creates the GitHub Release. It needs one secret,
`NPM_TOKEN`, which must be a **Classic "Automation"** npm token — not a
"Publish" token and not a granular token scoped to selected packages, since
those cannot create a package that does not exist yet and cannot bypass 2FA.
Same setup as [`css-is-awesome-mcp`](https://github.com/Jerry2d3d/css-is-awesome-mcp).

## Relationship to css-is-awesome

One-way dependency: this package installs `css-is-awesome` into *your*
project; `css-is-awesome` itself ships zero JavaScript and knows nothing
about this wizard. The design system, its themes, recipes and MCP surface
live in the [`css-is-awesome`](https://github.com/Jerry2d3d/css-is-awesome)
repo. This repo only changes when the *setup experience* changes.

Docs: <https://cssisawesome.com/docs/install/>

## License

MIT
