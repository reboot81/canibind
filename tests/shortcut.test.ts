import { describe, expect, it } from "vitest";
import { contributionShortcuts, keyboardRows } from "../src/keyboard";
import { normalizeKey, recommendationFor, shortcutFromEvent, shortcutFromSelection, shortcutPath, shouldCaptureShortcut } from "../src/shortcut";

describe("shortcut model", () => {
  it("normalizes character and space keys", () => {
    expect(normalizeKey("f")).toBe("F");
    expect(normalizeKey(" ")).toBe("Space");
  });

  it("treats de facto conventions separately from capability", () => {
    expect(recommendationFor("Z", ["Control"], "undo", "swedish").value).toBe("recommended");
    expect(recommendationFor("Z", ["Control"], "save", "swedish").value).toBe("avoid");
  });

  it("uses the active primary modifier and protects editing conventions", () => {
    expect(recommendationFor("Z", ["Meta"], "save", "swedish").reason).toContain("⌘ + Z conventionally means Undo");
    expect(recommendationFor("S", ["Meta"], "undo", "swedish").reason).toContain("⌘ + S conventionally means Save");
    expect(recommendationFor("C", ["Meta"], "general", "swedish")).toMatchObject({
      value: "avoid",
      reason: expect.stringContaining("⌘ + C conventionally means Copy"),
    });
    expect(recommendationFor("P", ["Control"], "general", "swedish").reason).toContain("Ctrl + P normally opens the browser Print dialog");
  });

  it("describes Control + L as a browser location-bar override, not a List convention", () => {
    expect(recommendationFor("L", ["Control"], "save", "swedish").reason).toContain("normally focuses the browser location bar");
    expect(recommendationFor("L", ["Control"], "list", "swedish", "Edge")).toMatchObject({
      value: "acceptable",
      reason: expect.stringContaining("intercepts Edge's location-bar shortcut"),
    });
  });

  it("flags character shortcuts that require modifiers on Nordic layouts", () => {
    expect(recommendationFor("?", [], "general", "swedish").value).toBe("avoid");
  });

  it("creates shareable compatibility paths", () => {
    expect(shortcutPath({ id: "ctrl-f", display: "Ctrl + F", modifiers: ["Control"], key: "F" }, "Edge", "Windows 11")).toBe("/ctrl-f/edge/windows-11");
  });

  it("captures shortcuts continuously, including while a form control has focus", () => {
    const pageTarget = { matches: () => false } as unknown as EventTarget;
    const inputTarget = { matches: () => true } as unknown as EventTarget;
    expect(shouldCaptureShortcut({ key: "f", ctrlKey: true, altKey: false, metaKey: false, shiftKey: false, repeat: false, target: pageTarget })).toBe(true);
    expect(shouldCaptureShortcut({ key: "f", ctrlKey: true, altKey: false, metaKey: false, shiftKey: false, repeat: false, target: inputTarget })).toBe(true);
    expect(shouldCaptureShortcut({ key: "?", ctrlKey: false, altKey: false, metaKey: false, shiftKey: true, repeat: false, target: pageTarget })).toBe(true);
  });

  it("shows the physical key and macOS modifier name for Option shortcuts", () => {
    const shortcut = shortcutFromEvent({
      key: "\uf8ff", code: "KeyA", ctrlKey: false, altKey: true, shiftKey: false, metaKey: false,
    } as KeyboardEvent, "mac", "swedish");

    expect(shortcut).toMatchObject({ id: "alt-a", display: "Option (⌥) + A", key: "A", code: "KeyA", logicalKey: "\uf8ff" });
  });

  it("shows the produced character while retaining the physical code", () => {
    const shortcut = shortcutFromEvent({
      key: "@", code: "KeyQ", ctrlKey: true, altKey: true, shiftKey: false, metaKey: false,
    } as KeyboardEvent, "windows", "german");

    expect(shortcut).toMatchObject({ display: "Ctrl + Alt + @", key: "@", code: "KeyQ" });
  });

  it("keeps a letter key readable when Option and Shift produce a symbol", () => {
    const shortcut = shortcutFromEvent({
      key: "◊", code: "KeyA", ctrlKey: true, altKey: true, shiftKey: true, metaKey: false,
    } as KeyboardEvent, "mac", "swedish");

    expect(shortcut).toMatchObject({ display: "Control (⌃) + Option (⌥) + Shift + A", key: "A", code: "KeyA", logicalKey: "◊" });
  });

  it("preserves shifted punctuation from a Swedish macOS keyboard", () => {
    const shortcut = shortcutFromEvent({
      key: "?", code: "Minus", ctrlKey: false, altKey: false, shiftKey: true, metaKey: false,
    } as KeyboardEvent, "mac", "swedish");

    expect(shortcut).toMatchObject({ display: "Shift + ?", key: "?", code: "Minus" });
  });

  it("combines independently selected macOS modifiers in a stable order", () => {
    const shortcut = shortcutFromSelection("Z", ["Shift", "Meta"], "mac");

    expect(shortcut).toEqual({ id: "meta-shift-z", display: "Command (⌘) + Shift + Z", modifiers: ["Meta", "Shift"], key: "Z" });
  });

  it("keeps destructive browser shortcuts out of guided contributions", () => {
    const excluded = ["Ctrl + W", "Ctrl + R", "Ctrl + Q", "Ctrl + T", "Alt + Left", "Alt + Right", "Alt + F4", "F5"];

    expect(contributionShortcuts).toHaveLength(20);
    expect(contributionShortcuts.filter((shortcut) => excluded.includes(shortcut))).toEqual([]);
  });

  it("does not present the hardware-managed Fn key as a bindable macOS key", () => {
    expect(keyboardRows("swedish", "mac").flat().some((key) => key.code === "Fn")).toBe(false);
  });
});
