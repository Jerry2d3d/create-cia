// Minimal argv parser — no dependency, no shell assumptions.
//
//   npx create-cia [dir] [--yes] [--dry-run] [--pm npm|pnpm|yarn|bun]
//                  [--theme <name>] [--framework <id>] [--no-mcp] [--help] [--version]

export const USAGE = `create-cia — guided installer for css-is-awesome (cia)

Usage
  npm create cia@latest [dir] [options]
  npx create-cia [dir] [options]

Options
  --yes, -y            No prompts: apply defaults and print a summary
  --dry-run            Print every action without touching disk or installing
  --pm <name>          Package manager: npm | pnpm | yarn | bun (default: detected)
  --theme <name>       Theme to wire (default: boilerplate)
  --framework <id>     next | vite-react | vite-vue | vite-svelte | vite | astro |
                       nuxt | sveltekit | remix | angular | vanilla (default: detected)
  --no-mcp             Skip wiring the css-is-awesome-mcp server for AI agents
  --help, -h           Show this help
  --version, -v        Print the version

Existing projects only — create-cia wires cia into the project you run it in.
It does not scaffold a new app. Docs: https://cssisawesome.com/docs/install/
`;

const VALID_PM = new Set(["npm", "pnpm", "yarn", "bun"]);

export function parseArgs(argv) {
  const out = {
    dir: process.cwd(),
    yes: false,
    dryRun: false,
    pm: null,
    theme: null,
    framework: null,
    mcp: true,
    help: false,
    version: false,
  };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith("-")) throw new Error(`Missing value for ${a}`);
      i++;
      return v;
    };
    if (a === "--yes" || a === "-y") out.yes = true;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--no-mcp") out.mcp = false;
    else if (a === "--mcp") out.mcp = true;
    else if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--version" || a === "-v") out.version = true;
    else if (a === "--pm") out.pm = next();
    else if (a.startsWith("--pm=")) out.pm = a.slice(5);
    else if (a === "--theme") out.theme = next();
    else if (a.startsWith("--theme=")) out.theme = a.slice(8);
    else if (a === "--framework") out.framework = next();
    else if (a.startsWith("--framework=")) out.framework = a.slice(12);
    else if (a.startsWith("-")) throw new Error(`Unknown option: ${a}\n\n${USAGE}`);
    else positional.push(a);
  }
  if (positional.length > 1) throw new Error(`Expected at most one directory argument, got: ${positional.join(" ")}`);
  if (positional.length === 1) out.dir = positional[0];
  if (out.pm && !VALID_PM.has(out.pm)) throw new Error(`--pm must be one of ${[...VALID_PM].join(", ")}, got "${out.pm}"`);
  return out;
}
