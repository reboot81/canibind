import { describe, expect, it } from "vitest";
import { normalizeKey, recommendationFor, shortcutPath } from "../src/shortcut";

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
});
