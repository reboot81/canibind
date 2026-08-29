import { describe, expect, it } from "vitest";
import { parseUserAgent } from "../src/environment";

describe("environment detection", () => {
  it("detects Edge on Windows", () => {
    const result = parseUserAgent("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/140.0 Safari/537.36 Edg/140.0");
    expect(result.browser).toBe("Edge");
    expect(result.browserVersion).toBe("140.0");
    expect(result.os).toBe("Windows");
  });

  it("does not mistake an iPhone for macOS", () => {
    const result = parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1");
    expect(result.os).toBe("iOS");
    expect(result.browser).toBe("Safari");
  });
});
