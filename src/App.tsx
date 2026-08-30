import { useEffect, useMemo, useRef, useState } from "react";
import Demo from "./Demo";
import { detectBrowserOverride, detectEnvironment, detectKeyboardLayout } from "./environment";
import { guardrailGroups } from "./guardrails";
import { t } from "./i18n";
import { contributionShortcuts, keyboardRows } from "./keyboard";
import { recommendationFor, shortcutFromEvent, shortcutFromSelection, shortcutPath, shouldCaptureShortcut } from "./shortcut";
import type { Capability, ContributionResult, Dataset, Environment, Intent, KeyDefinition, KeyboardPlatform, Layout, Recommendation, Shortcut, Theme } from "./types";

const defaultShortcut: Shortcut = { id: "ctrl-f", display: "Ctrl + F", modifiers: ["Control"], key: "F" };
const copy = t();
const browsers = ["Chrome", "Edge", "Firefox", "Safari", "Brave", "Opera", "Vivaldi"];
const systems = ["Windows", "macOS", "Linux", "iPadOS", "iOS", "Android"];
const layouts: { value: Layout; label: string }[] = [
  { value: "us", label: "English (US)" }, { value: "uk", label: "English (UK)" }, { value: "swedish", label: "Swedish" },
  { value: "finnish", label: "Finnish" }, { value: "danish", label: "Danish" }, { value: "norwegian", label: "Norwegian" },
  { value: "german", label: "German" }, { value: "swiss-german", label: "Swiss German" }, { value: "swiss-french", label: "Swiss French" },
  { value: "french", label: "French (AZERTY)" }, { value: "belgian", label: "Belgian (AZERTY)" }, { value: "spanish", label: "Spanish" },
  { value: "italian", label: "Italian" }, { value: "portuguese", label: "Portuguese" }, { value: "dutch", label: "Dutch" },
  { value: "polish", label: "Polish (Programmers)" }, { value: "czech", label: "Czech (QWERTZ)" }, { value: "canadian-french", label: "Canadian French" },
  { value: "dvorak", label: "English (Dvorak)" }, { value: "colemak", label: "English (Colemak)" },
];
const intents: { value: Intent; label: string }[] = [
  { value: "general", label: "General command" }, { value: "undo", label: "Undo" }, { value: "save", label: "Save" },
  { value: "search", label: "Find / search" }, { value: "list", label: "Open list" }, { value: "new-record", label: "Create new record" },
];

const initialLabCode = `<!doctype html>
<html lang="en">
<button id="save" aria-keyshortcuts="Control+S Meta+S">Save</button>
<button id="undo" aria-keyshortcuts="Control+Z Meta+Z">Undo</button>
<output id="result">Waiting for a shortcut…</output>
<script>
  const output = document.querySelector("#result");
  const commands = new Map([["s", "Save"], ["z", "Undo"]]);

  function handleShortcut(event) {
    if (event.defaultPrevented || event.repeat || event.isComposing) return;
    if (event.target.matches("input, textarea, select, [contenteditable]")) return;
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;

    const action = commands.get(event.key.toLowerCase());
    if (!action || !event.cancelable) return;

    event.preventDefault();
    output.textContent = action + " handler ran; browser default cancelled";
  }

  addEventListener("keydown", handleShortcut);
</script>
</html>`;

function statusLabel(value: Capability | Recommendation): string { return value === "acceptable" ? "DEPENDS" : value.replaceAll("-", " ").toUpperCase(); }
function statusSymbol(value: Capability | Recommendation): string {
  if (value === "yes" || value === "recommended") return "✓";
  if (value === "conditional" || value === "acceptable") return "!";
  if (value === "no" || value === "avoid") return "×";
  return "?";
}

const codeTokenPattern = /(<!--[\s\S]*?-->|\/\*[\s\S]*?\*\/|\/\/[^\n]*|<\/?[a-z][^>]*>|`(?:\\.|[^`])*`|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\b(?:addEventListener|const|else|false|function|if|null|return|true|new)\b|\b\d+\b)/gi;
function highlightCode(source: string) {
  return source.split(codeTokenPattern).map((token, index) => {
    const className = token.startsWith("//") || token.startsWith("/*") || token.startsWith("<!--") ? "token-comment" : token.startsWith("<") ? "token-tag" : /^["'`]/.test(token) ? "token-string" : /^\d/.test(token) ? "token-number" : /^(addEventListener|const|else|false|function|if|null|return|true|new)$/.test(token) ? "token-keyword" : "";
    return className ? <span className={className} key={`${index}-${token}`}>{token}</span> : token;
  });
}

