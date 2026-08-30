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
  const physicalLetterOrDigit = /^(Key[A-Z]|Digit\d)$/.test(event.code);
  const displayedKey = physicalLetterOrDigit && event.shiftKey && !/[\p{L}\p{N}]/u.test(event.key)
    ? physicalKey
    : event.key.length === 1 && event.key !== "\uf8ff" ? logicalKey : physicalKey;
  const selected = shortcutFromSelection(displayedKey, modifiers, platform, event.code);
  return {
    ...selected,
    code: event.code,
    logicalKey: logicalKey === displayedKey ? undefined : logicalKey,
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

export function shouldCaptureShortcut(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "altKey" | "metaKey" | "shiftKey" | "target" | "repeat">): boolean {
  if (event.repeat || modifierOrder.includes(event.key)) return false;
  const shiftedPunctuation = event.shiftKey && event.key.length === 1 && !/[\p{L}\p{N}]/u.test(event.key);
  return event.ctrlKey || event.altKey || event.metaKey || shiftedPunctuation || event.key.startsWith("F") || event.key === "Escape";
}

export function normalizeKey(key: string): string {
  if (key === " ") return "Space";
  return key.length === 1 ? key.toUpperCase() : key;
}

export function recommendationFor(key: string, modifiers: string[], intent: Intent, layout: Layout, browser = "the browser"): { value: Recommendation; reason: string } {
  const upper = key.toUpperCase();
  const ctrl = modifiers.includes("Control") || modifiers.includes("Meta");
  const primaryModifier = modifiers.includes("Meta") ? "⌘" : "Ctrl";
  const conventionalShortcut = `${primaryModifier} + ${upper}`;
  if (!ctrl && ["?", "/"].includes(key) && layout !== "us") {
    return { value: "avoid", reason: `${key} requires an extra modifier on ${layout} layouts and has no dedicated key.` };
  }
  if (!ctrl && modifiers.length) {
    if (["Q", "R", "W"].includes(upper)) return { value: "avoid", reason: "This modifier combination can conflict with a critical browser or operating-system action." };
    return { value: "acceptable", reason: "A modifier-assisted combination is selected. No strong convention is recorded here; verify the exact browser, operating system, and keyboard layout." };
  }
  if (!ctrl) return { value: "lack-of-data", reason: "Choose an intended action to evaluate this unmodified key." };
  const conventions: Record<string, { intent?: Intent; label: string; browserAction?: string }> = {
    Z: { intent: "undo", label: "Undo" }, S: { intent: "save", label: "Save" }, F: { intent: "search", label: "Find" },
    L: { intent: "list", label: "List", browserAction: "normally focuses the browser location bar" },
    N: { intent: "new-record", label: "New" },
    C: { label: "Copy" }, X: { label: "Cut" }, V: { label: "Paste" }, A: { label: "Select all" },
    P: { label: "Print", browserAction: "normally opens the browser Print dialog" },
    B: { label: "Bold" }, I: { label: "Italic" }, U: { label: "Underline" },
  };
  const convention = conventions[upper];
  if (convention?.intent === intent) {
    const browserConflict = ["F", "L", "N"].includes(upper);
    const overrideReason = upper === "F"
      ? `${convention.label} follows convention. When the event is received and cancelled, this page overrides ${browser} Find and replaces that browser shortcut while the handler owns it.`
      : upper === "L"
        ? `List is understandable. When the event is received and cancelled, this configuration intercepts ${browser}'s location-bar shortcut while the handler owns it; record that as a browser-specific override, not as a free shortcut.`
      : `${convention.label} is understandable, but this shortcut competes with browser chrome.`;
    return {
      value: browserConflict ? "acceptable" : "recommended",
      reason: browserConflict ? overrideReason : `${convention.label} follows a widely understood platform convention.`,
    };
  }
  if (["Q", "R", "W", "T"].includes(upper)) return { value: "avoid", reason: "This combination conflicts with a critical browser action." };
  const conventionMeaning = convention?.browserAction
    ? `${conventionalShortcut} ${convention.browserAction}`
    : `${conventionalShortcut} conventionally means ${convention?.label}`;
  if (convention?.intent) return { value: "avoid", reason: `${conventionMeaning}, not the selected action.` };
  if (convention) {
    return {
      value: "acceptable",
      reason: `${conventionMeaning}. It can be bound when the event is received and cancelled, but that replaces the expected native command; use it only when that takeover is intentional.`,
    };
  }
  return { value: "acceptable", reason: "No strong convention is known, but verify browser, OS, assistive technology, and layout conflicts." };
}

export function shortcutPath(shortcut: Shortcut, browser: string, os: string): string {
  const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `/${shortcut.id}/${slug(browser)}/${slug(os)}`;
}
