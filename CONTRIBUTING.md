# Contributing to TomaNote

First of all, thanks for taking the time to contribute! This is a community-driven, open source project and any help is welcome — bug reports, feature proposals, or code improvements.

Please follow the guidelines below to keep the project organized and running smoothly.

---

## Project overview

- **Language / framework**: Astro (SSG) + Tailwind CSS + SCSS, TypeScript checked, JavaScript runtime modules.
- **Runtime**: Node.js >= 22.12.0.
- **Branches**: `master` is the default branch; `dev` is the integration branch. Never work directly on either of them.
- **i18n**: English (US) and Spanish (CO). All user-facing strings must go through the locale files.

---

## Getting started

1. **Fork** the repository.
2. **Clone** your fork locally:

   ```bash
   git clone https://github.com/Tomanote/TomaNote.git
   cd TomaNote
   ```

3. Add the original repository as an upstream remote (to stay in sync):

   ```bash
   git remote add upstream https://github.com/Tomanote/TomaNote.git
   ```

4. **Create a branch** for your work. Use a descriptive name with the matching prefix:

   ```bash
   git checkout -b feature/your-feature-name
   git checkout -b fix/your-bugfix-name
   git checkout -b hotfix/your-hotfix-name   # urgent production fix
   ```

5. **Install dependencies** with the exact lockfile versions:

   ```bash
   npm ci
   ```

---

## Development scripts

| Command              | Description                                            |
| -------------------- | ------------------------------------------------------ |
| `npm run dev`        | Starts the Astro dev server (syncs roadmap first)      |
| `npm run test`       | Runs unit tests with Vitest in watch mode              |
| `npm run test:run`   | Runs all unit tests once (run this before pushing)     |
| `npm run build`      | Production build (syncs roadmap + generates changelog) |
| `npm run changelog`  | Regenerates `CHANGELOG.md` from `roadmap-data.json`    |
| `npm run sync:roadmap` | Syncs roadmap translations into the locale files      |
| `npm run security:check` | Audits dependencies for high/critical vulnerabilities |
| `npx astro check`    | Type-checks the Astro project                          |

---

## Git workflow (strict)

1. **Never push directly to `master`.** All contributions must go through a **Pull Request**.
2. Feature branches are merged into **`dev`** first via PR. The owner reviews and merges `dev` → `master` manually.
3. `master` has branch protection: a PR is required and the `build-and-test` status check must pass before merging.
4. **Keep commits self-contained and independently revertable.** Each commit must be **revertible in isolation** without affecting other features integrated in the same branch/milestone. Each commit is one logical change that leaves the project in a working state. Do not mix changes from different features in a single commit; if a change depends on an earlier one, it must degrade gracefully (fallback) and not break anything when reverted.

### Conventional commits

Use [Conventional Commits](https://www.conventionalcommits.org/) — `type(scope): description` in English:

- `feat(scope): add ...`
- `fix(scope): correct ...`
- `refactor(scope): restructure ...`
- `docs(scope): update ...`
- `test(scope): cover ...`
- `chore(scope): ...`

Examples: `fix(editor): apply saved font-size to new tabs`, `docs(roadmap): add v0.5.1 entries`.

### Code quality (required before opening a PR)

All of the following must pass locally:

- `npm run test:run` — the full test suite.
- `npm run build` — the production build must assemble correctly.
- `npx astro check` — no TypeScript errors.

If any of these fail, fix them before opening the PR.

---

## CI / CD

GitHub Actions runs several automated checks:

- **`build-and-test`** (`.github/workflows/ci.yml`): runs `astro check`, the unit tests, and the production build on every PR to `master`/`dev` and on pushes to `master`. **This check blocks the merge** if it fails.
- **Security audit** (`.github/workflows/security.yml`): runs `npm audit` and an outdated-dependency report on every PR and push. It is **informational only** and does not block merges.
- **Deploy** (`.github/workflows/deploy.yml`): builds and publishes to GitHub Pages on every push to `master`.

**Deploy note**: the site is served from the `gh-pages` branch via GitHub Pages. A `.nojekyll` file must always be present in `dist/` — without it, Jekyll ignores the `_astro/` folder and the site renders blank. The deploy script uses `gh-pages -d dist -t` (the `-t` flag publishes dotfiles).

---

## Code conventions

- **Feature-based structure**: components live in `src/features/[name]/` as self-contained modules (Astro component, SCSS styles, JS logic, tests). See the existing features before creating a new one.
- **Class-based JS modules** with an `init()` pattern (`TabManager`, `ContextMenu`, etc.).
- **i18n**: never hardcode user-facing strings. Use the client i18n core in JS modules and the typed server i18n in `.astro` files. Both `en.json` and `es.json` must stay in sync.
- **Roadmap**: `src/features/roadmap/roadmap-data.json` is the single source of truth. `npm run sync:roadmap` and `npm run changelog` only read from it — do not edit the generated locale keys or `CHANGELOG.md` by hand.
- **Logging**: use the `devLogger` utility instead of raw `console.*`. Console output is gated to development builds, keeping the production bundle clean.

---

## Reporting issues / proposing changes

- Found a bug? Open an **Issue** using the `Bug Report` template.
- Want to propose a large change before coding it? Open an **Issue** or start a discussion first.
- When opening a PR, fill out the PR template so reviewers understand your change.

---

Thanks again for helping make TomaNote better! 🚀
