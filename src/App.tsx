import { useEffect, useMemo, useRef, useState } from "react";
import { t } from "./i18n";
import { recommendationFor, shortcutFromEvent, shortcutPath } from "./shortcut";
import type { Capability, Dataset, Environment, Intent, Layout, Recommendation, Shortcut } from "./types";

const copy = t();
const defaultShortcut: Shortcut = { id: "ctrl-f", display: "Ctrl + F", modifiers: ["Control"], key: "F" };
const browsers = ["Chrome", "Edge", "Firefox", "Safari", "Brave", "Opera", "Vivaldi"];
const systems = ["Windows", "macOS", "Linux", "iPadOS", "iOS", "Android"];
const layouts: { value: Layout; label: string }[] = [
  { value: "us", label: "English (US)" }, { value: "swedish", label: "Swedish / Nordic" },
  { value: "german", label: "German" }, { value: "uk", label: "English (UK)" },
];
const intents: { value: Intent; label: string }[] = [
  { value: "general", label: "General command" }, { value: "undo", label: "Undo" }, { value: "save", label: "Save" },
  { value: "search", label: "Find / search" }, { value: "list", label: "Open list" }, { value: "new-record", label: "Create new record" },
];
const keyRows = [
  ["Esc", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "+"],
  ["Tab", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "Å"],
  ["Caps", "A", "S", "D", "F", "G", "H", "J", "K", "L", "Ö", "Ä"],
  ["Shift", "Z", "X", "C", "V", "B", "N", "M", ",", ".", "-"],
  ["Ctrl", "Alt", "Space", "Meta", "←", "↑", "↓", "→"],
];

function detectEnvironment(): Environment {
  const ua = navigator.userAgent;
  const browser = ua.includes("Edg/") ? "Edge" : ua.includes("Firefox/") ? "Firefox" : ua.includes("Chrome/") ? "Chrome" : ua.includes("Safari/") ? "Safari" : "Chrome";
  const os = ua.includes("Windows") ? "Windows" : ua.includes("Mac") ? "macOS" : ua.includes("Linux") ? "Linux" : "Windows";
  return { browser, os, layout: "us" };
}

function statusLabel(value: Capability | Recommendation): string { return value.replaceAll("-", " ").toUpperCase(); }

