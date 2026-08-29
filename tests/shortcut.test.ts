import { describe, expect, it } from "vitest";
import { contributionShortcuts } from "../src/keyboard";
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

  it("flags character shortcuts that require modifiers on Nordic layouts", () => {
    expect(recommendationFor("?", [], "general", "swedish").value).toBe("avoid");
  });

  it("creates shareable compatibility paths", () => {
    expect(shortcutPath({ id: "ctrl-f", display: "Ctrl + F", modifiers: ["Control"], key: "F" }, "Edge", "Windows 11")).toBe("/ctrl-f/edge/windows-11");
  });

  it("captures shortcuts continuously but ignores typing fields", () => {
    const pageTarget = { matches: () => false } as unknown as EventTarget;
    const inputTarget = { matches: () => true } as unknown as EventTarget;
    expect(shouldCaptureShortcut({ key: "f", ctrlKey: true, altKey: false, metaKey: false, shiftKey: false, repeat: false, target: pageTarget })).toBe(true);
    expect(shouldCaptureShortcut({ key: "f", ctrlKey: true, altKey: false, metaKey: false, shiftKey: false, repeat: false, target: inputTarget })).toBe(false);
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
});
