import { describe, expect, it } from "vitest";
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
    expect(shouldCaptureShortcut({ key: "f", ctrlKey: true, altKey: false, metaKey: false, repeat: false, target: pageTarget })).toBe(true);
    expect(shouldCaptureShortcut({ key: "f", ctrlKey: true, altKey: false, metaKey: false, repeat: false, target: inputTarget })).toBe(false);
  });

  it("shows the physical key and macOS modifier name for Option shortcuts", () => {
    const shortcut = shortcutFromEvent({
      key: "\uf8ff", code: "KeyA", ctrlKey: false, altKey: true, shiftKey: false, metaKey: false,
    } as KeyboardEvent, "mac", "swedish");

    expect(shortcut).toMatchObject({ id: "alt-a", display: "Option + A", key: "A", code: "KeyA", logicalKey: "\uf8ff" });
  });

  it("uses the selected physical layout instead of the produced character", () => {
    const shortcut = shortcutFromEvent({
      key: "@", code: "KeyQ", ctrlKey: true, altKey: true, shiftKey: false, metaKey: false,
    } as KeyboardEvent, "windows", "german");

    expect(shortcut).toMatchObject({ display: "Ctrl + Alt + Q", key: "Q", logicalKey: "@" });
  });

  it("combines independently selected macOS modifiers in a stable order", () => {
    const shortcut = shortcutFromSelection("Z", ["Shift", "Meta"], "mac");

    expect(shortcut).toEqual({ id: "meta-shift-z", display: "Command + Shift + Z", modifiers: ["Meta", "Shift"], key: "Z" });
  });
});
