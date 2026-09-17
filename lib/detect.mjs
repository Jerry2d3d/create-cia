// Project detection: package.json, framework, package manager.
// Pure functions over a directory — no prompts, no side effects.
import fs from "node:fs";
import path from "node:path";

/** Read and parse package.json. Returns { pkg, error, exists }. Never throws. */
export function readPackageJson(dir) {
  const file = path.join(dir, "package.json");
  if (!fs.existsSync(file)) return { pkg: null, error: null, exists: false, file };
  try {
    return { pkg: JSON.parse(fs.readFileSync(file, "utf8")), error: null, exists: true, file };
  } catch (err) {
    return { pkg: null, error: `package.json is not valid JSON: ${err.message}`, exists: true, file };
  }
}

export const FRAMEWORKS = {
  next: { id: "next", label: "Next.js" },
  "vite-react": { id: "vite-react", label: "Vite + React" },
  "vite-vue": { id: "vite-vue", label: "Vite + Vue" },
  "vite-svelte": { id: "vite-svelte", label: "Vite + Svelte" },
  vite: { id: "vite", label: "Vite (vanilla)" },
  astro: { id: "astro", label: "Astro" },
  nuxt: { id: "nuxt", label: "Nuxt" },
  sveltekit: { id: "sveltekit", label: "SvelteKit" },
  remix: { id: "remix", label: "Remix / React Router" },
  angular: { id: "angular", label: "Angular" },
  vanilla: { id: "vanilla", label: "Vanilla (no bundler detected)" },
};

/** The list offered when nothing is detected — matches the epic's five. */
export const FRAMEWORK_CHOICES = [
  { value: "vite-react", label: "React", hint: "Vite + React (recommended)" },
  { value: "vite-vue", label: "Vue", hint: "Vite + Vue" },
  { value: "vite-svelte", label: "Svelte", hint: "Vite + Svelte" },
  { value: "angular", label: "Angular", hint: "Angular CLI" },
  { value: "vanilla", label: "Vanilla", hint: "plain HTML/CSS/JS" },
];

function deps(pkg) {
  return { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
}

/** Detect the framework from package.json dependencies. Returns a FRAMEWORKS entry or null. */
export function detectFramework(pkg) {
  if (!pkg) return null;
  const d = deps(pkg);
  const has = (n) => Object.prototype.hasOwnProperty.call(d, n);
  if (has("next")) return FRAMEWORKS.next;
  if (has("nuxt")) return FRAMEWORKS.nuxt;
  if (has("astro")) return FRAMEWORKS.astro;
  if (has("@sveltejs/kit")) return FRAMEWORKS.sveltekit;
  if (has("@remix-run/react") || has("@react-router/dev")) return FRAMEWORKS.remix;
  if (has("@angular/core")) return FRAMEWORKS.angular;
  if (has("vite")) {
    if (has("react")) return FRAMEWORKS["vite-react"];
    if (has("vue")) return FRAMEWORKS["vite-vue"];
    if (has("svelte")) return FRAMEWORKS["vite-svelte"];
    return FRAMEWORKS.vite;
  }
  return null;
}

/** Detect the package manager from lockfiles and the `packageManager` field. */
export function detectPackageManager(dir, pkg) {
  const pmField = typeof pkg?.packageManager === "string" ? pkg.packageManager.split("@")[0] : null;
  if (pmField && ["npm", "pnpm", "yarn", "bun"].includes(pmField)) return { id: pmField, source: "packageManager field" };
  const lock = (f) => fs.existsSync(path.join(dir, f));
  if (lock("pnpm-lock.yaml")) return { id: "pnpm", source: "pnpm-lock.yaml" };
  if (lock("yarn.lock")) return { id: "yarn", source: "yarn.lock" };
  if (lock("bun.lockb") || lock("bun.lock")) return { id: "bun", source: "bun lockfile" };
  if (lock("package-lock.json")) return { id: "npm", source: "package-lock.json" };
  return { id: "npm", source: "default" };
}

/** True when `name` is already a dependency of any kind. */
export function hasDependency(pkg, name) {
  return Object.prototype.hasOwnProperty.call(deps(pkg), name);
}
