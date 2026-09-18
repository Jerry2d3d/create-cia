import { test } from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { createPrompter, isCancel } from "../lib/prompt.mjs";

function harness(script) {
  const input = new PassThrough();
  const output = new PassThrough();
  let out = "";
  output.on("data", (d) => (out += d.toString()));
  const p = createPrompter({ input, output });
  // Feed the whole script up front, the way a pipe would.
  if (script !== undefined) input.end(script);
  return { p, input, text: () => out };
}

const opts = [
  { value: "a", label: "Alpha", hint: "first" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
];

test("confirm: Enter returns the default", async () => {
  const { p } = harness("\n\n");
  assert.equal(await p.confirm({ message: "Go?", initialValue: true }), true);
  assert.equal(await p.confirm({ message: "Go?", initialValue: false }), false);
});

test("confirm: y/yes/n/no parse, case-insensitive", async () => {
  const { p } = harness("y\nYES\nn\nNo\n");
  assert.equal(await p.confirm({ message: "?" }), true);
  assert.equal(await p.confirm({ message: "?" }), true);
  assert.equal(await p.confirm({ message: "?" }), false);
  assert.equal(await p.confirm({ message: "?" }), false);
});

test("confirm: invalid answer re-asks, then accepts", async () => {
  const { p, text } = harness("maybe\nn\n");
  assert.equal(await p.confirm({ message: "Sure?" }), false);
  assert.match(text(), /Please answer y or n/);
});

test("select: Enter returns the initialValue", async () => {
  const { p, text } = harness("\n");
  assert.equal(await p.select({ message: "Pick", options: opts, initialValue: "b" }), "b");
  assert.match(text(), /Number \[2\]/);
  assert.match(text(), /1\) Alpha/);
});

test("select: explicit number, then invalid then valid", async () => {
  const { p, text } = harness("3\n9\nx\n1\n");
  assert.equal(await p.select({ message: "Pick", options: opts, initialValue: "a" }), "c");
  assert.equal(await p.select({ message: "Pick", options: opts, initialValue: "a" }), "a");
  assert.match(text(), /Enter a number between 1 and 3/);
});

test("select: a label or value also works", async () => {
  const { p } = harness("gamma\nb\n");
  assert.equal(await p.select({ message: "Pick", options: opts, initialValue: "a" }), "c");
  assert.equal(await p.select({ message: "Pick", options: opts, initialValue: "a" }), "b");
});

test("cancel: EOF before an answer yields CANCEL, and stays cancelled", async () => {
  const { p } = harness("");
  const v = await p.confirm({ message: "?" });
  assert.ok(isCancel(v));
  assert.ok(isCancel(await p.select({ message: "Pick", options: opts })));
});

test("output: intro/note/outro draw the gutter without colour on a non-TTY", async () => {
  const { p, text } = harness("");
  p.intro("create-cia");
  p.log.info("Detected: Next.js");
  p.note("Framework  Next.js\nTheme      boilerplate", "Summary");
  p.outro("done");
  const t = text();
  assert.match(t, /^┌  create-cia/);
  assert.match(t, /●  Detected: Next\.js/);
  assert.match(t, /◇  Summary ─+╮/);
  assert.match(t, /└  done$/m);
  assert.doesNotMatch(t, /\x1b\[/);
});
