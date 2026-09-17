import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { detectFramework, detectPackageManager, readPackageJson, hasDependency } from "../lib/detect.mjs";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "create-cia-"));

test("detectFramework: recognises each supported framework from dependencies", () => {
  const cases = [
    [{ dependencies: { next: "16" } }, "next"],
    [{ dependencies: { nuxt: "4" } }, "nuxt"],
    [{ dependencies: { astro: "5" } }, "astro"],
    [{ devDependencies: { "@sveltejs/kit": "2", vite: "7", svelte: "5" } }, "sveltekit"],
    [{ dependencies: { "@remix-run/react": "2" } }, "remix"],
    [{ dependencies: { "@react-router/dev": "7" } }, "remix"],
    [{ dependencies: { "@angular/core": "20" } }, "angular"],
    [{ dependencies: { react: "19" }, devDependencies: { vite: "7" } }, "vite-react"],
    [{ dependencies: { vue: "3" }, devDependencies: { vite: "7" } }, "vite-vue"],
    [{ dependencies: { svelte: "5" }, devDependencies: { vite: "7" } }, "vite-svelte"],
    [{ devDependencies: { vite: "7" } }, "vite"],
  ];
  for (const [pkg, expected] of cases) assert.equal(detectFramework(pkg)?.id, expected, JSON.stringify(pkg));
});

test("detectFramework: null for no package.json or no known markers", () => {
  assert.equal(detectFramework(null), null);
  assert.equal(detectFramework({ dependencies: { lodash: "4" } }), null);
});

test("detectPackageManager: lockfiles and packageManager field", () => {
  const d = tmp();
  assert.equal(detectPackageManager(d, null).id, "npm");
  fs.writeFileSync(path.join(d, "package-lock.json"), "{}");
  assert.equal(detectPackageManager(d, null).id, "npm");
  fs.writeFileSync(path.join(d, "yarn.lock"), "");
  assert.equal(detectPackageManager(d, null).id, "yarn");
  fs.writeFileSync(path.join(d, "pnpm-lock.yaml"), "");
  assert.equal(detectPackageManager(d, null).id, "pnpm");
  fs.writeFileSync(path.join(d, "bun.lockb"), "");
  // packageManager field wins over every lockfile
  assert.equal(detectPackageManager(d, { packageManager: "yarn@4.0.0" }).id, "yarn");
  assert.equal(detectPackageManager(d, { packageManager: "bun@1.2.0" }).id, "bun");
});

test("readPackageJson: missing, valid, malformed", () => {
  const d = tmp();
  assert.deepEqual(readPackageJson(d).exists, false);
  fs.writeFileSync(path.join(d, "package.json"), '{"name":"x"}');
  assert.equal(readPackageJson(d).pkg.name, "x");
  fs.writeFileSync(path.join(d, "package.json"), "{ not json");
  const r = readPackageJson(d);
  assert.equal(r.pkg, null);
  assert.match(r.error, /not valid JSON/);
});

test("hasDependency: checks both dependency blocks", () => {
  assert.equal(hasDependency({ dependencies: { a: "1" } }, "a"), true);
  assert.equal(hasDependency({ devDependencies: { b: "1" } }, "b"), true);
  assert.equal(hasDependency({}, "c"), false);
  assert.equal(hasDependency(null, "c"), false);
});
