export interface GuardrailSource {
  label: string;
  href: string;
}

export interface GuardrailRow {
  action: string;
  windows: string;
  mac: string;
  guidance: string;
  sources: GuardrailSource[];
}

export interface GuardrailGroup {
  title: string;
  rows: GuardrailRow[];
}

const microsoft: GuardrailSource = {
  label: "Microsoft",
  href: "https://support.microsoft.com/en-us/windows/keyboard-shortcuts-in-apps-139014e7-177b-d1f3-eb2e-7298b2599a34",
};
const apple: GuardrailSource = { label: "Apple", href: "https://support.apple.com/en-us/102650" };
const chrome: GuardrailSource = {
  label: "Chrome",
  href: "https://support.google.com/chrome/answer/157179?co=GENIE.Platform%3DDesktop&hl=en",
};
const firefox: GuardrailSource = {
  label: "Firefox",
  href: "https://support.mozilla.org/en-US/kb/keyboard-shortcuts-perform-firefox-tasks-quickly",
};
const apgKeyboard: GuardrailSource = {
  label: "WAI-ARIA APG",
  href: "https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/",
};
const apgDialog: GuardrailSource = {
  label: "APG dialog",
  href: "https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/",
};
const apgGrid: GuardrailSource = {
  label: "APG grid",
  href: "https://www.w3.org/WAI/ARIA/apg/patterns/grid/",
};
const apgMenu: GuardrailSource = {
  label: "APG menu",
  href: "https://www.w3.org/WAI/ARIA/apg/patterns/menubar/",
};
const wcagCharacters: GuardrailSource = {
  label: "WCAG 2.1.4",
  href: "https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html",
};
const ariaShortcuts: GuardrailSource = {
  label: "ARIA",
  href: "https://w3c.github.io/aria/#aria-keyshortcuts",
};

