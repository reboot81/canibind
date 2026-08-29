import type { KeyDefinition, KeyboardPlatform, Layout } from "./types";

const usLetters = ["Q","W","E","R","T","Y","U","I","O","P","[","]","A","S","D","F","G","H","J","K","L",";","'","Z","X","C","V","B","N","M",",",".","/"];
const swedishLetters = ["Q","W","E","R","T","Y","U","I","O","P","Å","¨","A","S","D","F","G","H","J","K","L","Ö","Ä","Z","X","C","V","B","N","M",",",".","-"];

const letters: Record<Layout, string[]> = {
  us: usLetters,
  uk: usLetters,
  swedish: swedishLetters,
  finnish: swedishLetters,
  danish: ["Q","W","E","R","T","Y","U","I","O","P","Å","¨","A","S","D","F","G","H","J","K","L","Æ","Ø","Z","X","C","V","B","N","M",",",".","-"],
  norwegian: ["Q","W","E","R","T","Y","U","I","O","P","Å","¨","A","S","D","F","G","H","J","K","L","Ø","Æ","Z","X","C","V","B","N","M",",",".","-"],
  german: ["Q","W","E","R","T","Z","U","I","O","P","Ü","+","A","S","D","F","G","H","J","K","L","Ö","Ä","Y","X","C","V","B","N","M",",",".","-"],
  "swiss-german": ["Q","W","E","R","T","Z","U","I","O","P","Ü","¨","A","S","D","F","G","H","J","K","L","Ö","Ä","Y","X","C","V","B","N","M",",",".","-"],
  "swiss-french": ["Q","W","E","R","T","Z","U","I","O","P","È","¨","A","S","D","F","G","H","J","K","L","É","À","Y","X","C","V","B","N","M",",",".","-"],
  french: ["A","Z","E","R","T","Y","U","I","O","P","^","$","Q","S","D","F","G","H","J","K","L","M","Ù","W","X","C","V","B","N",",",";",":","!"],
  belgian: ["A","Z","E","R","T","Y","U","I","O","P","^","$","Q","S","D","F","G","H","J","K","L","M","Ù","W","X","C","V","B","N",",",";",":","="],
  spanish: ["Q","W","E","R","T","Y","U","I","O","P","`","+","A","S","D","F","G","H","J","K","L","Ñ","´","Z","X","C","V","B","N","M",",",".","-"],
  italian: ["Q","W","E","R","T","Y","U","I","O","P","È","+","A","S","D","F","G","H","J","K","L","Ò","À","Z","X","C","V","B","N","M",",",".","-"],
  portuguese: ["Q","W","E","R","T","Y","U","I","O","P","+","´","A","S","D","F","G","H","J","K","L","Ç","º","Z","X","C","V","B","N","M",",",".","-"],
  dutch: usLetters,
  polish: usLetters,
  czech: ["Q","W","E","R","T","Z","U","I","O","P","Ú",")","A","S","D","F","G","H","J","K","L","Ů","§","Y","X","C","V","B","N","M",",",".","-"],
  "canadian-french": ["Q","W","E","R","T","Y","U","I","O","P","^","Ç","A","S","D","F","G","H","J","K","L",";","È","Z","X","C","V","B","N","M",",",".","É"],
  dvorak: ["'",",",".","P","Y","F","G","C","R","L","/","=","A","O","E","U","I","D","H","T","N","S","-",";","Q","J","K","X","B","M","W","V","Z"],
  colemak: ["Q","W","F","P","G","J","L","U","Y",";","[","]","A","R","S","T","D","H","N","E","I","O","'","Z","X","C","V","B","K","M",",",".","/"],
};

