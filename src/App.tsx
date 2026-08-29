import { useEffect, useMemo, useState } from "react";
import { detectBrowserOverride, detectEnvironment, detectKeyboardLayout } from "./environment";
import { t } from "./i18n";
import { contributionShortcuts, keyboardRows } from "./keyboard";
import { recommendationFor, shortcutFromEvent, shortcutPath, shouldCaptureShortcut } from "./shortcut";
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

const initialLabCode = `<!doctype html>
<html lang="en">
<style>
  body { font: 16px system-ui; padding: 24px; }
  output { display: block; margin-top: 16px; padding: 12px; background: #eef2f7; }
</style>
<h1>Keyboard shortcut test</h1>
<p>Press Ctrl/Cmd + S or Ctrl/Cmd + Z in this pane.</p>
<output id="result">Waiting for a shortcut…</output>
<script>
  addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    if (!["s", "z"].includes(event.key.toLowerCase())) return;
    event.preventDefault();
    const action = event.key.toLowerCase() === "s" ? "Save" : "Undo";
    document.querySelector("#result").textContent = action + " handler ran";
  });
</script>
</html>`;

function statusLabel(value: Capability | Recommendation): string {
  return value.replaceAll("-", " ").toUpperCase();
}

function layoutLabel(layout: Layout): string {
  return layouts.find((item) => item.value === layout)?.label ?? layout;
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
  const [modifier, setModifier] = useState("Control");
  const [keyboardPlatform, setKeyboardPlatform] = useState<KeyboardPlatform>(() => detectEnvironment().os === "macOS" ? "mac" : "windows");
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [testCount, setTestCount] = useState(0);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("canibind-theme") as Theme | null) ?? "system");
  const [labCode, setLabCode] = useState(initialLabCode);
  const [labPreview, setLabPreview] = useState(initialLabCode);
  const [contributionActive, setContributionActive] = useState(false);
  const [contributionIndex, setContributionIndex] = useState(0);
  const [contributionChoice, setContributionChoice] = useState<ContributionResult["result"] | null>(null);
  const [contributionResults, setContributionResults] = useState<ContributionResult[]>([]);
  const [observedContributionKey, setObservedContributionKey] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("canibind-theme", theme);
  }, [theme]);

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
      setLiveCapability("conditional");
      setLastDetectedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setTestCount((count) => count + 1);
      setObservedContributionKey(next.display);
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      window.history.replaceState(null, "", `${base}${shortcutPath(next, environment.browser, environment.os)}`);
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
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
  const displayedExpectedContribution = (keyboardPlatform === "mac" ? expectedContribution?.replace(/^Ctrl/, "⌘") : expectedContribution) ?? "";

  const changeOs = (os: string) => {
    setEnvironment({ ...environment, os });
    setOsDetected(false);
    if (os === "macOS" || os === "iOS" || os === "iPadOS") setKeyboardPlatform("mac");
    if (os === "Windows" || os === "Linux") setKeyboardPlatform("windows");
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
        <a className="brand" href={import.meta.env.BASE_URL} aria-label="Can I Bind home"><span className="brand-mark">CIB?</span><span>Can I Bind?</span></a>
        <nav aria-label="Primary navigation">
          <a href="#explore">{copy.nav.test}</a><a href="#keyboard">{copy.nav.keyboard}</a><a href="#lab">{copy.nav.lab}</a><a href="#contribute">{copy.nav.contribute}</a><a href="#about">{copy.nav.about}</a>
        </nav>
        <label className="theme-control"><span>Theme</span><select value={theme} onChange={(event) => setTheme(event.target.value as Theme)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
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
        <VerdictCard title="Can I bind it?" value={reference?.capability ?? "lack-of-data"} text={reference?.note ?? "No verified observation exists for this exact browser, OS, version, and layout yet."} label="Recorded evidence" detail={reference?.evidence ?? "none"} />
        <VerdictCard title="Should I bind it?" value={recommendation.value} text={recommendation.reason} label="Intended action" detail={intents.find((item) => item.value === intent)?.label ?? intent} />
        <VerdictCard title="Live observation" value={liveCapability} heading={liveCapability === "conditional" ? "EVENT RECEIVED" : "NOT TESTED"} text={liveCapability === "conditional" ? "The page received the event and requested preventDefault(). Confirm separately that no browser or OS action occurred." : "The continuous listener is ready. Press a shortcut to create a live observation."} label="Events this session" detail={String(testCount)} />
      </section>

      <section className="keyboard-section" id="keyboard">
        <div className="section-heading"><div><p className="eyebrow">Layout-aware guidance</p><h2>Interactive keyboard reference</h2><p>Choose a platform, physical layout, modifier, and intended action. Pressing a real shortcut updates both the keyboard and the verdict above.</p></div><div className="live-readout"><span className="pulse" /><small>Live</small><strong>{shortcut.display}</strong></div></div>
        <div className="keyboard-toolbar">
          <fieldset><legend>Keyboard</legend><button type="button" className={keyboardPlatform === "windows" ? "selected" : ""} onClick={() => setKeyboardPlatform("windows")}>Windows / Linux</button><button type="button" className={keyboardPlatform === "mac" ? "selected" : ""} onClick={() => setKeyboardPlatform("mac")}>macOS</button></fieldset>
          <label><span>Layout</span><select value={environment.layout} onChange={(event) => { setEnvironment({ ...environment, layout: event.target.value as Layout }); setLayoutDetected(false); }}>{layouts.map((layout) => <option value={layout.value} key={layout.value}>{layout.label}</option>)}</select></label>
          <fieldset><legend>Modifier</legend>{[["None", ""], [keyboardPlatform === "mac" ? "⌘ Command" : "Ctrl", "Control"], [keyboardPlatform === "mac" ? "⌥ Option" : "Alt", "Alt"], ["Shift", "Shift"]].map(([label, value]) => <button className={modifier === value ? "selected" : ""} onClick={() => setModifier(value)} type="button" key={label}>{label}</button>)}</fieldset>
        </div>
        <div className="keyboard" role="group" aria-label={`${keyboardPlatform} ${layoutLabel(environment.layout)} keyboard`}>
          {keyboard.map((row, rowIndex) => <div className="keyboard-row" key={rowIndex}>{row.map((item) => {
            const rec = recommendationFor(item.label, modifier ? [modifier] : [], intent, environment.layout);
            const modifierLabel = keyboardPlatform === "mac" && modifier === "Control" ? "⌘" : modifier === "Control" ? "Ctrl" : modifier;
            const isCurrent = shortcut.key.toUpperCase() === item.label.toUpperCase() && (modifier ? shortcut.modifiers.length > 0 : shortcut.modifiers.length === 0);
            return <button type="button" className={`keyboard-key key-${rec.value} ${item.size ? `key-${item.size}` : ""} ${isCurrent ? "current-key" : ""}`} title={rec.reason} onClick={() => setShortcut({ id: `${modifier ? modifier.toLowerCase() + "-" : ""}${item.label.toLowerCase()}`, display: `${modifierLabel ? modifierLabel + " + " : ""}${item.label}`, modifiers: modifier ? [modifier] : [], key: item.label })} key={`${item.code}-${item.label}`}><span>{item.label}</span><i aria-label={statusLabel(rec.value)} /></button>;
          })}</div>)}
        </div>
        <div className="legend"><span><i className="legend-recommended" /> Recommended</span><span><i className="legend-acceptable" /> Acceptable</span><span><i className="legend-avoid" /> Avoid</span><span><i className="legend-lack" /> Lack of data</span></div>
      </section>

      <section className="lab-section" id="lab">
        <div className="section-heading"><div><p className="eyebrow">Test it yourself</p><h2>Edit the example and run it safely</h2><p>The preview runs in a sandboxed frame. Try changing which key is handled, whether default behavior is prevented, or what action is shown.</p></div><button className="primary-button" type="button" onClick={() => setLabPreview(labCode)}>Run example</button></div>
        <div className="code-lab"><label><span>HTML + JavaScript</span><textarea spellCheck={false} value={labCode} onChange={(event) => setLabCode(event.target.value)} /></label><div className="preview-pane"><span>Result</span><iframe title="Keyboard shortcut code preview" sandbox="allow-scripts" srcDoc={labPreview} /></div></div>
      </section>

      <section className="contribute-section" id="contribute">
        <div className="section-heading"><div><p className="eyebrow">Community evidence</p><h2>Run a guided contribution test</h2><p>Test at least {dataset?.minimumContributionSize ?? 20} combinations. After each one, record whether the page and intended action worked and whether a competing browser or OS action appeared.</p></div><span className="progress-label">{contributionResults.length} / {contributionShortcuts.length}</span></div>
        {!contributionActive ? <div className="contribute-start"><ul><li>Browser and operating system are detected where possible.</li><li>Keyboard layout must be confirmed.</li><li>No account identifier or IP address is added to the public dataset.</li><li>Results remain unverified until independently reproduced.</li></ul><button className="primary-button" type="button" onClick={startContribution}>Start guided test</button></div> : contributionFinished ? <div className="contribute-finished"><strong>Test run complete</strong><p>{contributionResults.filter((result) => result.result === "yes").length} worked, {contributionResults.filter((result) => result.result === "conditional").length} were conditional, and {contributionResults.filter((result) => result.result === "no").length} did not work.</p><a className="primary-button" href="https://github.com/reboot81/canibind/issues/new">Review and prepare contribution ↗</a></div> : <div className="guided-test">
          <div className="test-target"><small>Test {contributionIndex + 1} of {contributionShortcuts.length}</small><kbd>{displayedExpectedContribution}</kbd><p>{observedContributionKey ? `Latest detected event: ${observedContributionKey}` : "Press the combination, then return here and record what happened."}</p></div>
          <fieldset><legend>What happened?</legend>{[["yes","Worked — handler ran and no competing action appeared"],["conditional","Worked with a condition or conflict"],["no","Did not work or the browser / OS won"]].map(([value, label]) => <label key={value}><input type="radio" name="contribution-result" value={value} checked={contributionChoice === value} onChange={() => setContributionChoice(value as ContributionResult["result"])} /><span>{label}</span></label>)}</fieldset>
          <button className="primary-button" type="button" disabled={!contributionChoice} onClick={recordContribution}>Record and continue</button>
        </div>}
      </section>

      <section className="about-section" id="about">
        <p className="eyebrow">About the reference</p><h2>Compatibility is not the same as good design</h2>
        <div className="about-grid"><article><h3>What “YES” means</h3><ol><li>The exact combination reaches the page.</li><li>The application handler runs.</li><li>The competing browser or OS action does not occur.</li></ol></article><article><h3>Why Ctrl + F may work once</h3><p>That is application code, not standard browser behavior. The first press is usually handled and cancelled by the site. After its search field opens, a second condition may skip the handler and allow the browser Find command.</p></article></div>

        <h3 className="subheading">Convention guardrails</h3>
        <div className="table-wrap"><table><thead><tr><th>Action</th><th>Windows / Linux</th><th>macOS</th><th>Guidance</th></tr></thead><tbody>
          <tr><td>Undo</td><td><kbd>Ctrl + Z</kbd></td><td><kbd>⌘ + Z</kbd></td><td>Established convention. Do not reuse for Save.</td></tr>
          <tr><td>Redo</td><td><kbd>Ctrl + Y</kbd></td><td><kbd>⌘ + Shift + Z</kbd></td><td>Platform conventions differ.</td></tr>
          <tr><td>Save</td><td><kbd>Ctrl + S</kbd></td><td><kbd>⌘ + S</kbd></td><td>Strong convention; verify browser Save Page conflict.</td></tr>
          <tr><td>Find</td><td><kbd>Ctrl + F</kbd></td><td><kbd>⌘ + F</kbd></td><td>Familiar but competes with browser Find.</td></tr>
          <tr><td>Help / shortcuts</td><td><kbd>?</kbd></td><td><kbd>?</kbd></td><td>Poor international choice where the character requires Shift.</td></tr>
        </tbody></table></div>

        <h3 className="subheading">Standards and references</h3>
        <div className="reference-list">
          <a href="https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html"><strong>WCAG 2.1.1 — Keyboard</strong><span>All functionality must be operable through a keyboard interface.</span></a>
          <a href="https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html"><strong>WCAG 2.1.4 — Character Key Shortcuts</strong><span>Single-character shortcuts need a way to turn off, remap, or limit them by focus.</span></a>
          <a href="https://www.w3.org/TR/uievents-key/"><strong>W3C UI Events KeyboardEvent key values</strong><span>Normative logical key names, including media and browser keys.</span></a>
          <a href="https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code"><strong>MDN — KeyboardEvent.code</strong><span>Physical-key identity and the difference from layout-dependent event.key.</span></a>
          <a href="https://www.w3.org/WAI/ARIA/apg/"><strong>ARIA Authoring Practices Guide</strong><span>Expected keyboard interactions for accessible interface patterns.</span></a>
          <a href="https://caniuse.com/?search=keyboard"><strong>Can I Use — keyboard features</strong><span>Browser support for the underlying keyboard APIs.</span></a>
        </div>
      </section>

      <footer><div className="brand"><span className="brand-mark">CIB?</span><span>Can I Bind?</span></div><p>Open data for usable keyboard interfaces.</p><div><a href="https://github.com/reboot81/canibind">Source</a><a href={`${import.meta.env.BASE_URL}data/compatibility.v1.json`}>CC0 dataset</a><a href="#about">Methodology</a></div></footer>
    </main>
  );
}

function DetectedSelect({ label, detected, value, detail, options, onChange }: { label: string; detected: boolean; value: string; detail?: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="field"><span className="field-heading"><b>{label}</b><em>{detected ? "Detected" : "Selected"}</em></span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select>{detail && <small>{detail}</small>}</label>;
}

function VerdictCard({ title, value, heading, text, label, detail }: { title: string; value: Capability | Recommendation; heading?: string; text: string; label: string; detail: string }) {
  return <article className="verdict-card"><div className="card-heading"><p>{title}</p><span className={`status-dot status-${value}`}><i /></span></div><h2>{heading ?? statusLabel(value)}</h2><p>{text}</p><div className="evidence-row"><span>{label}</span><strong>{detail}</strong></div></article>;
}
