// Package-manager commands and process spawning. Cross-platform: on Windows
// the PM binaries are .cmd shims, which need a shell to resolve.
import { spawn } from "node:child_process";

/** Build the "add packages" argv for a package manager. */
export function addCommand(pm, packages, { dev = false } = {}) {
  switch (pm) {
    case "pnpm":
      return ["pnpm", ["add", ...(dev ? ["-D"] : []), ...packages]];
    case "yarn":
      return ["yarn", ["add", ...(dev ? ["-D"] : []), ...packages]];
    case "bun":
      return ["bun", ["add", ...(dev ? ["-d"] : []), ...packages]];
    case "npm":
    default:
      return ["npm", ["install", ...(dev ? ["-D"] : []), ...packages]];
  }
}

export function initCommand() {
  return ["npm", ["init", "-y"]];
}

export function formatCommand([cmd, args]) {
  return [cmd, ...args].join(" ");
}

/** Run a command in `cwd`, inheriting stdio. Resolves on exit 0, rejects otherwise. */
export function run([cmd, args], cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${formatCommand([cmd, args])} exited with code ${code}`));
    });
  });
}
