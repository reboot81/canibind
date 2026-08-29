import type { KeyDefinition, KeyboardPlatform, Layout } from "./types";

const letters: Record<Layout, string[]> = {
  us: ["Q","W","E","R","T","Y","U","I","O","P","[","]","A","S","D","F","G","H","J","K","L",";","'","Z","X","C","V","B","N","M",",",".","/"],
  uk: ["Q","W","E","R","T","Y","U","I","O","P","[","]","A","S","D","F","G","H","J","K","L",";","'","Z","X","C","V","B","N","M",",",".","/"],
  swedish: ["Q","W","E","R","T","Y","U","I","O","P","Å","¨","A","S","D","F","G","H","J","K","L","Ö","Ä","Z","X","C","V","B","N","M",",",".","-"],
  german: ["Q","W","E","R","T","Z","U","I","O","P","Ü","+","A","S","D","F","G","H","J","K","L","Ö","Ä","Y","X","C","V","B","N","M",",",".","-"],
};

const codes = ["KeyQ","KeyW","KeyE","KeyR","KeyT","KeyY","KeyU","KeyI","KeyO","KeyP","BracketLeft","BracketRight","KeyA","KeyS","KeyD","KeyF","KeyG","KeyH","KeyJ","KeyK","KeyL","Semicolon","Quote","KeyZ","KeyX","KeyC","KeyV","KeyB","KeyN","KeyM","Comma","Period","Slash"];

export function keyboardRows(layout: Layout, platform: KeyboardPlatform): KeyDefinition[][] {
  const values = letters[layout];
  const map = Object.fromEntries(codes.map((code, index) => [code, values[index]]));
  const key = (code: string, label = map[code] ?? code, size?: KeyDefinition["size"]): KeyDefinition => ({ code, label, size });
  const bottom = platform === "mac"
    ? [key("Fn","fn"), key("ControlLeft","Control (⌃)", "wide"), key("AltLeft","Option (⌥)", "wide"), key("MetaLeft","Command (⌘)", "wide"), key("Space","Space", "space"), key("MetaRight","Command (⌘)", "wide"), key("AltRight","Option (⌥)", "wide")]
    : [key("ControlLeft","Ctrl", "wide"), key("MetaLeft","Windows", "wide"), key("AltLeft","Alt", "wide"), key("Space","Space", "space"), key("AltRight","Alt", "wide"), key("ControlRight","Ctrl", "wide")];
  return [
    [key("Escape","Esc"), ...["F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12"].map((value) => key(value, value))],
    [key("Backquote", layout === "swedish" ? "§" : "`"), ..."1234567890".split("").map((value) => key(`Digit${value}`, value)), key("Minus","-"), key("Equal","+")],
    [key("Tab","Tab", "wide"), ...["KeyQ","KeyW","KeyE","KeyR","KeyT","KeyY","KeyU","KeyI","KeyO","KeyP","BracketLeft","BracketRight"].map((code) => key(code))],
    [key("CapsLock","Caps", "wide"), ...["KeyA","KeyS","KeyD","KeyF","KeyG","KeyH","KeyJ","KeyK","KeyL","Semicolon","Quote"].map((code) => key(code)), key("Enter","Enter", "wide")],
    [key("ShiftLeft","Shift", "wide"), ...["KeyZ","KeyX","KeyC","KeyV","KeyB","KeyN","KeyM","Comma","Period","Slash"].map((code) => key(code)), key("ShiftRight","Shift", "wide")],
    bottom,
  ];
}

export const contributionShortcuts = [
  "Ctrl + F","Ctrl + S","Ctrl + Z","Ctrl + N","Ctrl + L","Ctrl + R","Ctrl + W","Ctrl + T","Ctrl + P","Ctrl + K",
  "Ctrl + Shift + P","Ctrl + Shift + Z","Ctrl + Alt + X","Alt + F","Alt + Left","Alt + Right","F1","F2","F5","Escape",
];
