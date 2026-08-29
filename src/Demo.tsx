import { useEffect, useRef, useState } from "react";
import type { KeyboardPlatform } from "./types";

interface DemoProps {
  open: boolean;
  onClose: () => void;
  platform: KeyboardPlatform;
}

const tickets = [
  { id: "AC-1048", customer: "Northstar Labs", subject: "VPN certificate renewal", owner: "M. Chen", priority: "High", age: "18m" },
  { id: "AC-1047", customer: "Fabrikam Retail", subject: "New starter provisioning", owner: "J. Reed", priority: "Normal", age: "42m" },
  { id: "AC-1043", customer: "Contoso Health", subject: "Mail flow delay", owner: "A. Patel", priority: "High", age: "1h" },
  { id: "AC-1039", customer: "Adventure Works", subject: "Device compliance review", owner: "S. Berg", priority: "Low", age: "3h" },
];

const navigation = [
  { id: "dashboard", label: "Dashboard", letter: "D", shortcut: "Alt+D" },
  { id: "customers", label: "Customers", letter: "C", shortcut: "Alt+C" },
  { id: "tickets", label: "Tickets", letter: "T", shortcut: "Alt+T" },
  { id: "projects", label: "Projects", letter: "P", shortcut: "Alt+P" },
];

function UnderlinedLabel({ label, letter }: { label: string; letter: string }) {
  const index = label.toLowerCase().indexOf(letter.toLowerCase());
  if (index < 0) return label;
  return <>{label.slice(0, index)}<u>{label[index]}</u>{label.slice(index + 1)}</>;
}

