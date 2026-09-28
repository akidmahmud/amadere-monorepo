import { test } from "node:test";
import assert from "node:assert/strict";
import { CALC_START, calcDisplay, calcPress } from "../src/lib/pos-calc.ts";

const run = (keys) => keys.reduce(calcPress, CALC_START);

test("basic sums, chaining left to right, and =", () => {
  assert.equal(calcDisplay(run(["1", "2", "+", "3", "="])), "15");
  assert.equal(calcDisplay(run(["2", "+", "3", "×", "4", "="])), "20");
  assert.equal(calcDisplay(run(["1", "0", "0", "−", "2", "5", "="])), "75");
});

test("decimals are exact and a second dot is ignored", () => {
  assert.equal(calcDisplay(run(["0", ".", "1", "+", ".", "2", "="])), "0.3");
  assert.equal(calcDisplay(run(["1", ".", ".", "5"])), "1.5");
});

test("% divides by 100; ⌫ deletes; C clears", () => {
  assert.equal(calcDisplay(run(["5", "0", "0", "×", "1", "0", "%", "="])), "50");
  assert.equal(calcDisplay(run(["1", "2", "3", "⌫"])), "12");
  assert.equal(calcDisplay(run(["9", "+", "C"])), "0");
});

test("divide by zero shows Error; a digit starts over", () => {
  assert.equal(calcDisplay(run(["5", "÷", "0", "="])), "Error");
  assert.equal(calcDisplay(run(["5", "÷", "0", "=", "7"])), "7");
});

test("after =, a digit starts a new number but an operator continues", () => {
  assert.equal(calcDisplay(run(["2", "+", "2", "=", "5"])), "5");
  assert.equal(calcDisplay(run(["2", "+", "2", "=", "×", "3", "="])), "12");
});
