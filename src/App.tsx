import { useEffect, useMemo, useRef, useState } from "react";
import { detectBrowserOverride, detectEnvironment, detectKeyboardLayout } from "./environment";
import { t } from "./i18n";
import { contributionShortcuts, keyboardRows } from "./keyboard";
import { recommendationFor, shortcutFromEvent, shortcutFromSelection, shortcutPath, shouldCaptureShortcut } from "./shortcut";
import type {
  Capability,
  ContributionResult,
  Dataset,
  Environment,
  Intent,
  KeyboardPlatform,
  Layout,
  Recommendation,
  Shortcut,
  Theme,
} from "./types";

const defaultShortcut: Shortcut = { id: "ctrl-f", display: "Ctrl + F", modifiers: ["Control"], key: "F" };
const copy = t();
const browsers = ["Chrome", "Edge", "Firefox", "Safari", "Brave", "Opera", "Vivaldi"];
const systems = ["Windows", "macOS", "Linux", "iPadOS", "iOS", "Android"];
const layouts: { value: Layout; label: string }[] = [
  { value: "us", label: "English (US)" },
  { value: "swedish", label: "Swedish / Nordic" },
  { value: "german", label: "German" },
  { value: "uk", label: "English (UK)" },
];
const intents: { value: Intent; label: string }[] = [
  { value: "general", label: "General command" },
  { value: "undo", label: "Undo" },
  { value: "save", label: "Save" },
  { value: "search", label: "Find / search" },
  { value: "list", label: "Open list" },
  { value: "new-record", label: "Create new record" },
];
const modifierChoices: Record<KeyboardPlatform, { label: string; value: string }[]> = {
  windows: [
    { label: "Ctrl", value: "Control" }, { label: "Alt", value: "Alt" },
    { label: "Shift", value: "Shift" }, { label: "Windows", value: "Meta" },
  ],
  mac: [
    { label: "Command (⌘)", value: "Meta" }, { label: "Control (⌃)", value: "Control" },
    { label: "Option (⌥)", value: "Alt" }, { label: "Shift", value: "Shift" },
  ],
};

const initialLabCode = `<!doctype html>
<html lang="en">
<style>
  body { font: 16px system-ui; padding: 24px; }
  output { display: block; margin-top: 16px; padding: 12px; background: #eef2f7; }
</style>
<h1>Keyboard shortcut test</h1>
<p>Press Ctrl + S / Command (⌘) + S or Ctrl + Z / Command (⌘) + Z in this pane.</p>
<output id="result">Waiting for a shortcut…</output>
<script>
  const output = document.querySelector("#result");

  function handleShortcut(event) {
    if (!(event.ctrlKey || event.metaKey)) return;
    if (!["KeyS", "KeyZ"].includes(event.code)) return;

    event.preventDefault();
    const action = event.code === "KeyS" ? "Save" : "Undo";
    output.textContent = action + " handler ran";
  }

  addEventListener("keydown", handleShortcut);
</script>
</html>`;

function statusLabel(value: Capability | Recommendation): string {
  return value.replaceAll("-", " ").toUpperCase();
}

function statusSymbol(value: Capability | Recommendation): string {
  if (value === "yes" || value === "recommended") return "✓";
  if (value === "conditional" || value === "acceptable") return "!";
  if (value === "no" || value === "avoid") return "×";
  return "?";
}

const codeTokenPattern = /(<!--[\s\S]*?-->|\/\*[\s\S]*?\*\/|\/\/[^\n]*|<\/?[a-z][^>]*>|`(?:\\.|[^`])*`|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\b(?:addEventListener|const|else|false|function|if|null|return|true)\b|\b\d+\b)/gi;

function highlightCode(source: string) {
  return source.split(codeTokenPattern).map((token, index) => {
    const className = token.startsWith("//") || token.startsWith("/*") || token.startsWith("<!--")
      ? "token-comment"
      : token.startsWith("<")
        ? "token-tag"
        : /^["'`]/.test(token)
          ? "token-string"
          : /^\d/.test(token)
            ? "token-number"
            : /^(addEventListener|const|else|false|function|if|null|return|true)$/.test(token)
              ? "token-keyword"
              : "";
    return className ? <span className={className} key={`${index}-${token}`}>{token}</span> : token;
  });
}

