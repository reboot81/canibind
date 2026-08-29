# Can I Bind?

Can I Bind? is an open reference for browser keyboard shortcuts. It keeps two
questions deliberately separate:

- **Can I bind it?** Empirical capability by browser, version, operating system,
  and keyboard layout.
- **Should I bind it?** A recommendation based on conventions, accessibility,
  browser conflicts, international layouts, and the intended action.

The site starts in English, with message files separated from the interface so
additional locales can be added without restructuring the application.

## Status model

Capability: `YES`, `CONDITIONAL`, `NO`, `LACK OF DATA`.

A `YES` requires all three of these observations: the combination is received,
the application handler runs, and the competing browser or operating-system
action does not occur.

Recommendation: `RECOMMENDED`, `ACCEPTABLE`, `AVOID`, `LACK OF DATA`.
Recommendation is evaluated for a specific intended action. For example,
`Ctrl+Z` is a de facto Undo convention rather than a universally good shortcut
for every command.

## Development

```bash
npm install
npm run dev
npm test
npm run build
```

GitHub Actions verifies every push and pull request. A separate workflow builds
and publishes the static site to GitHub Pages from `main`.

## Data and contributions

The canonical public dataset is `public/data/compatibility.v1.json`, described
by `schemas/dataset.schema.json`. Each observation must preserve the actual
browser version and test-method version. The UI may group identical versions,
but raw observations must never lose that provenance.

Community runs require at least 20 tested combinations and a declared keyboard
layout. Submissions remain unverified until they can be independently
reproduced. The public dataset does not store account identifiers or IP
addresses.

The dataset is dedicated to the public domain under CC0 1.0. Code,
documentation, and design use CC BY-SA 4.0. See [LICENSE.md](LICENSE.md).
