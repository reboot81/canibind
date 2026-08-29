import { keyboardRows } from "./keyboard";
import type { Intent, KeyboardPlatform, Layout, Recommendation, Shortcut } from "./types";

const modifierOrder = ["Control", "Alt", "Shift", "Meta"];
const modifierDisplayOrder: Record<KeyboardPlatform, string[]> = {
  windows: ["Control", "Alt", "Shift", "Meta"],
  mac: ["Meta", "Control", "Alt", "Shift"],
};
const modifierLabels: Record<KeyboardPlatform, Record<string, string>> = {
  windows: { Control: "Ctrl", Alt: "Alt", Shift: "Shift", Meta: "Windows" },
  mac: { Control: "Control (⌃)", Alt: "Option (⌥)", Shift: "Shift", Meta: "Command (⌘)" },
};

export function shortcutFromEvent(event: KeyboardEvent, platform: KeyboardPlatform = "windows", layout: Layout = "us"): Shortcut | null {
  if (modifierOrder.includes(event.key)) return null;
  const modifiers = modifierOrder.filter((modifier) =>
    modifier === "Control" ? event.ctrlKey : modifier === "Alt" ? event.altKey : modifier === "Shift" ? event.shiftKey : event.metaKey,
  );
  const logicalKey = normalizeKey(event.key);
  const physicalKey = keyLabelForCode(event.code, layout, platform) ?? logicalKey;
  const selected = shortcutFromSelection(physicalKey, modifiers, platform, event.code);
  return {
    ...selected,
    code: event.code,
    logicalKey: logicalKey === physicalKey ? undefined : logicalKey,
  };
}

export function shortcutFromSelection(key: string, modifiers: string[], platform: KeyboardPlatform, code = ""): Shortcut {
  const order = modifierDisplayOrder[platform];
  const orderedModifiers = [...new Set(modifiers)].sort((left, right) => order.indexOf(left) - order.indexOf(right));
  const labels = modifierLabels[platform];
  const display = [...orderedModifiers.map((modifier) => labels[modifier]), key].join(" + ");
  const modifierIds = orderedModifiers.map((modifier) => modifier === "Control" ? "ctrl" : modifier.toLowerCase());
  return { id: [...modifierIds, keyIdFromCode(code, key)].join("-"), display, modifiers: orderedModifiers, key };
}

export function keyLabelForCode(code: string, layout: Layout, platform: KeyboardPlatform): string | null {
  return keyboardRows(layout, platform).flat().find((key) => key.code === code)?.label ?? fallbackCodeLabel(code);
}

function fallbackCodeLabel(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^F(?:[1-9]|1[0-2])$/.test(code)) return code;
  const labels: Record<string, string> = {
    Space: "Space", Escape: "Esc", Enter: "Enter", Tab: "Tab", Backspace: "Backspace", Delete: "Delete",
    ArrowLeft: "Left", ArrowRight: "Right", ArrowUp: "Up", ArrowDown: "Down", Home: "Home", End: "End",
    PageUp: "Page Up", PageDown: "Page Down",
  };
  return labels[code] ?? null;
}

function keyIdFromCode(code: string, label: string): string {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  const id = code
    .replace(/^Arrow/, "")
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .toLowerCase();
  return id || label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function shouldCaptureShortcut(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "altKey" | "metaKey" | "target" | "repeat">): boolean {
  if (event.repeat || modifierOrder.includes(event.key)) return false;
  const target = event.target as HTMLElement | null;
  const editable = target?.matches?.("input, textarea, select, [contenteditable='true']") ?? false;
  if (editable) return false;
  return event.ctrlKey || event.altKey || event.metaKey || event.key.startsWith("F") || event.key === "Escape";
}

export function normalizeKey(key: string): string {
  if (key === " ") return "Space";
  return key.length === 1 ? key.toUpperCase() : key;
}

export function recommendationFor(key: string, modifiers: string[], intent: Intent, layout: Layout): { value: Recommendation; reason: string } {
  const upper = key.toUpperCase();
  const ctrl = modifiers.includes("Control") || modifiers.includes("Meta");
  if (!ctrl && ["?", "/"].includes(key) && layout !== "us") {
    return { value: "avoid", reason: `${key} requires an extra modifier on ${layout} layouts and has no dedicated key.` };
  }
  if (!ctrl) return { value: "lack-of-data", reason: "Choose an intended action to evaluate this unmodified key." };
  const conventions: Record<string, { intent: Intent; label: string }> = {
    Z: { intent: "undo", label: "Undo" }, S: { intent: "save", label: "Save" }, F: { intent: "search", label: "Find" },
    L: { intent: "list", label: "List" }, N: { intent: "new-record", label: "New" },
  };
  const convention = conventions[upper];
  if (convention?.intent === intent) {
    const browserConflict = ["F", "L", "N"].includes(upper);
    return {
      value: browserConflict ? "acceptable" : "recommended",
      reason: browserConflict ? `${convention.label} is understandable, but this shortcut competes with browser chrome.` : `${convention.label} follows a widely understood platform convention.`,
    };
  }
  if (["R", "W", "T"].includes(upper)) return { value: "avoid", reason: "This combination conflicts with a critical browser action." };
  if (convention && intent !== "general") return { value: "avoid", reason: `Ctrl + ${upper} conventionally means ${convention.label}, not the selected action.` };
  return { value: "acceptable", reason: "No strong convention is known, but verify browser, OS, assistive technology, and layout conflicts." };
}

export function shortcutPath(shortcut: Shortcut, browser: string, os: string): string {
  const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `/${shortcut.id}/${slug(browser)}/${slug(os)}`;
}
