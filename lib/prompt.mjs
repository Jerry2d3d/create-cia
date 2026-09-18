// In-house prompts. Zero dependencies on purpose: a zero-JS design system
// deserves a zero-dependency installer — nothing to audit, nothing to break.
//
// Deliberately simple: questions are answered with Enter / y / n / a number,
// never with arrow keys or raw mode, so the wizard behaves identically in a
// real terminal, under `printf 'y\n2\n' | create-cia`, and in a CI log.
import readline from "node:readline";

export const CANCEL = Symbol("cancel");
export const isCancel = (v) => v === CANCEL;

const useColor = (out) => Boolean(out && out.isTTY) && !process.env.NO_COLOR && process.env.TERM !== "dumb";
const paint = (on) => (code) => (s) => (on ? `\x1b[${code}m${s}\x1b[0m` : String(s));

export function createPrompter({ input = process.stdin, output = process.stdout } = {}) {
  const c = paint(useColor(output));
  const dim = c("2"), cyan = c("36"), green = c("32"), yellow = c("33"), red = c("31"), bold = c("1");
  const write = (s) => output.write(s + "\n");
  const bar = dim("│");

  // One readline interface for the whole session: creating one per question
  // would swallow buffered lines when stdin is a pipe.
  // `ended` = no more input will ever arrive (EOF or Ctrl-C). Buffered lines
  // that arrived before EOF are still answered in order — a pipe delivers the
  // whole script at once, then ends.
  let rl = null, ended = false;
  const lines = [], waiters = [];
  function ensure() {
    if (rl || ended) return;
    rl = readline.createInterface({ input, output, terminal: Boolean(input.isTTY && output.isTTY) });
    rl.on("line", (l) => (waiters.length ? waiters.shift()(l) : lines.push(l)));
    const end = () => { ended = true; while (waiters.length) waiters.shift()(CANCEL); if (rl) { rl.close(); rl = null; } };
    rl.on("close", end);
    rl.on("SIGINT", end);
  }
  // A terminal echoes the user's Enter; a pipe does not, so add the newline
  // ourselves there — otherwise the next gutter line lands on the prompt line.
  const echoNl = () => { if (!(input.isTTY && output.isTTY)) output.write("\n"); };
  function ask(prompt) {
    ensure();
    output.write(prompt);
    if (lines.length) { echoNl(); return Promise.resolve(lines.shift()); }
    if (ended) { echoNl(); return Promise.resolve(CANCEL); }
    rl.resume();
    return new Promise((resolve) => waiters.push((v) => { if (rl) rl.pause(); echoNl(); resolve(v); }));
  }
  const close = () => { ended = true; if (rl) { rl.close(); rl = null; } };

  const intro = (title) => write(`${dim("┌")}  ${bold(title)}`); // every later line prepends its own bar
  const outro = (text) => { write(`${bar}\n${dim("└")}  ${text}`); close(); };
  const cancelMsg = (text) => write(`${bar}\n${dim("└")}  ${red(text)}`);
  const log = {
    message: (text, { spacing = 1 } = {}) => write(`${spacing ? bar + "\n" : ""}${bar}  ${text}`),
    info: (text) => write(`${bar}\n${cyan("●")}  ${text}`),
    success: (text) => write(`${bar}\n${green("◆")}  ${text}`),
    step: (text) => write(`${bar}\n${green("◇")}  ${text}`),
    warn: (text) => write(`${bar}\n${yellow("▲")}  ${text}`),
    error: (text) => write(`${bar}\n${red("■")}  ${text}`),
  };
  function note(body, title = "") {
    const rows = String(body).split("\n");
    const w = Math.max(title.length + 2, ...rows.map((r) => r.length)) + 2;
    write(`${bar}\n${green("◇")}  ${title} ${dim("─".repeat(Math.max(1, w - title.length - 1)) + "╮")}`);
    write(`${bar}  ${" ".repeat(w)}${dim("│")}`);
    for (const r of rows) write(`${bar}  ${r}${" ".repeat(w - r.length)}${dim("│")}`);
    write(`${bar}  ${" ".repeat(w)}${dim("│")}`);
    write(`${dim("├" + "─".repeat(w + 2) + "╯")}`);
  }
  async function confirm({ message, initialValue = true }) {
    const hint = initialValue ? "Y/n" : "y/N";
    for (;;) {
      const a = await ask(`${bar}\n${green("◇")}  ${message} ${dim(`(${hint})`)} `);
      if (isCancel(a)) return CANCEL;
      const v = a.trim().toLowerCase();
      if (v === "") return initialValue;
      if (["y", "yes"].includes(v)) return true;
      if (["n", "no"].includes(v)) return false;
      write(`${yellow("▲")}  Please answer y or n.`);
    }
  }
  async function select({ message, options, initialValue }) {
    const def = Math.max(0, options.findIndex((o) => o.value === initialValue));
    const list = options.map((o, i) => `${bar}    ${i === def ? green("●") : dim("○")} ${dim(String(i + 1) + ")")} ${o.label}${o.hint ? dim(`  ${o.hint}`) : ""}`).join("\n");
    for (;;) {
      const a = await ask(`${bar}\n${green("◇")}  ${message}\n${list}\n${bar}    ${dim(`Number [${def + 1}]:`)} `);
      if (isCancel(a)) return CANCEL;
      const v = a.trim();
      if (v === "") return options[def].value;
      const n = Number(v);
      if (Number.isInteger(n) && n >= 1 && n <= options.length) return options[n - 1].value;
      const byLabel = options.find((o) => o.value === v || o.label.toLowerCase() === v.toLowerCase());
      if (byLabel) return byLabel.value;
      write(`${yellow("▲")}  Enter a number between 1 and ${options.length}.`);
    }
  }
  return { intro, outro, cancel: cancelMsg, log, note, confirm, select, close, isCancel };
}

const p = createPrompter();
export const { intro, outro, cancel, log, note, confirm, select, close } = p;
export default p;