export const guardrailGroups: GuardrailGroup[] = [
  {
    title: "Editing and rich text",
    rows: [
      { action: "Undo", windows: "Ctrl + Z", mac: "Command (⌘) + Z", guidance: "Hard convention. Never reuse it for Save or another unrelated action.", sources: [microsoft, apple] },
      { action: "Redo", windows: "Ctrl + Y", mac: "Command (⌘) + Shift + Z", guidance: "The established shortcut differs by platform; support the platform convention shown.", sources: [microsoft, apple] },
      { action: "Cut", windows: "Ctrl + X", mac: "Command (⌘) + X", guidance: "Reserve for cutting the current selection and preserve native text-field behavior.", sources: [microsoft, apple] },
      { action: "Copy", windows: "Ctrl + C", mac: "Command (⌘) + C", guidance: "Reserve for copying. Do not override it globally unless the application supplies the expected clipboard result.", sources: [microsoft, apple] },
      { action: "Paste", windows: "Ctrl + V", mac: "Command (⌘) + V", guidance: "Reserve for paste and let editable controls keep native paste behavior.", sources: [microsoft, apple] },
      { action: "Select all", windows: "Ctrl + A", mac: "Command (⌘) + A", guidance: "Scope it to the focused collection or editor; global interception can surprise users.", sources: [microsoft, apple, apgKeyboard] },
      { action: "Bold", windows: "Ctrl + B", mac: "Command (⌘) + B", guidance: "Established in editors. Only activate where formatting is available.", sources: [microsoft, apple] },
      { action: "Italic", windows: "Ctrl + I", mac: "Command (⌘) + I", guidance: "Established in editors. Keep it contextual to editable rich text.", sources: [microsoft, apple] },
      { action: "Underline", windows: "Ctrl + U", mac: "Command (⌘) + U", guidance: "Common editor convention, but it competes with View Source in some browsers; verify the exact browser context.", sources: [microsoft, apple, firefox] },
    ],
  },
  {
    title: "Files, records, and destructive actions",
    rows: [
      { action: "Save", windows: "Ctrl + S", mac: "Command (⌘) + S", guidance: "Strong convention. A web app may override browser Save Page when it actually saves the current work.", sources: [microsoft, apple, chrome] },
      { action: "New record / document", windows: "Ctrl + N", mac: "Command (⌘) + N", guidance: "Understandable, but it normally opens a browser window. Prefer a visible New button plus a documented app shortcut such as Alt + N.", sources: [microsoft, apple, chrome] },
      { action: "Print", windows: "Ctrl + P", mac: "Command (⌘) + P", guidance: "Use only when the app opens an equivalent print flow; otherwise leave the browser command intact.", sources: [microsoft, apple, chrome] },
      { action: "Delete selected item", windows: "Delete", mac: "Delete / Command (⌘) + Backspace", guidance: "Keep it focus-scoped, confirm destructive actions when needed, and retain focus predictably after removal.", sources: [microsoft, apple, apgKeyboard] },
      { action: "Close tab / window", windows: "Ctrl + W / Alt + F4", mac: "Command (⌘) + W / Q", guidance: "Critical browser and OS commands. Do not recommend them for app actions or guided tests.", sources: [microsoft, apple, chrome] },
    ],
  },
  {
    title: "Find and browser navigation",
    rows: [
      { action: "Find in current view", windows: "Ctrl + F", mac: "Command (⌘) + F", guidance: "Familiar and bindable when the page receives and cancels the event, but the app then replaces browser Find.", sources: [microsoft, apple, chrome, firefox] },
      { action: "Focus address bar", windows: "Ctrl + L / Alt + D", mac: "Command (⌘) + L", guidance: "Browser-owned navigation. Avoid for app actions even if a particular environment lets the page observe it.", sources: [chrome, firefox, apple] },
      { action: "Reload", windows: "Ctrl + R / F5", mac: "Command (⌘) + R", guidance: "Browser-owned and potentially destructive to unsaved state. Never include in a guided test.", sources: [chrome, firefox, apple] },
      { action: "Next browser tab", windows: "Ctrl + Tab", mac: "Control (⌃) + Tab", guidance: "Browser-owned. Use a focus-scoped tab pattern with arrow keys for in-page tabs instead.", sources: [chrome, firefox, apgKeyboard] },
      { action: "Previous browser tab", windows: "Ctrl + Shift + Tab", mac: "Control (⌃) + Shift + Tab", guidance: "Browser-owned. Do not repurpose for an in-page tab strip.", sources: [chrome, firefox, apgKeyboard] },
      { action: "History back / forward", windows: "Alt + Left / Right", mac: "Command (⌘) + [ / ]", guidance: "Browser navigation with data-loss risk. Exclude from tests and app commands.", sources: [chrome, firefox, apple] },
      { action: "Open browser search", windows: "Ctrl + K / Ctrl + E", mac: "Command (⌘) + Option (⌥) + F", guidance: "May compete with an app command palette. Detect per browser and provide a visible alternative.", sources: [chrome, firefox, apple] },
    ],
  },
  {
    title: "Application structure and focus",
    rows: [
      { action: "Move to next control", windows: "Tab", mac: "Tab", guidance: "Native focus navigation. Never cancel it for a page-wide shortcut handler.", sources: [apgKeyboard] },
      { action: "Move to previous control", windows: "Shift + Tab", mac: "Shift + Tab", guidance: "Native reverse focus navigation. Preserve it everywhere, including dialogs.", sources: [apgKeyboard] },
      { action: "Activate control", windows: "Enter / Space", mac: "Enter / Space", guidance: "Use native button and link elements so activation works without custom key handlers.", sources: [apgKeyboard] },
      { action: "Cancel / close transient UI", windows: "Escape", mac: "Escape", guidance: "Established for dialogs, menus, and popovers. Return focus to the control that opened the UI.", sources: [apgDialog, apgMenu] },
      { action: "Move inside a composite widget", windows: "Arrow keys", mac: "Arrow keys", guidance: "Use arrows within menus, tab lists, grids, and similar composites while Tab leaves the component.", sources: [apgKeyboard, apgGrid, apgMenu] },
      { action: "First / last item", windows: "Home / End", mac: "Home / End or Fn + Left / Right", guidance: "Useful in long lists and grids when the component documents and implements it consistently.", sources: [apgGrid, apple] },
      { action: "Context menu", windows: "Shift + F10 / Menu", mac: "Control (⌃) + click equivalent", guidance: "Provide an explicit menu button too; hardware and assistive-technology conventions vary.", sources: [microsoft, apple, apgMenu] },
      { action: "Command palette", windows: "Ctrl + K or Ctrl + Shift + P", mac: "Command (⌘) + K or Command (⌘) + Shift + P", guidance: "No universal web standard. Make it discoverable, show the shortcut beside the command, and avoid browser conflicts where possible.", sources: [ariaShortcuts, apgKeyboard] },
      { action: "Shortcut help", windows: "Visible Help button", mac: "Visible Help button", guidance: "Do not rely on a punctuation-only global shortcut. If Shift + ? is offered, also provide a visible control and announce the binding.", sources: [wcagCharacters, ariaShortcuts] },
    ],
  },
];