function layoutLabel(layout: Layout): string {
  return layouts.find((item) => item.value === layout)?.label ?? layout;
}

function platformShortcutLabel(shortcut: string, platform: KeyboardPlatform): string {
  if (platform === "windows") return shortcut.replace(/\bWin\b/g, "Windows");
  return shortcut.replaceAll("Ctrl", "Command (⌘)").replaceAll("Alt", "Option (⌥)");
}

export default function App() {
  const [shortcut, setShortcut] = useState(defaultShortcut);
  const [isListening, setIsListening] = useState(true);
  const [liveCapability, setLiveCapability] = useState<Capability>("lack-of-data");
  const [lastDetectedAt, setLastDetectedAt] = useState<string | null>(null);
  const [environment, setEnvironment] = useState<Environment>(() => detectEnvironment());
  const [browserDetected, setBrowserDetected] = useState(true);
  const [osDetected, setOsDetected] = useState(true);
  const [layoutDetected, setLayoutDetected] = useState(false);
  const [intent, setIntent] = useState<Intent>("search");
  const [modifiers, setModifiers] = useState<string[]>(() => detectEnvironment().os === "macOS" ? ["Meta"] : ["Control"]);
  const [keyboardPlatform, setKeyboardPlatform] = useState<KeyboardPlatform>(() => detectEnvironment().os === "macOS" ? "mac" : "windows");
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [testCount, setTestCount] = useState(0);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("canibind-theme") as Theme | null) ?? "system");
  const [showStatusSymbols, setShowStatusSymbols] = useState(() => localStorage.getItem("canibind-status-symbols") === "true");
  const [labCode, setLabCode] = useState(initialLabCode);
  const [labPreview, setLabPreview] = useState(initialLabCode);
  const [contributionActive, setContributionActive] = useState(false);
  const [contributionIndex, setContributionIndex] = useState(0);
  const [contributionChoice, setContributionChoice] = useState<ContributionResult["result"] | null>(null);
  const [contributionResults, setContributionResults] = useState<ContributionResult[]>([]);
  const [observedContributionKey, setObservedContributionKey] = useState<string | null>(null);
  const [detectedKeyCode, setDetectedKeyCode] = useState<string | null>(null);
  const detectionFlashTimer = useRef<number | null>(null);
  const highlightedCodeRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("canibind-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("canibind-status-symbols", String(showStatusSymbols));
  }, [showStatusSymbols]);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/compatibility.v1.json`)
      .then((response) => response.json())
      .then((value: Dataset) => setDataset(value))
      .catch(() => setDataset(null));
    detectKeyboardLayout().then((detected) => {
      if (!detected) return;
      setEnvironment((current) => ({ ...current, layout: detected }));
      setLayoutDetected(true);
    });
    detectBrowserOverride().then((browser) => {
      if (browser) setEnvironment((current) => ({ ...current, browser }));
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isListening || !shouldCaptureShortcut(event)) return;
      event.preventDefault();
      const platform: KeyboardPlatform = ["macOS", "iOS", "iPadOS"].includes(environment.os) ? "mac" : "windows";
      const next = shortcutFromEvent(event, platform, environment.layout);
      if (!next) return;
      setShortcut(next);
      setKeyboardPlatform(platform);
      setModifiers(next.modifiers);
      setLiveCapability("conditional");
      setLastDetectedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setTestCount((count) => count + 1);
      setObservedContributionKey(next.display);
      setDetectedKeyCode(null);
      window.requestAnimationFrame(() => {
        setDetectedKeyCode(event.code);
        if (detectionFlashTimer.current !== null) window.clearTimeout(detectionFlashTimer.current);
        detectionFlashTimer.current = window.setTimeout(() => setDetectedKeyCode(null), 1100);
      });
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      window.history.replaceState(null, "", `${base}${shortcutPath(next, environment.browser, environment.os)}`);
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      if (detectionFlashTimer.current !== null) window.clearTimeout(detectionFlashTimer.current);
    };
  }, [environment.browser, environment.layout, environment.os, isListening]);

  useEffect(() => {
    document.title = `${shortcut.display} — Can I Bind?`;
  }, [shortcut]);

  const recommendation = useMemo(
    () => recommendationFor(shortcut.key, shortcut.modifiers, intent, environment.layout),
    [shortcut, intent, environment.layout],
  );
  const reference = dataset?.records.find((record) => record.shortcut === shortcut.id && record.intent === intent);
  const keyboard = useMemo(() => keyboardRows(environment.layout, keyboardPlatform), [environment.layout, keyboardPlatform]);
  const contributionFinished = contributionResults.length === contributionShortcuts.length;
  const expectedContribution = contributionShortcuts[contributionIndex];
  const displayedExpectedContribution = expectedContribution ? platformShortcutLabel(expectedContribution, keyboardPlatform) : "";

  const switchKeyboardPlatform = (platform: KeyboardPlatform) => {
    setKeyboardPlatform(platform);
    setModifiers((current) => current.map((modifier) => {
      if (platform === "mac" && modifier === "Control") return "Meta";
      if (platform === "windows" && modifier === "Meta") return "Control";
      return modifier;
    }).filter((modifier, index, values) => values.indexOf(modifier) === index));
  };

  const toggleModifier = (modifier: string) => {
    setModifiers((current) => current.includes(modifier) ? current.filter((item) => item !== modifier) : [...current, modifier]);
  };

  const selectKeyboardKey = (key: string) => {
    const next = shortcutFromSelection(key, modifiers, keyboardPlatform);
    setShortcut(next);
    setLiveCapability("lack-of-data");
    setLastDetectedAt(null);
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    window.history.replaceState(null, "", `${base}${shortcutPath(next, environment.browser, environment.os)}`);
  };

  const changeOs = (os: string) => {
    setEnvironment({ ...environment, os });
    setOsDetected(false);
    if (os === "macOS" || os === "iOS" || os === "iPadOS") switchKeyboardPlatform("mac");
    if (os === "Windows" || os === "Linux") switchKeyboardPlatform("windows");
  };

  const recordContribution = () => {
    if (!contributionChoice || contributionFinished) return;
    const nextResults = [...contributionResults, { shortcut: displayedExpectedContribution, result: contributionChoice }];
    setContributionResults(nextResults);
    setContributionChoice(null);
    setObservedContributionKey(null);
    if (nextResults.length < contributionShortcuts.length) setContributionIndex((index) => index + 1);
  };

  const startContribution = () => {
    setContributionActive(true);
    setContributionIndex(0);
    setContributionResults([]);
    setContributionChoice(null);
    setObservedContributionKey(null);
    setIsListening(true);
  };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href={import.meta.env.BASE_URL} aria-label="Can I Bind home"><span className="brand-mark">CIB?</span><span className="brand-copy"><strong>Can I Bind?</strong><small>Open data for usable keyboard interfaces.</small></span></a>
        <nav aria-label="Primary navigation">
          <a href="#explore">{copy.nav.test}</a><a href="#keyboard">{copy.nav.keyboard}</a><a href="#contribute">{copy.nav.contribute}</a><a href="#lab">{copy.nav.lab}</a><a href="#about">{copy.nav.about}</a>
        </nav>
        <div className="header-controls"><label className="theme-control"><span>Theme</span><select value={theme} onChange={(event) => setTheme(event.target.value as Theme)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label><label className="status-symbol-control"><span>Status symbols</span><button type="button" aria-pressed={showStatusSymbols} onClick={() => setShowStatusSymbols((value) => !value)}>{showStatusSymbols ? "On" : "Off"}</button></label></div>
      </header>

      <section className="hero" id="explore">
        <p className="eyebrow">Browser keyboard shortcut reference</p>
        <h1>Can I bind <span>{shortcut.display}</span>?</h1>
        <p className="hero-subtitle">Live compatibility evidence and practical shortcut guidance by browser, operating system, keyboard layout, and intended action.</p>
        <div className={`listener ${isListening ? "listener-on" : "listener-off"}`} aria-live="polite">
          <div className="listener-indicator"><span className="pulse" /><div><strong>{isListening ? "Listening continuously" : "Detection paused"}</strong><small>{isListening ? "Press another shortcut anywhere on this page." : "Resume to detect keyboard shortcuts."}</small></div></div>
          <kbd>{shortcut.display}</kbd>
          <button type="button" aria-pressed={isListening} onClick={() => setIsListening((value) => !value)}>{isListening ? "Pause" : "Resume"}</button>
        </div>
        <p className="capture-note">Latest event: <strong>{lastDetectedAt ? `${shortcut.display} detected at ${lastDetectedAt}` : "No shortcut detected yet"}</strong>.{shortcut.logicalKey ? <> Browser value: <code>event.key = {JSON.stringify(shortcut.logicalKey)}</code>.</> : null} Typing in form fields and the code editor is intentionally ignored.</p>
      </section>

      <section className="context-panel" aria-label="Test context">
        <DetectedSelect label="Browser" detected={browserDetected} value={environment.browser} detail={environment.browserVersion} options={browsers} onChange={(browser) => { setEnvironment({ ...environment, browser }); setBrowserDetected(false); }} />
        <DetectedSelect label="Operating system" detected={osDetected} value={environment.os} options={systems} onChange={changeOs} />
        <label className="field"><span className="field-heading"><b>Keyboard layout</b><em>{layoutDetected ? "Detected" : "Select manually"}</em></span><select value={environment.layout} onChange={(event) => { setEnvironment({ ...environment, layout: event.target.value as Layout }); setLayoutDetected(false); }}>{layouts.map((layout) => <option value={layout.value} key={layout.value}>{layout.label}</option>)}</select></label>
        <label className="field"><span className="field-heading"><b>Intended action</b><em>Required for guidance</em></span><select value={intent} onChange={(event) => setIntent(event.target.value as Intent)}>{intents.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
      </section>

      <section className="verdict-grid" aria-label="Shortcut verdict">
        <VerdictCard title="Can I bind it?" value={reference?.capability ?? "lack-of-data"} text={reference?.note ?? "No verified observation exists for this exact browser, OS, version, and layout yet."} label="Recorded evidence" detail={reference?.evidence ?? "none"} showSymbol={showStatusSymbols} />
        <VerdictCard title="Should I bind it?" value={recommendation.value} text={recommendation.reason} label="Intended action" detail={intents.find((item) => item.value === intent)?.label ?? intent} showSymbol={showStatusSymbols} />
        <VerdictCard title="Live observation" value={liveCapability} heading={liveCapability === "conditional" ? "EVENT RECEIVED" : "NOT TESTED"} text={liveCapability === "conditional" ? "The page received the event and requested preventDefault(). Confirm separately that no browser or OS action occurred." : "The continuous listener is ready. Press a shortcut to create a live observation."} label="Events this session" detail={String(testCount)} showSymbol={showStatusSymbols} />
      </section>

      <section className="keyboard-section" id="keyboard">
        <div className="section-heading"><div><p className="eyebrow">Layout-aware guidance</p><h2>Interactive keyboard reference</h2><p>Choose a platform, physical layout, one or more modifiers, and intended action. Pressing a real shortcut updates both the keyboard and the verdict above.</p></div><div className="live-readout"><span className="pulse" /><small>Live</small><strong>{shortcut.display}</strong></div></div>
        <div className="keyboard-toolbar">
          <fieldset><legend>Keyboard</legend><button type="button" className={keyboardPlatform === "windows" ? "selected" : ""} aria-pressed={keyboardPlatform === "windows"} onClick={() => switchKeyboardPlatform("windows")}>Windows / Linux</button><button type="button" className={keyboardPlatform === "mac" ? "selected" : ""} aria-pressed={keyboardPlatform === "mac"} onClick={() => switchKeyboardPlatform("mac")}>macOS</button></fieldset>
          <label><span>Layout</span><select value={environment.layout} onChange={(event) => { setEnvironment({ ...environment, layout: event.target.value as Layout }); setLayoutDetected(false); }}>{layouts.map((layout) => <option value={layout.value} key={layout.value}>{layout.label}</option>)}</select></label>
          <fieldset><legend>Modifiers</legend><button className={modifiers.length === 0 ? "selected" : ""} aria-pressed={modifiers.length === 0} onClick={() => setModifiers([])} type="button">None</button>{modifierChoices[keyboardPlatform].map(({ label, value }) => <button className={modifiers.includes(value) ? "selected" : ""} aria-pressed={modifiers.includes(value)} onClick={() => toggleModifier(value)} type="button" key={value}>{label}</button>)}</fieldset>
        </div>
        <div className="keyboard" role="group" aria-label={`${keyboardPlatform} ${layoutLabel(environment.layout)} keyboard`}>
          {keyboard.map((row, rowIndex) => <div className="keyboard-row" key={rowIndex}>{row.map((item) => {
            const rec = recommendationFor(item.label, modifiers, intent, environment.layout);
            const isCurrent = shortcut.key.toUpperCase() === item.label.toUpperCase() && shortcut.modifiers.length === modifiers.length && modifiers.every((modifier) => shortcut.modifiers.includes(modifier));
            const isDetected = item.code === detectedKeyCode;
            return <button type="button" className={`keyboard-key key-${rec.value} ${item.size ? `key-${item.size}` : ""} ${isCurrent ? "current-key" : ""} ${isDetected ? "detected-key" : ""}`} title={rec.reason} aria-label={`${item.label}: ${statusLabel(rec.value)}`} onClick={() => selectKeyboardKey(item.label)} key={`${item.code}-${item.label}`}><span>{item.label}</span>{showStatusSymbols ? <b className="key-status-symbol" aria-hidden="true">{statusSymbol(rec.value)}</b> : null}</button>;
          })}</div>)}
        </div>
        <div className={`legend ${showStatusSymbols ? "legend-with-symbols" : ""}`}><span><i className="legend-recommended">{showStatusSymbols ? "✓" : ""}</i> Recommended</span><span><i className="legend-acceptable">{showStatusSymbols ? "!" : ""}</i> Acceptable</span><span><i className="legend-avoid">{showStatusSymbols ? "×" : ""}</i> Avoid</span><span><i className="legend-lack">{showStatusSymbols ? "?" : ""}</i> Lack of data</span></div>
      </section>

      <section className="contribute-section" id="contribute">
        <div className="section-heading"><div><p className="eyebrow">Community evidence</p><h2>Run a guided contribution test</h2><p>Test at least {dataset?.minimumContributionSize ?? 20} combinations. After each one, record whether the page and intended action worked and whether a competing browser or OS action appeared.</p></div><span className="progress-label">{contributionResults.length} / {contributionShortcuts.length}</span></div>
        {!contributionActive ? <div className="contribute-start"><ul><li>Browser and operating system are detected where possible.</li><li>Keyboard layout must be confirmed.</li><li>Known close, quit, reload, and navigation shortcuts are excluded from the guided test.</li><li>No account identifier or IP address is added to the public dataset.</li><li>Results remain unverified until independently reproduced.</li></ul><button className="primary-button" type="button" onClick={startContribution}>Start guided test</button></div> : contributionFinished ? <div className="contribute-finished"><strong>Test run complete</strong><p>{contributionResults.filter((result) => result.result === "yes").length} worked, {contributionResults.filter((result) => result.result === "conditional").length} were conditional, and {contributionResults.filter((result) => result.result === "no").length} did not work.</p><a className="primary-button" href="https://github.com/reboot81/canibind/issues/new">Review and prepare contribution ↗</a></div> : <div className="guided-test">
          <div className="test-target"><small>Test {contributionIndex + 1} of {contributionShortcuts.length}</small><kbd>{displayedExpectedContribution}</kbd><p>{observedContributionKey ? `Latest detected event: ${observedContributionKey}` : "Press the combination, then return here and record what happened."}</p></div>
          <fieldset><legend>What happened?</legend>{[["yes","Worked — handler ran and no competing action appeared"],["conditional","Worked with a condition or conflict"],["no","Did not work or the browser / OS won"]].map(([value, label]) => <label key={value}><input type="radio" name="contribution-result" value={value} checked={contributionChoice === value} onChange={() => setContributionChoice(value as ContributionResult["result"])} /><span>{label}</span></label>)}</fieldset>
          <button className="primary-button" type="button" disabled={!contributionChoice} onClick={recordContribution}>Record and continue</button>
        </div>}
      </section>

      <section className="lab-section" id="lab">
        <div className="section-heading"><div><p className="eyebrow">Implementation</p><h2>How does this work?</h2><p>This is the binding handler developers need: detect the platform modifier, identify the physical key with <code>event.code</code>, reject unrelated keys, and call <code>preventDefault()</code> only for a binding the application owns.</p></div><button className="primary-button" type="button" onClick={() => setLabPreview(labCode)}>Run example</button></div>
        <div className="code-lab"><label className="code-editor"><span>Editable HTML + JavaScript</span><div className="editor-stack"><pre className="code-highlight" aria-hidden="true" ref={highlightedCodeRef}><code>{highlightCode(labCode)}</code></pre><textarea aria-label="Editable shortcut binding example" spellCheck={false} value={labCode} onChange={(event) => setLabCode(event.target.value)} onScroll={(event) => { if (!highlightedCodeRef.current) return; highlightedCodeRef.current.scrollTop = event.currentTarget.scrollTop; highlightedCodeRef.current.scrollLeft = event.currentTarget.scrollLeft; }} /></div></label><div className="preview-pane"><span>Sandboxed result</span><iframe title="Keyboard shortcut code preview" sandbox="allow-scripts" srcDoc={labPreview} /></div></div>
      </section>

      <section className="about-section" id="about">
        <p className="eyebrow">About the reference</p><h2>Compatibility is not the same as good design</h2>
        <div className="about-grid"><article><h3>What “YES” means</h3><ol><li>The exact combination reaches the page.</li><li>The application handler runs.</li><li>The competing browser or OS action does not occur.</li></ol></article><article><h3>Why Ctrl + F may work once</h3><p>That is application code, not standard browser behavior. The first press is usually handled and cancelled by the site. After its search field opens, a second condition may skip the handler and allow the browser Find command.</p></article></div>

        <h3 className="subheading">Convention guardrails</h3>
        <div className="table-wrap"><table><caption>Recommendations are based on documented platform and browser conventions. Primary sources are linked per row.</caption><thead><tr><th>Action</th><th>Windows / Linux</th><th>macOS</th><th>Guidance</th><th>Sources</th></tr></thead><tbody>
          <tr><td>Undo</td><td><kbd>Ctrl + Z</kbd></td><td><kbd>Command (⌘) + Z</kbd></td><td>Established convention. Do not reuse for Save.</td><td className="source-links"><a href="https://support.microsoft.com/en-us/windows/keyboard-shortcuts-in-apps-139014e7-177b-d1f3-eb2e-7298b2599a34">Microsoft</a><a href="https://support.apple.com/en-us/102650">Apple</a></td></tr>
          <tr><td>Redo</td><td><kbd>Ctrl + Y</kbd></td><td><kbd>Command (⌘) + Shift + Z</kbd></td><td>Platform conventions differ.</td><td className="source-links"><a href="https://support.microsoft.com/en-us/windows/keyboard-shortcuts-in-apps-139014e7-177b-d1f3-eb2e-7298b2599a34">Microsoft</a><a href="https://support.apple.com/en-us/102650">Apple</a></td></tr>
          <tr><td>Save</td><td><kbd>Ctrl + S</kbd></td><td><kbd>Command (⌘) + S</kbd></td><td>Strong convention; verify browser Save Page conflict.</td><td className="source-links"><a href="https://support.google.com/chrome/answer/157179?co=GENIE.Platform%3DDesktop&hl=en">Chrome</a><a href="https://support.apple.com/en-us/102650">Apple</a></td></tr>
          <tr><td>Find</td><td><kbd>Ctrl + F</kbd></td><td><kbd>Command (⌘) + F</kbd></td><td>Familiar but competes with browser Find.</td><td className="source-links"><a href="https://support.microsoft.com/en-us/windows/keyboard-shortcuts-in-apps-139014e7-177b-d1f3-eb2e-7298b2599a34">Microsoft</a><a href="https://support.google.com/chrome/answer/157179?co=GENIE.Platform%3DDesktop&hl=en">Chrome</a><a href="https://support.apple.com/en-us/102650">Apple</a></td></tr>
          <tr><td>Help / shortcuts</td><td><kbd>?</kbd></td><td><kbd>?</kbd></td><td>Poor international choice where the character requires Shift.</td><td className="source-links"><a href="https://support.apple.com/en-us/102650">Apple</a><a href="https://wicg.github.io/keyboard-map/">Keyboard Map</a></td></tr>
        </tbody></table></div>
        <p className="terminology-note"><strong>Terminology:</strong> Can I Bind? uses Command (⌘) on macOS and Windows for the Windows key. Browser code exposes both through the technical <code>Meta</code> modifier.</p>

        <h3 className="subheading">Standards and references</h3>
        <div className="reference-list">
          <a href="https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html"><strong>WCAG 2.1.1 — Keyboard</strong><span>All functionality must be operable through a keyboard interface.</span></a>
          <a href="https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html"><strong>WCAG 2.1.4 — Character Key Shortcuts</strong><span>Single-character shortcuts need a way to turn off, remap, or limit them by focus.</span></a>
          <a href="https://www.w3.org/TR/uievents-key/"><strong>W3C UI Events KeyboardEvent key values</strong><span>Normative logical key names, including media and browser keys.</span></a>
          <a href="https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code"><strong>MDN — KeyboardEvent.code</strong><span>Physical-key identity and the difference from layout-dependent event.key.</span></a>
          <a href="https://wicg.github.io/keyboard-map/"><strong>WICG — Keyboard Map</strong><span>The experimental specification behind layout-aware physical-key labels.</span></a>
          <a href="https://developer.mozilla.org/en-US/docs/Web/API/Keyboard/getLayoutMap"><strong>MDN — Keyboard.getLayoutMap()</strong><span>How supported browsers expose the active keyboard layout in a secure context.</span></a>
          <a href="https://www.w3.org/WAI/ARIA/apg/"><strong>ARIA Authoring Practices Guide</strong><span>Expected keyboard interactions for accessible interface patterns.</span></a>
          <a href="https://caniuse.com/?search=keyboard"><strong>Can I Use — keyboard features</strong><span>Browser support for the underlying keyboard APIs.</span></a>
        </div>

        <aside className="about-site-box" aria-labelledby="about-site-title">
          <div><p className="eyebrow">About this site</p><h3 id="about-site-title">Open data for usable keyboard interfaces.</h3></div>
          <div><h4>Purpose</h4><p>Can I Bind? separates observed shortcut capability from practical guidance, with browser, operating system, and keyboard layout kept as first-class evidence. Layout is detected only when the browser exposes a reliable map; otherwise it must be selected manually.</p></div>
          <div><h4>Contact</h4><p><a href="mailto:hello@canibind.example">hello@canibind.example</a><br /><small>Placeholder contact address</small></p></div>
          <div><h4>Licenses</h4><p>Code, documentation, and design: <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>.<br />Public dataset: <a href="https://creativecommons.org/publicdomain/zero/1.0/">CC0 1.0</a>.</p></div>
        </aside>
      </section>

      <footer><a className="brand footer-home" href={import.meta.env.BASE_URL} aria-label="Can I Bind home"><span className="brand-mark">CIB?</span><span>Can I Bind?</span></a><p>Open data for usable keyboard interfaces.</p><div><a href="https://github.com/reboot81/canibind">Source</a><a href={`${import.meta.env.BASE_URL}data/compatibility.v1.json`}>CC0 dataset</a><a href="#about">Methodology</a></div></footer>
    </main>
  );
}

function DetectedSelect({ label, detected, value, detail, options, onChange }: { label: string; detected: boolean; value: string; detail?: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="field"><span className="field-heading"><b>{label}</b><em>{detected ? "Detected" : "Selected"}</em></span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select>{detail && <small>{detail}</small>}</label>;
}

function VerdictCard({ title, value, heading, text, label, detail, showSymbol }: { title: string; value: Capability | Recommendation; heading?: string; text: string; label: string; detail: string; showSymbol: boolean }) {
  return <article className="verdict-card"><div className="card-heading"><p>{title}</p><span className={`status-dot status-${value}`} aria-hidden="true">{showSymbol ? <span>{statusSymbol(value)}</span> : null}</span></div><h2>{heading ?? statusLabel(value)}</h2><p>{text}</p><div className="evidence-row"><span>{label}</span><strong>{detail}</strong></div></article>;
}
