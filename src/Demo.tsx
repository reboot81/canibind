import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardPlatform } from "./types";

interface DemoProps { open: boolean; onClose: () => void; platform: KeyboardPlatform; }

const tickets = [
  { id: "AC-1048", customer: "Northstar Labs", subject: "VPN certificate renewal", owner: "M. Chen", priority: "High", age: "18m" },
  { id: "AC-1047", customer: "Fabrikam Retail", subject: "New starter provisioning", owner: "J. Reed", priority: "Normal", age: "42m" },
  { id: "AC-1043", customer: "Contoso Health", subject: "Mail flow delay", owner: "A. Patel", priority: "High", age: "1h" },
  { id: "AC-1039", customer: "Adventure Works", subject: "Device compliance review", owner: "S. Berg", priority: "Low", age: "3h" },
];
const navigation = [
  { id: "dashboard", label: "Dashboard", letter: "D", shortcut: "F2" },
  { id: "customers", label: "Customers", letter: "C", shortcut: "F3" },
  { id: "tickets", label: "Tickets", letter: "T", shortcut: "F4" },
  { id: "projects", label: "Projects", letter: "P", shortcut: "F6" },
] as const;
const commandEntries = [
  { id: "new", label: "New customer", shortcut: "Alt + N" }, { id: "tickets", label: "Open tickets", shortcut: "Alt + T / F4" },
  { id: "dashboard", label: "Open dashboard", shortcut: "F2" }, { id: "customers", label: "Open customers", shortcut: "F3" },
  { id: "projects", label: "Open projects", shortcut: "F6" }, { id: "print", label: "Print current view", shortcut: "Command/Ctrl + P" },
  { id: "help", label: "Keyboard help", shortcut: "Shift + ?" },
] as const;
type ViewId = typeof navigation[number]["id"];
type CommandId = typeof commandEntries[number]["id"];
type SortColumn = "ticket" | "customer" | "owner" | "priority" | "age";
type SortState = { column: SortColumn; direction: "ascending" | "descending" };
const sortShortcut: Record<string, SortColumn> = { t: "ticket", c: "customer", o: "owner", p: "priority", a: "age" };
const functionNavigation: Record<string, ViewId> = { F2: "dashboard", F3: "customers", F4: "tickets", F6: "projects" };

function UnderlinedLabel({ label, letter }: { label: string; letter: string }) {
  const index = label.toLowerCase().indexOf(letter.toLowerCase());
  return <span>{index < 0 ? label : <>{label.slice(0, index)}<u>{label[index]}</u>{label.slice(index + 1)}</>}</span>;
}
function shortcutLabel(event: KeyboardEvent, platform: KeyboardPlatform): string {
  const modifiers = [event.metaKey ? platform === "mac" ? "Command (⌘)" : "Windows" : null, event.ctrlKey ? "Ctrl" : null, event.altKey ? platform === "mac" ? "Option (⌥)" : "Alt" : null, event.shiftKey ? "Shift" : null].filter(Boolean);
  return [...modifiers, event.key.length === 1 ? event.key.toUpperCase() : event.key].join(" + ");
}
function ageInMinutes(age: string): number { return age.endsWith("h") ? Number.parseInt(age, 10) * 60 : Number.parseInt(age, 10); }
function keyboardOnly(action: () => void) { return (event: React.MouseEvent<HTMLButtonElement>) => { if (event.detail === 0) action(); }; }