function layoutLabel(layout: Layout): string { return layouts.find((item) => item.value === layout)?.label ?? layout; }
function platformShortcutLabel(shortcut: string, platform: KeyboardPlatform): string {
  return platform === "windows" ? shortcut.replace(/\bWin\b/g, "Windows") : shortcut.replaceAll("Ctrl", "Command (⌘)").replaceAll("Alt", "Option (⌥)");
}
function platformFromOs(os: string): KeyboardPlatform { return ["macOS", "iOS", "iPadOS"].includes(os) ? "mac" : "windows"; }
function pathSlug(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function shortcutFromSharedPath(pathname: string): { shortcut: Shortcut; browser: string; os: string } | null {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const parts = pathname.replace(base, "").split("/").filter(Boolean);
  if (parts.length < 3) return null;
  const [shortcutId, browserSlug, osSlug] = parts;
  const browser = browsers.find((item) => pathSlug(item) === browserSlug);
  const os = systems.find((item) => pathSlug(item) === osSlug);
  if (!browser || !os) return null;
  const tokens = shortcutId.split("-");
  const modifierMap: Record<string, string> = { ctrl: "Control", alt: "Alt", shift: "Shift", meta: "Meta" };
  const modifiers = tokens.filter((token) => modifierMap[token]).map((token) => modifierMap[token]);
  const keyToken = tokens.filter((token) => !modifierMap[token]).join("-");
  if (!keyToken) return null;
  const keyLabels: Record<string, string> = { esc: "Esc", escape: "Esc", space: "Space", enter: "Enter", tab: "Tab" };
  const key = keyLabels[keyToken] ?? (keyToken.length === 1 ? keyToken.toUpperCase() : keyToken.replace(/(^|-)([a-z])/g, (_, separator, letter) => `${separator}${letter.toUpperCase()}`));
  return { shortcut: shortcutFromSelection(key, modifiers, platformFromOs(os)), browser, os };
}
function compactMacShortcut(value: string): string { return value.replaceAll("Command (⌘)", "⌘").replaceAll("Control (⌃)", "⌃").replaceAll("Option (⌥)", "⌥"); }
function contributionIssueUrl(environment: Environment, layout: Layout, results: ContributionResult[]): string {
  const url = new URL("https://github.com/reboot81/canibind/issues/new");
  const configuration = `${environment.browser} ${environment.browserVersion} / ${environment.os} / ${layoutLabel(layout)}`;
  const rows = results.map((result) => `| ${result.shortcut} | ${result.result.toUpperCase()} | ${result.autoDetected ? "Auto-detected" : "Manually confirmed"} |`).join("\n");
  const body = `## Test configuration\n\n- Browser: ${environment.browser} ${environment.browserVersion}\n- Operating system: ${environment.os}\n- Keyboard layout: ${layoutLabel(layout)}\n\n## Results\n\n| Shortcut | Result | Evidence |\n| --- | --- | --- |\n${rows}\n\n## Reproduction notes\n\nPlease add any conditions, browser settings, assistive technology, or unexpected competing actions before submitting.\n\n> Generated by the Can I Bind? guided contribution test. Results remain unverified until independently reproduced.`;
  url.searchParams.set("title", `Keyboard evidence: ${configuration}`);
  url.searchParams.set("body", body);
  return url.toString();
}
function modifierForKey(key: KeyDefinition): string | null {
  if (key.code.startsWith("Control")) return "Control";
  if (key.code.startsWith("Alt")) return "Alt";
  if (key.code.startsWith("Meta")) return "Meta";
  if (key.code.startsWith("Shift")) return "Shift";
  return null;
}

export default function App() {
  const initialEnvironment = useMemo(() => detectEnvironment(), []);
  const sharedPath = useMemo(() => shortcutFromSharedPath(window.location.pathname), []);
  const [shortcut, setShortcut] = useState(() => sharedPath?.shortcut ?? defaultShortcut);
  const [isListening, setIsListening] = useState(true);
  const [liveCapability, setLiveCapability] = useState<Capability>("lack-of-data");
  const [lastDetectedAt, setLastDetectedAt] = useState<string | null>(null);
  const [detectedEnvironment, setDetectedEnvironment] = useState<Environment>(initialEnvironment);
  const [environment, setEnvironment] = useState<Environment>(() => ({ ...initialEnvironment, browser: sharedPath?.browser ?? initialEnvironment.browser, os: sharedPath?.os ?? initialEnvironment.os }));
  const [layoutDetected, setLayoutDetected] = useState(false);
  const [intent, setIntent] = useState<Intent>("search");
  const [modifiers, setModifiers] = useState<string[]>(() => sharedPath?.shortcut.modifiers ?? (initialEnvironment.os === "macOS" ? ["Meta"] : ["Control"]));
  const [keyboardPlatform, setKeyboardPlatform] = useState<KeyboardPlatform>(() => platformFromOs(sharedPath?.os ?? initialEnvironment.os));
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [testCount, setTestCount] = useState(0);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("canibind-theme") as Theme | null) ?? "system");
  const [showStatusSymbols, setShowStatusSymbols] = useState(() => localStorage.getItem("canibind-status-symbols") === "true");
  const [guardrailGroupIndex, setGuardrailGroupIndex] = useState(0);
  const [labCode, setLabCode] = useState(initialLabCode);
  const [contributionActive, setContributionActive] = useState(false);
  const [contributionIndex, setContributionIndex] = useState(0);
  const [contributionResults, setContributionResults] = useState<ContributionResult[]>([]);
  const [observedContributionKey, setObservedContributionKey] = useState<string | null>(null);
  const [detectedKeyCode, setDetectedKeyCode] = useState<string | null>(null);
  const [listenerFlash, setListenerFlash] = useState(false);
  const [contributionFlash, setContributionFlash] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const detectionFlashTimer = useRef<number | null>(null);
  const listenerFlashTimer = useRef<number | null>(null);
  const contributionFlashTimer = useRef<number | null>(null);
  const contributionAdvanceTimer = useRef<number | null>(null);
  const highlightedCodeRef = useRef<HTMLPreElement>(null);

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("canibind-theme", theme); }, [theme]);
  useEffect(() => { localStorage.setItem("canibind-status-symbols", String(showStatusSymbols)); }, [showStatusSymbols]);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/compatibility.v1.json`).then((response) => response.json()).then((value: Dataset) => setDataset(value)).catch(() => setDataset(null));
    detectKeyboardLayout().then((detected) => {
      if (!detected) return;
      setDetectedEnvironment((current) => ({ ...current, layout: detected }));
      setEnvironment((current) => ({ ...current, layout: detected }));
      setLayoutDetected(true);
    });
    detectBrowserOverride().then((browser) => {
      if (!browser) return;
      setDetectedEnvironment((current) => ({ ...current, browser }));
      setEnvironment((current) => ({ ...current, browser }));
    });
  }, []);

  const displayedExpectedContribution = platformShortcutLabel(contributionShortcuts[contributionIndex] ?? "", platformFromOs(detectedEnvironment.os));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (demoOpen) return;
      if (!isListening || !shouldCaptureShortcut(event)) return;
      event.preventDefault();
      const platform = platformFromOs(detectedEnvironment.os);
      const next = shortcutFromEvent(event, platform, environment.layout);
      if (!next) return;
      setShortcut(next);
      setKeyboardPlatform(platform);
      setModifiers(next.modifiers);
      setLiveCapability(event.cancelable && event.defaultPrevented ? "yes" : "conditional");
      setLastDetectedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setTestCount((count) => count + 1);
      setObservedContributionKey(next.display);
      setListenerFlash(false);
      window.requestAnimationFrame(() => setListenerFlash(true));
      if (listenerFlashTimer.current !== null) window.clearTimeout(listenerFlashTimer.current);
      listenerFlashTimer.current = window.setTimeout(() => setListenerFlash(false), 650);
      setDetectedKeyCode(null);
      window.requestAnimationFrame(() => {
        setDetectedKeyCode(event.code);
        if (detectionFlashTimer.current !== null) window.clearTimeout(detectionFlashTimer.current);
        detectionFlashTimer.current = window.setTimeout(() => setDetectedKeyCode(null), 1100);
      });
      if (contributionActive && next.display === platformShortcutLabel(contributionShortcuts[contributionIndex] ?? "", platform)) {
        setContributionResults((current) => {
          const result: ContributionResult = { shortcut: next.display, result: "yes", autoDetected: true };
          if (current[contributionIndex]) return current.map((item, index) => index === contributionIndex ? result : item);
          return [...current, result];
        });
        setContributionFlash(false);
        window.requestAnimationFrame(() => setContributionFlash(true));
        if (contributionFlashTimer.current !== null) window.clearTimeout(contributionFlashTimer.current);
        contributionFlashTimer.current = window.setTimeout(() => setContributionFlash(false), 900);
        if (contributionAdvanceTimer.current !== null) window.clearTimeout(contributionAdvanceTimer.current);
        if (contributionIndex < contributionShortcuts.length - 1) {
          contributionAdvanceTimer.current = window.setTimeout(() => {
            setContributionIndex((current) => current === contributionIndex ? current + 1 : current);
            setObservedContributionKey(null);
            setContributionFlash(false);
          }, 520);
        }
      }
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      window.history.replaceState(null, "", `${base}${shortcutPath(next, environment.browser, environment.os)}`);
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      if (detectionFlashTimer.current !== null) window.clearTimeout(detectionFlashTimer.current);
      if (listenerFlashTimer.current !== null) window.clearTimeout(listenerFlashTimer.current);
      if (contributionFlashTimer.current !== null) window.clearTimeout(contributionFlashTimer.current);
      if (contributionAdvanceTimer.current !== null) window.clearTimeout(contributionAdvanceTimer.current);
    };
  }, [contributionActive, contributionIndex, demoOpen, detectedEnvironment.os, environment.browser, environment.layout, environment.os, isListening]);
  useEffect(() => { document.title = `${shortcut.display} — Can I Bind?`; }, [shortcut]);

  const recommendation = useMemo(() => recommendationFor(shortcut.key, shortcut.modifiers, intent, environment.layout, environment.browser), [shortcut, intent, environment.layout, environment.browser]);
  const reference = dataset?.records.find((record) => record.shortcut === shortcut.id && record.intent === intent);
  const keyboard = useMemo(() => keyboardRows(environment.layout, keyboardPlatform), [environment.layout, keyboardPlatform]);
  const minimumContributionSize = dataset?.minimumContributionSize ?? 5;
  const contributionReady = contributionResults.length >= minimumContributionSize;
  const contributionFinished = contributionResults.length === contributionShortcuts.length;
  const currentContributionResult = contributionResults[contributionIndex];
  const contributionUrl = useMemo(() => contributionIssueUrl(detectedEnvironment, environment.layout, contributionResults), [contributionResults, detectedEnvironment, environment.layout]);
  const activeGuardrailGroup = guardrailGroups[guardrailGroupIndex];

  const switchKeyboardPlatform = (platform: KeyboardPlatform) => {
    setKeyboardPlatform(platform);
    setModifiers((current) => current.map((modifier) => platform === "mac" && modifier === "Control" ? "Meta" : platform === "windows" && modifier === "Meta" ? "Control" : modifier).filter((modifier, index, values) => values.indexOf(modifier) === index));
  };
  const toggleModifier = (modifier: string) => { setModifiers((current) => current.includes(modifier) ? current.filter((item) => item !== modifier) : [...current, modifier]); };
  const selectKeyboardKey = (key: KeyDefinition) => {
    const modifier = modifierForKey(key);
    if (modifier) { toggleModifier(modifier); return; }
    const next = shortcutFromSelection(key.label, modifiers, keyboardPlatform, key.code);
    setShortcut(next); setLiveCapability("lack-of-data"); setLastDetectedAt(null);
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    window.history.replaceState(null, "", `${base}${shortcutPath(next, environment.browser, environment.os)}`);
  };
  const changeReferenceOs = (os: string) => { setEnvironment((current) => ({ ...current, os })); switchKeyboardPlatform(platformFromOs(os)); };
  const setContributionResult = (index: number, result: ContributionResult["result"], autoDetected = false) => {
    const shortcutLabel = platformShortcutLabel(contributionShortcuts[index], platformFromOs(detectedEnvironment.os));
    setContributionResults((current) => {
      const next: ContributionResult = { shortcut: shortcutLabel, result, autoDetected };
      if (current[index]) return current.map((item, itemIndex) => itemIndex === index ? next : item);
      return index === current.length ? [...current, next] : current;
    });
  };
  const startContribution = () => { setContributionActive(true); setContributionIndex(0); setContributionResults([]); setObservedContributionKey(null); setIsListening(true); };
  const nextContribution = () => { if (!currentContributionResult || contributionFinished) return; setContributionIndex((index) => index + 1); setObservedContributionKey(null); };
  const liveObservationText = liveCapability === "yes" ? `The page received ${shortcut.display}, ran the handler, and cancelled the browser default. For browser-owned commands such as Find, this means the page overrides and replaces that browser shortcut for this press.` : liveCapability === "conditional" ? "The page received the event, but the browser did not report a cancelled default. Confirm the competing action manually." : "The continuous listener is ready. Press a shortcut to create a live observation.";

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="topbar">
        <a className="brand" href={import.meta.env.BASE_URL} aria-label="Can I Bind home"><span className="brand-mark">CIB?</span><span className="brand-copy"><strong>Can I Bind?</strong><small>Open data for usable keyboard interfaces.</small></span></a>
        <nav aria-label="Primary navigation"><a href="#keyboard">{copy.nav.keyboard}</a><a href="#contribute">{copy.nav.contribute}</a><a href="#implementation">{copy.nav.lab}</a><a href="#demo">{copy.nav.demo}</a><a href="#about">{copy.nav.about}</a></nav>
        <div className="header-controls"><div className="theme-options" role="group" aria-label="Theme"><button type="button" aria-pressed={theme === "light"} title="Use light theme" onClick={() => setTheme("light")}>Light</button><button type="button" aria-pressed={theme === "dark"} title="Use dark theme" onClick={() => setTheme("dark")}>Dark</button><button type="button" aria-pressed={theme === "system"} title="Follow the system theme" onClick={() => setTheme("system")}>Auto</button></div><button className="symbol-button" type="button" aria-pressed={showStatusSymbols} title="Show or hide text symbols alongside status colours." onClick={() => setShowStatusSymbols((value) => !value)}><span aria-hidden="true">{showStatusSymbols ? "✓" : "○"}</span> Status symbols: {showStatusSymbols ? "On" : "Off"}</button></div>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section className="hero" id="explore">
          <h1><span className="question-prefix">Can I bind</span><span className="shortcut-title">{shortcut.display}{shortcut.display.endsWith("?") ? "" : "?"}</span></h1>
          <p className="hero-subtitle">Live compatibility evidence and practical shortcut guidance by browser, operating system, keyboard layout, and intended action.</p>
          <div className={`listener ${isListening ? "listener-on" : "listener-off"} ${listenerFlash ? "listener-detected" : ""}`} aria-live="polite"><div className="listener-indicator"><span className="pulse" aria-hidden="true" /><div><strong>{isListening ? "Listening continuously" : "Detection paused"}</strong><small>{isListening ? "Press another shortcut anywhere on this page." : "Resume to detect keyboard shortcuts."}</small></div></div><kbd>{shortcut.display}</kbd><button type="button" title={isListening ? "Pause detection if you want to use keyboard shortcuts normally on this page." : "Resume continuous shortcut detection on this page."} aria-pressed={isListening} onClick={() => setIsListening((value) => !value)}>{isListening ? "Pause" : "Resume"}</button></div>
          <p className="capture-note">Latest event: <strong>{lastDetectedAt ? `${shortcut.display} detected at ${lastDetectedAt}` : "No shortcut detected yet"}</strong>.{shortcut.logicalKey ? <> Browser value: <code>event.key = ${JSON.stringify(shortcut.logicalKey)}</code>.</> : null} Detection stays active while controls and the code editor have focus.</p>
        </section>

        <section className="detected-context" aria-label="Detected environment"><div><span>Browser</span><strong>{detectedEnvironment.browser} {detectedEnvironment.browserVersion}</strong><small>Detected</small></div><div><span>Operating system</span><strong>{detectedEnvironment.os}</strong><small>Detected</small></div><div><span>Keyboard layout</span><strong>{layoutDetected ? layoutLabel(detectedEnvironment.layout) : "Not reliably detected"}</strong><small>{layoutDetected ? "Detected from the browser map" : "Confirm it in Keyboard map"}</small></div></section>

        <VerdictModule reference={reference} recommendation={recommendation} intent={intent} liveCapability={liveCapability} liveObservationText={liveObservationText} testCount={testCount} showStatusSymbols={showStatusSymbols} />

        <section className="keyboard-section" id="keyboard">
          <div className="section-heading"><div><p className="eyebrow">Interactive reference</p><h2>Keyboard map</h2><p>Use the Listening continuously panel above for live detection. Here, choose the reference context and select modifiers directly on the keyboard.</p></div></div>
          <div className="keyboard-toolbar"><label><span>Browser</span><select value={environment.browser} onChange={(event) => setEnvironment((current) => ({ ...current, browser: event.target.value }))}>{browsers.map((browser) => <option key={browser}>{browser}</option>)}</select></label><label><span>Operating system</span><select value={environment.os} onChange={(event) => changeReferenceOs(event.target.value)}>{systems.map((system) => <option key={system}>{system}</option>)}</select></label><label><span>Layout</span><select value={environment.layout} onChange={(event) => setEnvironment((current) => ({ ...current, layout: event.target.value as Layout }))}>{layouts.map((layout) => <option value={layout.value} key={layout.value}>{layout.label}</option>)}</select></label><label><span>Assess as</span><select value={intent} onChange={(event) => setIntent(event.target.value as Intent)}>{intents.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label><div className="modifier-instruction"><span>Modifiers</span><strong>{modifiers.length ? modifiers.map((modifier) => modifier === "Meta" ? keyboardPlatform === "mac" ? "Command (⌘)" : "Windows" : modifier === "Alt" && keyboardPlatform === "mac" ? "Option (⌥)" : modifier).join(" + ") : "None selected"}</strong><button type="button" disabled={!modifiers.length} onClick={() => setModifiers([])}>Clear</button></div></div>
          <div className="keyboard" role="group" aria-label={`${keyboardPlatform} ${layoutLabel(environment.layout)} keyboard`}>{keyboard.map((row, rowIndex) => <div className="keyboard-row" key={rowIndex}>{row.map((item) => {
            const modifier = modifierForKey(item);
            const rec = modifier ? { value: "lack-of-data" as Recommendation, reason: `Toggle ${item.label} for the shortcut.` } : recommendationFor(item.label, modifiers, intent, environment.layout, environment.browser);
            const isCurrent = !modifier && shortcut.key.toUpperCase() === item.label.toUpperCase() && shortcut.modifiers.length === modifiers.length && modifiers.every((selected) => shortcut.modifiers.includes(selected));
            const isSelectedModifier = modifier ? modifiers.includes(modifier) : false;
            const isDetected = item.code === detectedKeyCode;
            return <button type="button" className={`keyboard-key key-${rec.value} ${item.size ? `key-${item.size}` : ""} ${modifier ? "modifier-key" : ""} ${isSelectedModifier ? "selected-modifier" : ""} ${isCurrent ? "current-key" : ""} ${isDetected ? "detected-key" : ""}`} title={rec.reason} aria-label={modifier ? `${item.label}: ${isSelectedModifier ? "selected" : "not selected"}` : `${item.label}: ${statusLabel(rec.value)}`} aria-pressed={modifier ? isSelectedModifier : undefined} onClick={() => selectKeyboardKey(item)} key={`${item.code}-${item.label}`}><span>{item.label}</span>{showStatusSymbols && !modifier ? <b className="key-status-symbol" aria-hidden="true">{statusSymbol(rec.value)}</b> : null}</button>;
          })}</div>)}</div>
          <div className={`legend ${showStatusSymbols ? "legend-with-symbols" : ""}`}><span><i className="legend-recommended" aria-hidden="true">{showStatusSymbols ? "✓" : ""}</i> Recommended</span><span><i className="legend-acceptable" aria-hidden="true">{showStatusSymbols ? "!" : ""}</i> Depends</span><span><i className="legend-avoid" aria-hidden="true">{showStatusSymbols ? "×" : ""}</i> Avoid</span><span><i className="legend-lack" aria-hidden="true">{showStatusSymbols ? "?" : ""}</i> Lack of data</span><span><i className="legend-selected" aria-hidden="true" /> Selected modifier</span></div>
          <VerdictModule className="keyboard-verdict-grid" reference={reference} recommendation={recommendation} intent={intent} liveCapability={liveCapability} liveObservationText={liveObservationText} testCount={testCount} showStatusSymbols={showStatusSymbols} />
        </section>

        <section className="contribute-section" id="contribute">
          <div className="section-heading"><div><p className="eyebrow">Community evidence</p><h2>Run a guided contribution test</h2><p>Five combinations are enough to prepare a contribution. Continue for as many as you like. A matching event is marked Worked automatically; every result remains editable.</p></div><span className={`progress-label ${contributionReady ? "ready" : ""}`}>{contributionResults.length} tested · minimum {minimumContributionSize}</span></div>
          {!contributionActive ? <div className="contribute-start"><ul><li>The current browser and operating system are detected.</li><li>Confirm the keyboard layout in Keyboard map before starting.</li><li>Close, quit, reload, and history-navigation shortcuts are excluded.</li><li>No account identifier or IP address is added to the public dataset.</li><li>Results remain unverified until independently reproduced.</li></ul><button className="primary-button" type="button" onClick={startContribution}>Start guided test</button></div> : <>
            <div className={`guided-test ${contributionFlash ? "test-success" : ""}`} aria-live="polite"><div className="test-config"><span>Test configuration</span><strong>{detectedEnvironment.browser} {detectedEnvironment.browserVersion} · {detectedEnvironment.os} · {layoutLabel(environment.layout)}</strong><small>Browser and OS detected; layout taken from Keyboard map.</small></div><div className="test-target"><small>Test {contributionIndex + 1} of {contributionShortcuts.length}</small><kbd>{displayedExpectedContribution}</kbd><p>{currentContributionResult?.autoDetected ? "Detected and marked Worked — advancing automatically." : observedContributionKey ? `Latest event was ${observedContributionKey}. Try the requested combination or choose a result manually.` : "Press the combination. A matching event is saved and advances automatically."}</p></div><ResultButtons value={currentContributionResult?.result ?? null} onChange={(result) => setContributionResult(contributionIndex, result)} /><button className="primary-button" type="button" disabled={!currentContributionResult || contributionFinished || currentContributionResult.autoDetected} onClick={nextContribution}>{currentContributionResult?.autoDetected ? "Advancing…" : contributionResults.length >= minimumContributionSize ? "Save manual result and continue" : "Continue after manual result"}</button></div>
            {contributionResults.length ? <div className="contribution-log"><div><h3>Tested combinations</h3><p>Correct any result at any time. Color and text always carry the same status.</p></div><ol>{contributionResults.map((result, index) => <li className={`result-${result.result}`} key={`${index}-${result.shortcut}`}><div><span>{index + 1}</span><kbd>{result.shortcut}</kbd>{result.autoDetected ? <small>Auto-detected</small> : <small>Manually set</small>}</div><ResultButtons compact value={result.result} onChange={(value) => setContributionResult(index, value)} /></li>)}</ol>{contributionReady ? <div className="contribution-ready"><div><strong>{contributionFinished ? "All available combinations tested." : "Minimum reached — you can contribute now or keep testing."}</strong><small>The GitHub form is prefilled with this configuration and every tested result. Review it before submitting.</small></div><a className="primary-button" href={contributionUrl}>Review prefilled contribution ↗</a></div> : null}</div> : null}
          </>}
        </section>

        <section className="demo-section" id="demo"><div><p className="eyebrow">Keyboard-first application</p><h2>Demo</h2><p>Open a full-screen ACME service CRM built to make every keyboard command discoverable. Mouseover explains controls, underlined letters reveal menu access, and the mouse can only close the running demo.</p></div><button className="primary-button demo-launch" type="button" onClick={() => setDemoOpen(true)}>Launch ACME keyboard CRM</button></section>

        <section className="about-section" id="about">
          <p className="eyebrow">About the reference</p><h2>Compatibility is not the same as good design</h2>
          <div className="about-grid"><article><h3>What “YES” means</h3><ol><li>The exact combination reaches the page.</li><li>The application handler runs.</li><li>The competing browser action is cancelled.</li></ol></article><article><h3>Capability vs. recommendation</h3><p>A shortcut can be technically bindable and still be a poor product decision. “Can I bind it?” reports observed behavior. “Should I bind it?” adds conventions, purpose, layout, browser conflicts, and accessibility guidance.</p></article></div>
          <h3 className="subheading">Convention guardrails</h3>
          <div className="guardrail-tabs" role="tablist" aria-label="Convention guardrail groups">{guardrailGroups.map((group, index) => <button type="button" role="tab" aria-selected={guardrailGroupIndex === index} onClick={() => setGuardrailGroupIndex(index)} key={group.title}>{group.title}</button>)}</div>
          <div className="table-wrap guardrail-table"><table><caption>One guardrail group at a time. Every recommendation has a primary platform, browser, or accessibility reference.</caption><thead><tr><th>Action</th><th>Windows / Linux</th><th>macOS</th><th>Guidance</th><th>Sources</th></tr></thead><tbody><tr className="table-group"><th colSpan={5}>{activeGuardrailGroup.title}</th></tr>{activeGuardrailGroup.rows.map((row) => <tr key={`${activeGuardrailGroup.title}-${row.action}`}><td><strong>{row.action}</strong></td><td>{row.windows === "—" ? "—" : <kbd>{row.windows}</kbd>}</td><td>{row.mac === "—" ? "—" : <kbd>{compactMacShortcut(row.mac)}</kbd>}</td><td>{row.guidance}</td><td className="source-links">{row.sources.map((source) => <a href={source.href} key={`${row.action}-${source.label}`}>{source.label}</a>)}</td></tr>)}</tbody></table></div>
          <p className="terminology-note"><strong>Terminology:</strong> Can I Bind? uses Command (⌘) on macOS and Windows for the Windows key. Browser code exposes both through the technical <code>Meta</code> modifier.</p>
          <h3 className="subheading">Standards and references</h3>
          <div className="reference-list">
            <a href="https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html"><strong>WCAG 2.1.1 — Keyboard</strong><span>All functionality must be operable through a keyboard interface.</span></a><a href="https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap.html"><strong>WCAG 2.1.2 — No Keyboard Trap</strong><span>Users must be able to leave every component with standard keyboard interaction.</span></a><a href="https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html"><strong>WCAG 2.1.4 — Character Key Shortcuts</strong><span>Single-character shortcuts need a way to turn off, remap, or limit them by focus.</span></a><a href="https://www.w3.org/TR/uievents/"><strong>W3C UI Events</strong><span>The event model, keydown behavior, cancellation, and the relationship between key and code.</span></a><a href="https://w3c.github.io/aria/#aria-keyshortcuts"><strong>ARIA — aria-keyshortcuts</strong><span>Announces implemented shortcuts to assistive technology; it does not implement behavior.</span></a><a href="https://html.spec.whatwg.org/multipage/interaction.html#the-accesskey-attribute"><strong>HTML — accesskey</strong><span>A browser-managed mechanism with platform-dependent activation; unsuitable as the only path to a core command.</span></a><a href="https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key"><strong>MDN — KeyboardEvent.key</strong><span>The layout- and modifier-aware character or action the user intended.</span></a><a href="https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code"><strong>MDN — KeyboardEvent.code</strong><span>The physical key position, independent of the produced character.</span></a><a href="https://wicg.github.io/keyboard-map/"><strong>WICG — Keyboard Map</strong><span>The experimental specification behind layout-aware physical-key labels.</span></a><a href="https://developer.mozilla.org/en-US/docs/Web/API/Keyboard/getLayoutMap"><strong>MDN — Keyboard.getLayoutMap()</strong><span>How supported browsers expose the active keyboard layout in a secure context.</span></a><a href="https://caniuse.com/keyboardevent-key"><strong>Can I Use — KeyboardEvent.key</strong><span>Current browser support for logical, layout-aware key values.</span></a><a href="https://caniuse.com/keyboardevent-code"><strong>Can I Use — KeyboardEvent.code</strong><span>Current browser support for physical key positions.</span></a><a href="https://caniuse.com/mdn-api_keyboard_getlayoutmap"><strong>Can I Use — getLayoutMap()</strong><span>Current browser support for programmatic keyboard-layout maps.</span></a><a href="https://www.w3.org/WAI/ARIA/apg/"><strong>ARIA Authoring Practices Guide</strong><span>Expected keyboard interactions for dialogs, menus, tabs, grids, and other interface patterns.</span></a>
          </div>
          <section className="lab-section" id="implementation" aria-labelledby="lab-title">
            <div className="section-heading"><div><p className="eyebrow">Implementation techniques</p><h3 id="lab-title">Implementation guide</h3><p>Choose logical characters, physical positions, and native widget behavior deliberately, then expose the result to users and assistive technology.</p></div></div>
            <div className="technique-grid"><article><code>event.key</code><h4>Semantic commands</h4><p>Use this for commands named by the character a person produces, such as Save or Undo. It follows the active keyboard layout and modifier state, so the same physical key can produce a different value on another layout.</p></article><article><code>event.code</code><h4>Physical positions</h4><p>Use this only when key position matters, such as a game control or a visual keyboard. Do not label the key with a US character if the active layout produces another one. <a href="https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code">MDN: KeyboardEvent.code ↗</a></p></article><article><code>keydown</code><h4>Handle and cancel</h4><p>Ignore repeats, composition, and editable controls. Call <code>preventDefault()</code> only after matching a command the application owns.</p></article><article><code>aria-keyshortcuts</code><h4>Expose, do not implement</h4><p>Announce the scripted binding and also show it visually. ARIA never creates the keyboard behavior.</p></article><article><code>accesskey</code><h4>Browser-managed access</h4><p>Activation varies by browser and OS. It can be supplemental, but should not be the only route to a critical action.</p></article><article><code>button / a / input</code><h4>Prefer native controls</h4><p>Let native elements own Enter, Space, Tab, editing, and focus before adding custom global handlers.</p></article></div>
            <div className="best-practice-note"><strong>Recommended baseline:</strong> use <code>keydown</code> with <code>event.key</code> for semantic commands; protect text entry and composition; cancel only a matched, cancelable command; and expose the binding with <code>aria-keyshortcuts</code>. <a href="https://www.w3.org/TR/uievents/">UI Events ↗</a> <a href="https://w3c.github.io/aria/#aria-keyshortcuts">ARIA ↗</a> <a href="https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html">WCAG 2.1.1 ↗</a></div>
            <div className="code-lab"><label className="code-editor"><span>Editable best-practice HTML + JavaScript</span><div className="editor-stack"><pre className="code-highlight" aria-hidden="true" ref={highlightedCodeRef}><code>{highlightCode(labCode)}</code></pre><textarea aria-label="Editable shortcut binding example" spellCheck={false} value={labCode} onChange={(event) => setLabCode(event.target.value)} onScroll={(event) => { if (!highlightedCodeRef.current) return; highlightedCodeRef.current.scrollTop = event.currentTarget.scrollTop; highlightedCodeRef.current.scrollLeft = event.currentTarget.scrollLeft; }} /></div></label><div className="preview-pane"><span>Sandboxed result</span><iframe title="Keyboard shortcut code preview" sandbox="allow-scripts" srcDoc={labCode} /></div></div>
          </section>
          <aside className="about-site-box" aria-labelledby="about-site-title"><div><p className="eyebrow">About this site</p><h3 id="about-site-title">Open data for usable keyboard interfaces.</h3></div><div><h4>Purpose</h4><p>Can I Bind? separates observed shortcut capability from practical guidance, with browser, operating system, and keyboard layout kept as first-class evidence. Layout is detected only when the browser exposes a reliable map; otherwise it must be selected manually.</p></div><div><h4>Contact</h4><p><a href="mailto:hello@canibind.example">hello@canibind.example</a><br /><small>Placeholder contact address</small></p></div><div><h4>Licenses</h4><p>Code, documentation, and design: <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>.<br />Public dataset: <a href="https://creativecommons.org/publicdomain/zero/1.0/">CC0 1.0</a>.</p></div></aside>
        </section>
      </main>
      <Demo open={demoOpen} onClose={() => setDemoOpen(false)} platform={platformFromOs(detectedEnvironment.os)} />
      <footer><a className="brand footer-home" href={import.meta.env.BASE_URL} aria-label="Can I Bind home"><span className="brand-mark">CIB?</span><span>Can I Bind?</span></a><p>Open data for usable keyboard interfaces.<br /><a className="accessibility-status" href="https://www.w3.org/TR/WCAG22/">Accessibility: tested against WCAG 2.2 AA</a></p><div><a href="https://github.com/reboot81/canibind">Source</a><a href={`${import.meta.env.BASE_URL}data/compatibility.v1.json`}>CC0 dataset</a><a href="#about">Methodology</a></div></footer>
    </>
  );
}

function VerdictModule({ className = "", reference, recommendation, intent, liveCapability, liveObservationText, testCount, showStatusSymbols }: { className?: string; reference: Dataset["records"][number] | undefined; recommendation: { value: Recommendation; reason: string }; intent: Intent; liveCapability: Capability; liveObservationText: string; testCount: number; showStatusSymbols: boolean }) {
  const liveHeading = liveCapability === "yes" ? "EVENT RECEIVED + DEFAULT CANCELLED" : liveCapability === "conditional" ? "EVENT RECEIVED" : "NOT TESTED";
  return <section className={`verdict-grid ${className}`} aria-label="Shortcut verdict"><VerdictCard title="Can I bind it?" value={reference?.capability ?? "lack-of-data"} text={reference?.note ?? "No verified observation exists for this exact browser, OS, version, and layout yet."} label="Recorded evidence" detail={reference?.evidence ?? "none"} showSymbol={showStatusSymbols} /><VerdictCard title="Should I bind it?" value={recommendation.value} text={recommendation.reason} label="Assessment" detail={intents.find((item) => item.value === intent)?.label ?? intent} showSymbol={showStatusSymbols} /><VerdictCard title="Live observation" value={liveCapability} heading={liveHeading} text={liveObservationText} label="Events this session" detail={String(testCount)} showSymbol={showStatusSymbols} /></section>;
}

function ResultButtons({ value, onChange, compact = false }: { value: ContributionResult["result"] | null; onChange: (value: ContributionResult["result"]) => void; compact?: boolean }) {
  const options: { value: ContributionResult["result"]; label: string; short: string }[] = [{ value: "yes", label: "Worked — event received and browser default cancelled", short: "Worked" }, { value: "conditional", label: "Worked with a condition or competing action", short: "Conditional" }, { value: "no", label: "Did not work or the browser / OS won", short: "Did not work" }];
  return <fieldset className={`result-buttons ${compact ? "compact" : ""}`}><legend>{compact ? "Correct result" : "Result"}</legend>{options.map((option) => <button type="button" className={`result-choice result-${option.value}`} aria-pressed={value === option.value} onClick={() => onChange(option.value)} key={option.value}>{compact ? option.short : option.label}</button>)}</fieldset>;
}

function VerdictCard({ title, value, heading, text, label, detail, showSymbol }: { title: string; value: Capability | Recommendation; heading?: string; text: string; label: string; detail: string; showSymbol: boolean }) {
  return <article className="verdict-card"><div className="card-heading"><p>{title}</p><span className={`status-dot status-${value}`} aria-hidden="true">{showSymbol ? <span>{statusSymbol(value)}</span> : null}</span></div><h2>{heading ?? statusLabel(value)}</h2><p>{text}</p><div className="evidence-row"><span>{label}</span><strong>{detail}</strong></div></article>;
}