const standardNumberRow = ["`","1","2","3","4","5","6","7","8","9","0","-","+"];
const numberRows: Record<Layout, string[]> = {
  us: standardNumberRow, uk: ["¬","1","2","3","4","5","6","7","8","9","0","-","="],
  swedish: ["§","1","2","3","4","5","6","7","8","9","0","+","´"], finnish: ["§","1","2","3","4","5","6","7","8","9","0","+","´"],
  danish: ["½","1","2","3","4","5","6","7","8","9","0","+","´"], norwegian: ["|","1","2","3","4","5","6","7","8","9","0","+","\\"],
  german: ["^","1","2","3","4","5","6","7","8","9","0","ß","´"], "swiss-german": ["§","1","2","3","4","5","6","7","8","9","0","'","^"],
  "swiss-french": ["§","1","2","3","4","5","6","7","8","9","0","'","^"], french: ["²","&","É","\"","'","(","-","È","_","Ç","À",")","="],
  belgian: ["²","&","É","\"","'","(","§","È","!","Ç","À",")","-"], spanish: ["º","1","2","3","4","5","6","7","8","9","0","'","¡"],
  italian: ["\\","1","2","3","4","5","6","7","8","9","0","'","Ì"], portuguese: ["\\","1","2","3","4","5","6","7","8","9","0","'","«"],
  dutch: standardNumberRow, polish: standardNumberRow, czech: [";","+","Ě","Š","Č","Ř","Ž","Ý","Á","Í","É","=","´"],
  "canadian-french": ["/","1","2","3","4","5","6","7","8","9","0","-","="], dvorak: standardNumberRow, colemak: standardNumberRow,
};

const codes = ["KeyQ","KeyW","KeyE","KeyR","KeyT","KeyY","KeyU","KeyI","KeyO","KeyP","BracketLeft","BracketRight","KeyA","KeyS","KeyD","KeyF","KeyG","KeyH","KeyJ","KeyK","KeyL","Semicolon","Quote","KeyZ","KeyX","KeyC","KeyV","KeyB","KeyN","KeyM","Comma","Period","Slash"];

export function keyboardRows(layout: Layout, platform: KeyboardPlatform): KeyDefinition[][] {
  const values = letters[layout];
  const numberValues = numberRows[layout];
  const map = Object.fromEntries(codes.map((code, index) => [code, values[index]]));
  const key = (code: string, label = map[code] ?? code, size?: KeyDefinition["size"]): KeyDefinition => ({ code, label, size });
  const bottom = platform === "mac"
    ? [key("Fn","fn"), key("ControlLeft","Control (⌃)", "wide"), key("AltLeft","Option (⌥)", "wide"), key("MetaLeft","Command (⌘)", "wide"), key("Space","Space", "space"), key("MetaRight","Command (⌘)", "wide"), key("AltRight","Option (⌥)", "wide")]
    : [key("ControlLeft","Ctrl", "wide"), key("MetaLeft","Windows", "wide"), key("AltLeft","Alt", "wide"), key("Space","Space", "space"), key("AltRight","Alt", "wide"), key("ControlRight","Ctrl", "wide")];
  return [
    [key("Escape","Esc"), ...["F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12"].map((value) => key(value, value))],
    [key("Backquote", numberValues[0]), ..."1234567890".split("").map((value, index) => key(`Digit${value}`, numberValues[index + 1])), key("Minus", numberValues[11]), key("Equal", numberValues[12])],
    [key("Tab","Tab", "wide"), ...["KeyQ","KeyW","KeyE","KeyR","KeyT","KeyY","KeyU","KeyI","KeyO","KeyP","BracketLeft","BracketRight"].map((code) => key(code))],
    [key("CapsLock","Caps", "wide"), ...["KeyA","KeyS","KeyD","KeyF","KeyG","KeyH","KeyJ","KeyK","KeyL","Semicolon","Quote"].map((code) => key(code)), key("Enter","Enter", "wide")],
    [key("ShiftLeft","Shift", "wide"), ...["KeyZ","KeyX","KeyC","KeyV","KeyB","KeyN","KeyM","Comma","Period","Slash"].map((code) => key(code)), key("ShiftRight","Shift", "wide")],
    bottom,
  ];
}

export const contributionShortcuts = [
  "Ctrl + F","Ctrl + S","Ctrl + Z","Ctrl + Y","Ctrl + K","Ctrl + Shift + P","Ctrl + Shift + Z","Ctrl + Shift + F",
  "Ctrl + Shift + K","Ctrl + Shift + S","Ctrl + Alt + X","Ctrl + Alt + S","Ctrl + Alt + K","Ctrl + Alt + M",
  "Ctrl + Alt + D","Ctrl + Alt + G","Ctrl + Space","Alt + Shift + X","F2","Escape",
];
