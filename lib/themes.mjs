// Theme catalogue. Prefer the installed css-is-awesome package (its
// public/themes/<name>/theme.css folders are the source of truth); fall back
// to the 8 families documented in css-is-awesome's README when it isn't
// installed yet (the usual case — we're about to install it).
import fs from "node:fs";
import path from "node:path";

// Names + one-line moods copied verbatim from css-is-awesome/README.md.
export const THEME_FAMILIES = [
  { value: "boilerplate", hint: "Neutral slate + clean blue, system fonts, drop-in starter" },
  { value: "sketchbook", hint: "Warm washi paper / charcoal at night, sumi ink, indigo accent (brand default)" },
  { value: "press", hint: "Editorial newsprint / night-edition, Playfair serif, press-red" },
  { value: "prism", hint: "Vercel/Linear/Radix aesthetic, refined blue, neutral grays" },
  { value: "cupertino", hint: "macOS AppKit, SF Pro, system blue, vibrancy blurs" },
  { value: "glass", hint: "visionOS glassmorphism, iOS indigo, blur asymmetric per mode" },
  { value: "graphite", hint: "Brushed silver / machined dark aluminum, SF system stack" },
  { value: "terminal", hint: "VT100 phosphor green, zero radii, CRT glow (dark-only base)" },
];

export const DEFAULT_THEME = "boilerplate";

/**
 * Every theme name available: the 8 families plus their -light / -dark
 * variants when the installed package exposes them.
 */
export function listThemes(dir) {
  const installed = path.join(dir, "node_modules", "css-is-awesome", "public", "themes");
  const families = THEME_FAMILIES.map((t) => t.value);
  if (fs.existsSync(installed)) {
    try {
      const names = fs
        .readdirSync(installed, { withFileTypes: true })
        .filter((e) => e.isDirectory() && fs.existsSync(path.join(installed, e.name, "theme.css")))
        .map((e) => e.name)
        .sort();
      if (names.length) return { names, source: "installed css-is-awesome" };
    } catch {
      // fall through to the bundled list
    }
  }
  const variants = families.flatMap((f) => [f, `${f}-light`, `${f}-dark`]);
  return { names: variants, source: "bundled list" };
}

/** Options for the theme prompt — families only, keeps the list short. */
export function themeChoices() {
  return THEME_FAMILIES.map((t) => ({ value: t.value, label: t.value, hint: t.hint }));
}

export function isKnownTheme(name, dir) {
  return listThemes(dir).names.includes(name);
}