export default function Demo({ open, onClose, platform }: DemoProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const commandRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [view, setView] = useState("tickets");
  const [selectedTicket, setSelectedTicket] = useState(0);
  const [helpOpen, setHelpOpen] = useState(true);
  const [commandOpen, setCommandOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("Keyboard demo ready");

  const primary = platform === "mac" ? "Command (⌘)" : "Ctrl";

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => closeRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (commandOpen) window.requestAnimationFrame(() => commandRef.current?.focus());
  }, [commandOpen]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.repeat) return;
      const key = event.key.toLowerCase();
      const primaryModifier = event.ctrlKey || event.metaKey;

      if (event.key === "Escape") {
        event.preventDefault();
        if (commandOpen) setCommandOpen(false);
        else if (helpOpen) setHelpOpen(false);
        else onClose();
        return;
      }
      if (primaryModifier && key === "k") {
        event.preventDefault();
        setCommandOpen((value) => !value);
        setAnnouncement("Command palette toggled");
        return;
      }
      if (primaryModifier && key === "f") {
        event.preventDefault();
        searchRef.current?.focus();
        setAnnouncement("Ticket search focused");
        return;
      }
      if (event.shiftKey && event.key === "?") {
        event.preventDefault();
        setHelpOpen((value) => !value);
        setAnnouncement("Keyboard help toggled");
        return;
      }
      if (event.altKey && ["d", "c", "t", "p"].includes(key)) {
        event.preventDefault();
        const target = navigation.find((item) => item.letter.toLowerCase() === key);
        if (target) {
          setView(target.id);
          setAnnouncement(`${target.label} view opened`);
        }
        return;
      }
      if (event.altKey && key === "n") {
        event.preventDefault();
        setAnnouncement("New customer form would open");
        return;
      }
      if (["ArrowDown", "ArrowUp"].includes(event.key) && (event.target as HTMLElement | null)?.closest(".crm-ticket-list")) {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        const next = (selectedTicket + direction + tickets.length) % tickets.length;
        setSelectedTicket(next);
        rowRefs.current[next]?.focus();
        setAnnouncement(`${tickets[next].id}, ${tickets[next].subject}`);
        return;
      }
      if (event.key === "Enter" && (event.target as HTMLElement | null)?.closest(".crm-ticket-row")) {
        event.preventDefault();
        setAnnouncement(`${tickets[selectedTicket].id} details opened`);
        return;
      }
      if (event.key === "Tab") {
        const focusScope = commandOpen ? rootRef.current?.querySelector<HTMLElement>(".crm-command") : rootRef.current;
        const focusable = [...(focusScope?.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), [tabindex='0']") ?? [])];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [commandOpen, helpOpen, onClose, open, selectedTicket]);

  if (!open) return null;

  const keyboardOnly = (action: () => void) => (event: React.MouseEvent<HTMLButtonElement>) => {
    if (event.detail !== 0) return;
    action();
  };

  return (
    <div className="demo-overlay" role="dialog" aria-modal="true" aria-labelledby="crm-demo-title" ref={rootRef}>
      <div className="crm-demo">
        <header className="crm-topbar">
          <div className="crm-brand"><span>ACME</span><strong id="crm-demo-title">Service Operations</strong><small>Keyboard-first CRM demo</small></div>
          <div className="crm-top-actions"><span className="keyboard-mode">Keyboard mode active</span><button ref={closeRef} className="demo-close" type="button" onClick={onClose} title="Close demo (Escape)">Close <kbd>Esc</kbd></button></div>
        </header>

        <nav className="crm-nav" aria-label="ACME modules">
          {navigation.map((item) => <button type="button" className={view === item.id ? "active" : ""} aria-current={view === item.id ? "page" : undefined} aria-keyshortcuts={item.shortcut} title={`${item.label} — ${item.shortcut}`} onMouseDown={(event) => event.preventDefault()} onClick={keyboardOnly(() => { setView(item.id); setAnnouncement(`${item.label} view opened`); })} key={item.id}><UnderlinedLabel label={item.label} letter={item.letter} /><kbd>{item.shortcut}</kbd></button>)}
          <button type="button" aria-keyshortcuts="Shift+?" title="Open keyboard help — Shift + ?" onMouseDown={(event) => event.preventDefault()} onClick={keyboardOnly(() => setHelpOpen((value) => !value))}><u>H</u>elp<kbd>Shift + ?</kbd></button>
        </nav>

        <div className="crm-shell">
          <aside className="crm-sidebar">
            <p className="crm-section-label">Workspace</p>
            <strong>IT Support — Nordic</strong>
            <dl><div><dt>Open tickets</dt><dd>42</dd></div><div><dt>SLA at risk</dt><dd>3</dd></div><div><dt>Engineers online</dt><dd>8</dd></div></dl>
            <div className="crm-side-hint"><kbd>Tab</kbd><span>Move between controls</span><kbd>↑ ↓</kbd><span>Move in the ticket list</span><kbd>Enter</kbd><span>Open selected ticket</span></div>
          </aside>

          <div className="crm-main" role="region" aria-label={`${view} workspace`}>
            <div className="crm-page-heading"><div><p>Operations / <span>{view}</span></p><h2>{view === "tickets" ? "Service queue" : navigation.find((item) => item.id === view)?.label}</h2></div><button type="button" className="crm-new" aria-keyshortcuts="Alt+N" title="Create a new customer — Alt + N" onMouseDown={(event) => event.preventDefault()} onClick={keyboardOnly(() => setAnnouncement("New customer form would open"))}><u>N</u>ew customer <kbd>Alt + N</kbd></button></div>

            <div className="crm-toolbar">
              <label><span>Search tickets</span><input ref={searchRef} type="search" placeholder="Customer, ticket, or owner" aria-keyshortcuts="Control+F Meta+F" title={`Focus search — ${primary} + F`} onMouseDown={(event) => event.preventDefault()} /></label>
              <button type="button" aria-keyshortcuts="Control+K Meta+K" title={`Open command palette — ${primary} + K`} onMouseDown={(event) => event.preventDefault()} onClick={keyboardOnly(() => setCommandOpen(true))}>Command palette <kbd>{primary} + K</kbd></button>
            </div>

            <div className="crm-metrics" aria-label="Queue metrics"><article><span>First response</span><strong>11 min</strong><small>4 min faster today</small></article><article><span>Resolved today</span><strong>27</strong><small>82% within SLA</small></article><article><span>Customer score</span><strong>4.8 / 5</strong><small>Last 30 days</small></article></div>

            <div className="crm-ticket-list" role="listbox" aria-label="Open tickets">
              <div className="crm-ticket-header" aria-hidden="true"><span>Ticket</span><span>Customer / subject</span><span>Owner</span><span>Priority</span><span>Age</span></div>
              {tickets.map((ticket, index) => <button ref={(element) => { rowRefs.current[index] = element; }} type="button" role="option" aria-selected={selectedTicket === index} className={`crm-ticket-row ${selectedTicket === index ? "selected" : ""}`} tabIndex={selectedTicket === index ? 0 : -1} title={`Open ${ticket.id} — use Arrow keys, then Enter`} onMouseDown={(event) => event.preventDefault()} onClick={keyboardOnly(() => { setSelectedTicket(index); setAnnouncement(`${ticket.id} details opened`); })} key={ticket.id}><strong>{ticket.id}</strong><span><b>{ticket.customer}</b><small>{ticket.subject}</small></span><span>{ticket.owner}</span><span className={`priority priority-${ticket.priority.toLowerCase()}`}>{ticket.priority}</span><span>{ticket.age}</span></button>)}
            </div>
          </div>
        </div>

        <footer className="crm-footer"><span><strong>Keyboard:</strong> every command is visible and focus remains predictable.</span><span><kbd>{primary} + K</kbd> commands</span><span><kbd>{primary} + F</kbd> search</span><span><kbd>Shift + ?</kbd> help</span><span><kbd>Esc</kbd> close</span></footer>

        {helpOpen ? <aside className="crm-help" aria-labelledby="crm-help-title"><div><p className="crm-section-label">Always discoverable</p><h2 id="crm-help-title">Keyboard help</h2><p>Shortcuts appear beside commands, in mouseover titles, through underlined menu letters, and in this help panel.</p></div><dl><div><dt>Navigate modules</dt><dd><kbd>Alt + D/C/T/P</kbd></dd></div><div><dt>Command palette</dt><dd><kbd>{primary} + K</kbd></dd></div><div><dt>Search</dt><dd><kbd>{primary} + F</kbd></dd></div><div><dt>Ticket list</dt><dd><kbd>↑ ↓</kbd> then <kbd>Enter</kbd></dd></div><div><dt>Close help or demo</dt><dd><kbd>Esc</kbd></dd></div></dl><button type="button" title="Hide keyboard help — Shift + ?" aria-keyshortcuts="Shift+?" onMouseDown={(event) => event.preventDefault()} onClick={keyboardOnly(() => setHelpOpen(false))}>Hide help <kbd>Shift + ?</kbd></button></aside> : null}

        {commandOpen ? <div className="crm-command" role="dialog" aria-modal="true" aria-labelledby="command-title"><div><span>ACME command palette</span><kbd>Esc</kbd></div><h2 id="command-title">Run a command</h2><input ref={commandRef} type="search" placeholder="Type a command…" aria-label="Find a command" /><ul><li><strong>New customer</strong><kbd>Alt + N</kbd></li><li><strong>Open tickets</strong><kbd>Alt + T</kbd></li><li><strong>Keyboard help</strong><kbd>Shift + ?</kbd></li></ul></div> : null}
        <p className="sr-only" aria-live="polite">{announcement}</p>
      </div>
    </div>
  );
}