export default function Demo({ open, onClose, platform }: DemoProps) {
  const rootRef = useRef<HTMLDivElement>(null); const closeRef = useRef<HTMLButtonElement>(null); const searchRef = useRef<HTMLInputElement>(null); const commandRef = useRef<HTMLInputElement>(null);
  const flashTimer = useRef<number | null>(null);
  const [view, setView] = useState<ViewId>("tickets"); const [selectedTicket, setSelectedTicket] = useState(tickets[0].id); const [helpOpen, setHelpOpen] = useState(true);
  const [viewFocusRequest, setViewFocusRequest] = useState<{ view: ViewId; sequence: number } | null>(null);
  const [commandOpen, setCommandOpen] = useState(false); const [commandQuery, setCommandQuery] = useState(""); const [commandIndex, setCommandIndex] = useState(0);
  const [sort, setSort] = useState<SortState>({ column: "ticket", direction: "ascending" }); const [lastShortcut, setLastShortcut] = useState("Waiting for a keyboard command");
  const [keyboardFlash, setKeyboardFlash] = useState(false); const [announcement, setAnnouncement] = useState("Keyboard demo ready");
  const primary = platform === "mac" ? "Command (⌘)" : "Ctrl";
  const visibleCommands = useMemo(() => commandEntries.filter((command) => command.label.toLowerCase().includes(commandQuery.toLowerCase())), [commandQuery]);
  const sortedTickets = useMemo(() => [...tickets].sort((left, right) => {
    const values: Record<SortColumn, [string | number, string | number]> = { ticket: [left.id, right.id], customer: [`${left.customer} ${left.subject}`, `${right.customer} ${right.subject}`], owner: [left.owner, right.owner], priority: [{ High: 3, Normal: 2, Low: 1 }[left.priority] ?? 0, { High: 3, Normal: 2, Low: 1 }[right.priority] ?? 0], age: [ageInMinutes(left.age), ageInMinutes(right.age)] };
    const [a, b] = values[sort.column]; const comparison = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
    return sort.direction === "ascending" ? comparison : -comparison;
  }), [sort]);
  const signalShortcut = useCallback((event: KeyboardEvent) => {
    const label = shortcutLabel(event, platform); setLastShortcut(label); setKeyboardFlash(false); window.requestAnimationFrame(() => setKeyboardFlash(true));
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current); flashTimer.current = window.setTimeout(() => setKeyboardFlash(false), 520); return label;
  }, [platform]);
  const activateView = useCallback((nextView: ViewId, text?: string) => {
    setView(nextView); setAnnouncement(text ?? `${navigation.find((item) => item.id === nextView)?.label} view opened`);
    setViewFocusRequest((current) => ({ view: nextView, sequence: (current?.sequence ?? 0) + 1 }));
  }, []);
  const changeSort = useCallback((column: SortColumn) => { setSort((current) => current.column === column ? { column, direction: current.direction === "ascending" ? "descending" : "ascending" } : { column, direction: "ascending" }); setAnnouncement(`Tickets sorted by ${column}`); }, []);
  const runCommand = useCallback((id: CommandId) => {
    if (id === "new") { setAnnouncement("New customer command detected — the ACME customer form would open."); setCommandOpen(false); return; }
    if (id === "print") { setAnnouncement("Print command captured — ACME would open its print flow; browser print is suppressed."); setCommandOpen(false); return; }
    if (id === "help") { setHelpOpen(true); setCommandOpen(false); setAnnouncement("Keyboard help opened"); return; }
    setCommandOpen(false); activateView(id);
  }, [activateView]);

  useEffect(() => {
    if (!open) return; const previousFocus = document.activeElement as HTMLElement | null; const previousOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; window.requestAnimationFrame(() => closeRef.current?.focus());
    return () => { document.body.style.overflow = previousOverflow; if (flashTimer.current !== null) window.clearTimeout(flashTimer.current); previousFocus?.focus(); };
  }, [open]);
  useEffect(() => { if (commandOpen) window.requestAnimationFrame(() => commandRef.current?.focus()); }, [commandOpen]);
  useEffect(() => { if (viewFocusRequest) window.requestAnimationFrame(() => rootRef.current?.querySelector<HTMLButtonElement>(`[data-demo-view="${viewFocusRequest.view}"]`)?.focus()); }, [viewFocusRequest]);
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      const target = event.target as HTMLElement | null; const key = event.key.toLowerCase(); const physicalLetter = /^Key([A-Z])$/.exec(event.code)?.[1].toLowerCase() ?? key; const primaryModifier = event.ctrlKey || event.metaKey;
      const helpShortcut = event.shiftKey && (event.key === "?" || event.code === "Slash" || event.code === "Minus"); const comboDelivered = primaryModifier || event.altKey || event.key.startsWith("F") || event.key === "Escape" || helpShortcut; const label = comboDelivered ? signalShortcut(event) : "";
      if (event.key === "Escape") { event.preventDefault(); if (commandOpen) { setCommandOpen(false); setAnnouncement("Command palette closed"); } else if (helpOpen) { setHelpOpen(false); setAnnouncement("Keyboard help closed"); } else onClose(); return; }
      if (helpShortcut) { event.preventDefault(); setHelpOpen((current) => !current); setAnnouncement("Keyboard help toggled"); return; }
      if (primaryModifier && physicalLetter === "p") { event.preventDefault(); runCommand("print"); return; }
      if (primaryModifier && physicalLetter === "k") { event.preventDefault(); setCommandOpen((current) => !current); setCommandQuery(""); setCommandIndex(0); setAnnouncement("Command palette toggled"); return; }
      if (primaryModifier && physicalLetter === "f") { event.preventDefault(); searchRef.current?.focus(); setAnnouncement("Ticket search focused"); return; }
      if (event.altKey && !event.shiftKey && physicalLetter === "n") { event.preventDefault(); runCommand("new"); return; }
      if (event.altKey && !event.shiftKey && physicalLetter === "t") { event.preventDefault(); runCommand("tickets"); return; }
      if (event.altKey && event.shiftKey && sortShortcut[physicalLetter]) { event.preventDefault(); changeSort(sortShortcut[physicalLetter]); return; }
      if (functionNavigation[event.code]) { event.preventDefault(); activateView(functionNavigation[event.code]); return; }
      if (commandOpen && ["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); if (!visibleCommands.length) return; const direction = event.key === "ArrowDown" ? 1 : -1; setCommandIndex((current) => (current + direction + visibleCommands.length) % visibleCommands.length); return; }
      if (commandOpen && event.key === "Enter") { event.preventDefault(); const command = visibleCommands[commandIndex]; if (command) runCommand(command.id); return; }
      if (["ArrowDown", "ArrowUp"].includes(event.key) && target?.closest(".crm-ticket-list")) { event.preventDefault(); const currentIndex = Math.max(0, sortedTickets.findIndex((ticket) => ticket.id === selectedTicket)); const direction = event.key === "ArrowDown" ? 1 : -1; const next = (currentIndex + direction + sortedTickets.length) % sortedTickets.length; setSelectedTicket(sortedTickets[next].id); window.requestAnimationFrame(() => rootRef.current?.querySelector<HTMLButtonElement>(`[data-ticket-id="${sortedTickets[next].id}"]`)?.focus()); setAnnouncement(`${sortedTickets[next].id}, ${sortedTickets[next].subject}`); return; }
      if (event.key === "Enter" && target?.closest(".crm-ticket-row")) { event.preventDefault(); setAnnouncement(`${selectedTicket} details opened`); return; }
      if (["ArrowDown", "ArrowUp"].includes(event.key) && !target?.closest("input, textarea")) { event.preventDefault(); const focusable = [...(rootRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), [tabindex='0']") ?? [])]; const current = Math.max(0, focusable.indexOf(document.activeElement as HTMLElement)); const direction = event.key === "ArrowDown" ? 1 : -1; const next = (current + direction + focusable.length) % focusable.length; focusable[next]?.focus(); setAnnouncement(`Focus moved to ${focusable[next]?.getAttribute("aria-label") ?? focusable[next]?.textContent?.trim() ?? "next control"}`); return; }
      if (["ArrowLeft", "ArrowRight"].includes(event.key) && !target?.closest("input, textarea, .crm-ticket-list")) { event.preventDefault(); const currentIndex = navigation.findIndex((item) => item.id === view); const direction = event.key === "ArrowRight" ? 1 : -1; activateView(navigation[(currentIndex + direction + navigation.length) % navigation.length].id); return; }
      if (event.key === "Tab") { const focusScope = commandOpen ? rootRef.current?.querySelector<HTMLElement>(".crm-command") : rootRef.current; const focusable = [...(focusScope?.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), [tabindex='0']") ?? [])]; if (!focusable.length) return; const first = focusable[0]; const last = focusable[focusable.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } return; }
      if (comboDelivered) { event.preventDefault(); setAnnouncement(`${label} detected — no ACME action is assigned to this combination.`); }
    };
    window.addEventListener("keydown", handleKeyDown, { capture: true }); return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [activateView, changeSort, commandIndex, commandOpen, helpOpen, onClose, open, runCommand, selectedTicket, signalShortcut, sortedTickets, view, visibleCommands]);
  if (!open) return null;
  const sortHeaders: { column: SortColumn; label: string; shortcut: string }[] = [{ column: "ticket", label: "Ticket", shortcut: "Alt + Shift + T" }, { column: "customer", label: "Customer / subject", shortcut: "Alt + Shift + C" }, { column: "owner", label: "Owner", shortcut: "Alt + Shift + O" }, { column: "priority", label: "Priority", shortcut: "Alt + Shift + P" }, { column: "age", label: "Age", shortcut: "Alt + Shift + A" }];
  return <div className="demo-overlay" role="dialog" aria-modal="true" aria-labelledby="crm-demo-title" ref={rootRef}><div className="crm-demo">
    <header className="crm-topbar"><div className="crm-brand"><span>ACME</span><strong id="crm-demo-title">Service Operations</strong><small>Keyboard-first CRM demo</small></div><div className="crm-top-actions"><span className={`keyboard-mode ${keyboardFlash ? "command-detected" : ""}`}><b>Keyboard mode</b><small>{lastShortcut}</small></span><button ref={closeRef} className="demo-close" type="button" onClick={onClose} title="Close demo (Escape)">Close <kbd>Esc</kbd></button></div></header>
    <nav className="crm-nav" aria-label="ACME modules">{navigation.map((item) => <button data-demo-view={item.id} type="button" className={view === item.id ? "active" : ""} aria-current={view === item.id ? "page" : undefined} aria-keyshortcuts={item.shortcut} title={`${item.label} — ${item.shortcut}; Arrow Left/Right moves between modules`} onMouseDown={(event) => event.preventDefault()} onClick={keyboardOnly(() => activateView(item.id))} key={item.id}><UnderlinedLabel label={item.label} letter={item.letter} /><kbd>{item.shortcut}</kbd></button>)}<button type="button" aria-keyshortcuts="Shift+?" title="Open keyboard help — Shift + ?" onMouseDown={(event) => event.preventDefault()} onClick={keyboardOnly(() => setHelpOpen((value) => !value))}><UnderlinedLabel label="Help" letter="H" /><kbd>Shift + ?</kbd></button></nav>
    <div className="crm-shell"><aside className="crm-sidebar"><p className="crm-section-label">Workspace</p><strong>IT Support — Nordic</strong><dl><div><dt>Open tickets</dt><dd>42</dd></div><div><dt>SLA at risk</dt><dd>3</dd></div><div><dt>Engineers online</dt><dd>8</dd></div></dl><div className="crm-side-hint"><kbd>F2/F3/F4/F6</kbd><span>Open a module</span><kbd>← →</kbd><span>Move between modules</span><kbd>↑ ↓</kbd><span>Move in the ticket list</span><kbd>Enter</kbd><span>Open selected ticket</span></div></aside>
      <div className="crm-main" role="region" aria-label={`${view} workspace`}><div className="crm-page-heading"><div><p>Operations / <span>{view}</span></p><h2>{view === "tickets" ? "Service queue" : navigation.find((item) => item.id === view)?.label}</h2></div><button type="button" className="crm-new" aria-keyshortcuts="Alt+N" title="Create a new customer — Alt + N" onMouseDown={(event) => event.preventDefault()} onClick={keyboardOnly(() => runCommand("new"))}><UnderlinedLabel label="New customer" letter="N" /><kbd>Alt + N</kbd></button></div><div className="crm-toolbar"><label><span>Search tickets</span><input ref={searchRef} type="search" placeholder="Customer, ticket, or owner" aria-keyshortcuts="Control+F Meta+F" title={`Focus search — ${primary} + F`} onMouseDown={(event) => event.preventDefault()} /></label><button type="button" aria-keyshortcuts="Control+K Meta+K" title={`Open command palette — ${primary} + K`} onMouseDown={(event) => event.preventDefault()} onClick={keyboardOnly(() => setCommandOpen(true))}>Command palette <kbd>{primary} + K</kbd></button></div><div className="crm-metrics" aria-label="Queue metrics"><article><span>First response</span><strong>11 min</strong><small>4 min faster today</small></article><article><span>Resolved today</span><strong>27</strong><small>82% within SLA</small></article><article><span>Customer score</span><strong>4.8 / 5</strong><small>Last 30 days</small></article></div><div className="crm-ticket-list" role="listbox" aria-label="Open tickets"><div className="crm-ticket-header">{sortHeaders.map((header) => <button type="button" aria-sort={sort.column === header.column ? sort.direction : "none"} aria-keyshortcuts={header.shortcut.replaceAll(" + ", "+")} title={`Sort by ${header.label} — ${header.shortcut}`} onMouseDown={(event) => event.preventDefault()} onClick={keyboardOnly(() => changeSort(header.column))} key={header.column}>{header.label}</button>)}</div>{sortedTickets.map((ticket) => <button data-ticket-id={ticket.id} type="button" role="option" aria-selected={selectedTicket === ticket.id} className={`crm-ticket-row ${selectedTicket === ticket.id ? "selected" : ""}`} tabIndex={selectedTicket === ticket.id ? 0 : -1} title={`Open ${ticket.id} — use Arrow keys, then Enter`} onMouseDown={(event) => event.preventDefault()} onClick={keyboardOnly(() => { setSelectedTicket(ticket.id); setAnnouncement(`${ticket.id} details opened`); })} key={ticket.id}><strong>{ticket.id}</strong><span><b>{ticket.customer}</b><small>{ticket.subject}</small></span><span>{ticket.owner}</span><span className={`priority priority-${ticket.priority.toLowerCase()}`}>{ticket.priority}</span><span>{ticket.age}</span></button>)}</div></div></div>
    <footer className="crm-footer"><span><strong>Keyboard:</strong> every delivered combination is acknowledged; browser defaults are suppressed in this demo.</span><span><kbd>{primary} + K</kbd> commands</span><span><kbd>{primary} + P</kbd> print flow</span><span><kbd>F2/F3/F4/F6</kbd> modules</span><span><kbd>Shift + ?</kbd> help</span><span><kbd>Esc</kbd> close</span></footer>
    {helpOpen ? <aside className="crm-help" aria-labelledby="crm-help-title"><div><p className="crm-section-label">Always discoverable</p><h2 id="crm-help-title">Keyboard help</h2><p>Every delivered key combination flashes in the header. Assigned commands perform an action; unassigned combinations are acknowledged without changing the browser.</p></div><dl><div><dt>Modules</dt><dd><kbd>F2/F3/F4/F6</kbd> or <kbd>← →</kbd></dd></div><div><dt>Command palette</dt><dd><kbd>{primary} + K</kbd>; <kbd>↑ ↓</kbd>; <kbd>Enter</kbd></dd></div><div><dt>New / tickets</dt><dd><kbd>Alt + N</kbd>; <kbd>Alt + T</kbd></dd></div><div><dt>Sort columns</dt><dd><kbd>Alt + Shift + T/C/O/P/A</kbd></dd></div><div><dt>Print / search</dt><dd><kbd>{primary} + P/F</kbd></dd></div><div><dt>Help / close</dt><dd><kbd>Shift + ?</kbd>; <kbd>Esc</kbd></dd></div></dl><button type="button" title="Hide keyboard help — Shift + ?" aria-keyshortcuts="Shift+?" onMouseDown={(event) => event.preventDefault()} onClick={keyboardOnly(() => setHelpOpen(false))}>Hide help <kbd>Shift + ?</kbd></button></aside> : null}
    {commandOpen ? <div className="crm-command" role="dialog" aria-modal="true" aria-labelledby="command-title"><div><span>ACME command palette</span><kbd>Esc</kbd></div><h2 id="command-title">Run a command</h2><input ref={commandRef} type="search" placeholder="Type a command…" aria-label="Find a command" value={commandQuery} onChange={(event) => { setCommandQuery(event.target.value); setCommandIndex(0); }} /><p><kbd>↑ ↓</kbd> choose · <kbd>Enter</kbd> run</p><ul role="listbox" aria-label="Available commands">{visibleCommands.map((command, index) => <li className={index === commandIndex ? "selected" : ""} role="option" aria-selected={index === commandIndex} key={command.id}><strong>{command.label}</strong><kbd>{command.shortcut}</kbd></li>)}</ul></div> : null}
    <p className="sr-only" aria-live="polite">{announcement}</p>
  </div></div>;
}
