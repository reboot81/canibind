import type { Intent, Layout, Recommendation, Shortcut } from "./types";

const modifierOrder = ["Control", "Alt", "Shift", "Meta"];
const modifierLabels: Record<string, string> = { Control: "Ctrl", Alt: "Alt", Shift: "Shift", Meta: "Meta" };

export function shortcutFromEvent(event: KeyboardEvent): Shortcut | null {
  if (modifierOrder.includes(event.key)) return null;
  const modifiers = modifierOrder.filter((modifier) =>
    modifier === "Control" ? event.ctrlKey : modifier === "Alt" ? event.altKey : modifier === "Shift" ? event.shiftKey : event.metaKey,
  );
  const key = normalizeKey(event.key);
  const display = [...modifiers.map((item) => modifierLabels[item]), key].join(" + ");
  return { id: [...modifiers.map((item) => modifierLabels[item].toLowerCase()), key.toLowerCase()].join("-"), display, modifiers, key };
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
