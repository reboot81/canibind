import type { Environment, Layout } from "./types";

export function parseUserAgent(userAgent: string, platform = ""): Omit<Environment, "layout"> {
  const browser = userAgent.includes("Edg/")
    ? "Edge"
    : userAgent.includes("OPR/")
      ? "Opera"
      : userAgent.includes("Vivaldi/")
        ? "Vivaldi"
        : userAgent.includes("Firefox/")
          ? "Firefox"
          : userAgent.includes("Chrome/")
            ? "Chrome"
            : userAgent.includes("Safari/")
              ? "Safari"
              : "Unknown browser";
  const versionTokens: Record<string, string> = {
    Edge: "Edg", Opera: "OPR", Vivaldi: "Vivaldi", Firefox: "Firefox", Chrome: "Chrome", Safari: "Version",
  };
  const token = versionTokens[browser];
  const match = token ? userAgent.match(new RegExp(`${token}/(\\d+(?:\\.\\d+)?)`)) : null;
  const browserVersion = match?.[1] ?? "Unknown version";
  const combined = `${userAgent} ${platform}`;
  const os = combined.includes("iPad")
    ? "iPadOS"
    : combined.includes("iPhone")
      ? "iOS"
      : combined.includes("Android")
        ? "Android"
        : combined.includes("Windows")
    ? "Windows"
    : combined.includes("Mac")
      ? "macOS"
      : combined.includes("Linux")
        ? "Linux"
        : "Unknown OS";
  return { browser, browserVersion, os };
}

export function detectEnvironment(): Environment {
  return { ...parseUserAgent(navigator.userAgent, navigator.platform), layout: "us" };
}

interface KeyboardLayoutMapLike { get(code: string): string | undefined; }
interface NavigatorWithKeyboard extends Navigator {
  keyboard?: { getLayoutMap?: () => Promise<KeyboardLayoutMapLike> };
  brave?: { isBrave?: () => Promise<boolean> };
}

export async function detectBrowserOverride(): Promise<string | null> {
  const brave = (navigator as NavigatorWithKeyboard).brave;
  if (!brave?.isBrave) return null;
  try {
    return (await brave.isBrave()) ? "Brave" : null;
  } catch {
    return null;
  }
}

export async function detectKeyboardLayout(): Promise<Layout | null> {
  const keyboard = (navigator as NavigatorWithKeyboard).keyboard;
  if (!keyboard?.getLayoutMap) return null;
  try {
    const map = await keyboard.getLayoutMap();
    const y = map.get("KeyY")?.toLowerCase();
    const z = map.get("KeyZ")?.toLowerCase();
    const bracket = map.get("BracketLeft")?.toLowerCase();
    const semicolon = map.get("Semicolon")?.toLowerCase();
    if (y === "z" && z === "y") return "german";
    if (bracket === "å" || semicolon === "ö") return "swedish";
    if (y === "y" && z === "z") return null;
    return null;
  } catch {
    return null;
  }
}
