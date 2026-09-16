import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const accountsDir = join(root, "app", "(shell)", "net-profit", "accounts");

function read(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function accountUiSource() {
  const componentsDir = join(accountsDir, "_components");
  return [
    read(join(accountsDir, "page.tsx")),
    ...readdirSync(componentsDir)
      .filter((name) => name.endsWith(".tsx"))
      .map((name) => read(join(componentsDir, name))),
  ].join("\n");
}

test("the Accounts page exposes a reachable Setup tab", () => {
  const page = read(join(accountsDir, "page.tsx"));
  assert.match(page, /value:\s*["']setup["']/);
  assert.match(page, /label:\s*["']Setup["']/);
  assert.match(page, /<SetupTab\b/);
});

test("all required Accounts management hooks are connected to UI", () => {
  const source = accountUiSource();
  const requiredHooks = [
    "useCreateCashAccount",
    "useUpdateCashAccount",
    "useTransfer",
    "useCashAccountLedger",
    "useCreateExpenseCategory",
    "useUpdateExpenseCategory",
    "useCreateCostCentre",
    "useUpdateCostCentre",
    "useUpdateVatSettings",
    "useUpdateCodFeeSettings",
    "useUpdateParty",
    "useDeleteParty",
    "usePartyStatement",
    "useUpdateExpense",
  ];

  for (const hook of requiredHooks) {
    assert.match(
      source,
      new RegExp(`\\b${hook}\\b`),
      `${hook} has no reachable UI`,
    );
  }
});

test("empty account selectors tell staff where to create an account", () => {
  const source = accountUiSource();
  assert.match(source, /No active accounts — add one in Setup/);
});