export default function App() {
  const [shortcut, setShortcut] = useState(defaultShortcut);
  const [capturing, setCapturing] = useState(false);
  const [liveCapability, setLiveCapability] = useState<Capability>("lack-of-data");
  const [environment, setEnvironment] = useState<Environment>(() => detectEnvironment());
  const [intent, setIntent] = useState<Intent>("search");
  const [modifier, setModifier] = useState("Control");
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [demoMessage, setDemoMessage] = useState("Focus this panel, then try Ctrl + N, Ctrl + S, or Ctrl + Z.");
  const [demoCreated, setDemoCreated] = useState(false);
  const [testCount, setTestCount] = useState(0);
  const captureRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/compatibility.v1.json`).then((response) => response.json()).then((value: Dataset) => setDataset(value)).catch(() => setDataset(null));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!capturing) return;
      event.preventDefault();
      event.stopPropagation();
      const next = shortcutFromEvent(event);
      if (!next) return;
      setShortcut(next);
      setLiveCapability("conditional");
      setTestCount((count) => count + 1);
      setCapturing(false);
      window.history.replaceState(null, "", shortcutPath(next, environment.browser, environment.os));
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [capturing, environment.browser, environment.os]);

  useEffect(() => { document.title = `${shortcut.display} — Can I Bind?`; }, [shortcut]);
  const recommendation = useMemo(() => recommendationFor(shortcut.key, shortcut.modifiers, intent, environment.layout), [shortcut, intent, environment.layout]);
  const reference = dataset?.records.find((record) => record.shortcut === shortcut.id && record.intent === intent);

  const beginCapture = () => { setCapturing(true); setLiveCapability("lack-of-data"); captureRef.current?.focus(); };
  const handleDemoKey = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (!["n", "s", "z"].includes(key)) return;
    event.preventDefault();
    if (key === "n") { setDemoCreated(true); setDemoMessage("New patient created"); }
    if (key === "s") setDemoMessage("Patient saved");
    if (key === "z") { setDemoCreated(false); setDemoMessage("Creation undone"); }
  };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href={import.meta.env.BASE_URL} aria-label="Can I Bind home"><span className="brand-mark">CIB?</span><span>Can I Bind?</span></a>
        <nav aria-label="Primary navigation"><a href="#explore">{copy.nav.explore}</a><a href="#keyboard">{copy.nav.keyboard}</a><a href="#contribute">{copy.nav.contribute}</a><a href={`${import.meta.env.BASE_URL}data/compatibility.v1.json`}>{copy.nav.dataset}</a></nav>
        <a className="github-link" href="https://github.com/reboot81/canibind">GitHub ↗</a>
      </header>

      <section className="hero" id="explore">
        <div className="hero-copy">
          <p className="eyebrow">{copy.hero.eyebrow}</p>
          <h1>{copy.hero.title} <span>{shortcut.display}?</span></h1>
          <p className="hero-subtitle">{copy.hero.subtitle}</p>
          <button className={`capture ${capturing ? "is-listening" : ""}`} type="button" onClick={beginCapture} ref={captureRef}>
            <span className="capture-label">{capturing ? copy.hero.listening : copy.hero.capture}</span><kbd>{capturing ? "…" : shortcut.display}</kbd><span className="capture-arrow">↵</span>
          </button>
          <p className="capture-note">Nothing is uploaded. A live result stays in this browser until you choose to contribute.</p>
        </div>
        <div className="hero-orbit" aria-hidden="true"><div className="keycap keycap-main">⌘</div><div className="keycap keycap-one">F</div><div className="keycap keycap-two">Z</div><div className="orbit-line" /></div>
      </section>

      <section className="context-panel" aria-label="Test context">
        <Select label={copy.labels.browser} value={environment.browser} options={browsers} onChange={(browser) => setEnvironment({ ...environment, browser })} />
        <Select label={copy.labels.os} value={environment.os} options={systems} onChange={(os) => setEnvironment({ ...environment, os })} />
        <label><span>{copy.labels.layout}</span><select value={environment.layout} onChange={(event) => setEnvironment({ ...environment, layout: event.target.value as Layout })}>{layouts.map((layout) => <option value={layout.value} key={layout.value}>{layout.label}</option>)}</select></label>
        <label><span>{copy.labels.intent}</span><select value={intent} onChange={(event) => setIntent(event.target.value as Intent)}>{intents.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
      </section>

      <section className="verdict-grid" aria-label="Shortcut verdict">
        <VerdictCard title={copy.labels.capability} value={reference?.capability ?? "lack-of-data"} text={reference?.note ?? "No verified observation exists for this exact browser, OS, version, and layout yet."} label="Recorded evidence" detail={reference?.evidence ?? "none"} className="capability-card" />
        <VerdictCard title={copy.labels.recommendation} value={recommendation.value} text={recommendation.reason} label="Intended action" detail={intents.find((item) => item.value === intent)?.label ?? intent} className="recommendation-card" />
        <VerdictCard title="Live observation" value={liveCapability} heading={liveCapability === "conditional" ? "EVENT RECEIVED" : "NOT TESTED"} text={liveCapability === "conditional" ? "The handler ran and preventDefault() was requested. Competing browser or OS UI still needs verification." : "Press the shortcut above to test this browser without claiming more than the page can observe."} label="Tests this session" detail={String(testCount)} className="live-card" />
      </section>

      <KeyboardSection modifier={modifier} setModifier={setModifier} intent={intent} layout={environment.layout} setShortcut={setShortcut} />

      <section className="demo-contribute-grid">
        <article className="demo-panel" tabIndex={0} onKeyDown={handleDemoKey}>
          <div className="panel-number">01</div><p className="eyebrow">Generic demo</p><h2>Keyboard-first software feels immediate.</h2>
          <div className={`demo-toast ${demoCreated ? "created" : ""}`} role="status"><span>{demoCreated ? "✓" : "⌨"}</span><strong>{demoMessage}</strong></div>
          <p>Click or tab into this panel before trying the shortcuts. There is deliberately no domain logic behind the demonstration.</p>
        </article>
        <article className="contribute-panel" id="contribute">
          <div className="panel-number">02</div><p className="eyebrow">Community evidence</p><h2>Contribute a reproducible test run.</h2>
          <p>Submissions require at least <strong>{dataset?.minimumContributionSize ?? 20} tested combinations</strong>, explicit consent, browser and OS versions, a declared keyboard layout, and the exact test method version.</p>
          <div className="privacy-list"><span>✓ No account identifier in the dataset</span><span>✓ No IP address stored in the dataset</span><span>✓ Unverified until independently reproduced</span></div>
          <a className="primary-link" href="https://github.com/reboot81/canibind/issues/new">Prepare a contribution ↗</a>
        </article>
      </section>

      <section className="principles-section"><p className="eyebrow">What a “YES” means</p><h2>Three things must all be true.</h2><div className="principles">
        <article><span>1</span><h3>Received</h3><p>The exact keyboard combination reaches the page.</p></article>
        <article><span>2</span><h3>Handled</h3><p>The registered application handler runs successfully.</p></article>
        <article><span>3</span><h3>Uncontested</h3><p>The competing browser or operating-system action does not occur.</p></article>
      </div></section>

      <footer><div className="brand"><span className="brand-mark">CIB?</span><span>Can I Bind?</span></div><p>Open data for faster, more accessible keyboard interfaces.</p><div><a href="https://github.com/reboot81/canibind">Source</a><a href={`${import.meta.env.BASE_URL}data/compatibility.v1.json`}>CC0 dataset</a><a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a></div></footer>
    </main>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function VerdictCard({ title, value, heading, text, label, detail, className }: {
  title: string;
  value: Capability | Recommendation;
  heading?: string;
  text: string;
  label: string;
  detail: string;
  className: string;
}) {
  return (
    <article className={`verdict-card ${className}`}>
      <div className="card-heading"><p>{title}</p><span className={`status-dot status-${value}`} /></div>
      <h2>{heading ?? statusLabel(value)}</h2><p>{text}</p>
      <div className="evidence-row"><span>{label}</span><strong>{detail}</strong></div>
    </article>
  );
}

function KeyboardSection({ modifier, setModifier, intent, layout, setShortcut }: {
  modifier: string;
  setModifier: (modifier: string) => void;
  intent: Intent;
  layout: Layout;
  setShortcut: (shortcut: Shortcut) => void;
}) {
  return (
    <section className="keyboard-section" id="keyboard">
      <div className="section-intro"><p className="eyebrow">Layout-aware guidance</p><h2>See the whole keyboard, not one shortcut at a time.</h2><p>Choose a modifier and intended action. The map separates technical capability from convention, accessibility, browser conflicts, and international layouts.</p></div>
      <div className="keyboard-controls">
        {[["None", ""], ["Ctrl / Cmd", "Control"], ["Alt", "Alt"], ["Shift", "Shift"]].map(([label, value]) => <button className={modifier === value ? "active" : ""} onClick={() => setModifier(value)} type="button" key={label}>{label}</button>)}
      </div>
      <div className="keyboard" role="group" aria-label={`${modifier || "No"} modifier recommendation map`}>
        {keyRows.map((row, rowIndex) => <div className="keyboard-row" key={rowIndex}>
          {row.map((key) => {
            const rec = recommendationFor(key, modifier ? [modifier] : [], intent, layout);
            const displayModifier = modifier === "Control" ? "Ctrl" : modifier;
            return <button type="button" className={`keyboard-key key-${rec.value} ${["Space", "Shift", "Caps"].includes(key) ? "key-wide" : ""}`} title={rec.reason} onClick={() => setShortcut({ id: `${modifier ? modifier.toLowerCase() + "-" : ""}${key.toLowerCase()}`, display: `${displayModifier ? displayModifier + " + " : ""}${key}`, modifiers: modifier ? [modifier] : [], key })} key={key}><span>{key}</span><i aria-label={statusLabel(rec.value)} /></button>;
          })}
        </div>)}
      </div>
      <div className="legend" aria-label="Recommendation legend"><span><i className="legend-recommended" /> Recommended</span><span><i className="legend-acceptable" /> Acceptable</span><span><i className="legend-avoid" /> Avoid</span><span><i className="legend-lack" /> Lack of data</span></div>
    </section>
  );
}
