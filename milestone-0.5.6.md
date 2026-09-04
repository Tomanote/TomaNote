# Milestone 0.5.6 — Milkdown Integration & UI Cleanup

> **Estado**: FASES 0-7 completadas. FASE 8 (Git Flow) pendiente.

---

## Estado de Fases

| Fase                                 | Estado        | Notas                                               |
| ------------------------------------ | ------------- | --------------------------------------------------- |
| FASE 0 — Setup                       | ✅ Completada | Milkdown instalado, `marked` eliminado              |
| FASE 1 — Core Editor                 | ✅ Completada | Milkdown como base, dual HTML/Markdown              |
| FASE 2 — GFM                         | ✅ Completada | Tablas, imágenes, links, code blocks                |
| FASE 3 — Formatting Toolbar          | ✅ Completada | Right Sidebar con 12 botones de formato             |
| FASE 4 — Dropdowns                   | ✅ Completada | Toggle, click outside, escape, tab change           |
| FASE 4.1 — Fix funcionalidades rotas | ✅ Completada | Underline plugin, headings, undo/redo, context menu |
| FASE 4.1b — Integration bug fixes     | ✅ Completada | schemaCtx key, stale state, position validation    |
| FASE 4.2 — Code Blocks + Shiki       | ✅ Completada | Shiki lazy load, lang labels, line numbers, CSS   |
| FASE 5 — Left Sidebar cleanup        | ✅ Completada | Solo logo, search, help, settings                   || FASE 6 — Playwright E2E              | ✅ Completada | 56 tests: 25 editor, 22 UI, 9 persistence           |
| FASE 7 — Documentación               | ✅ Completada | README, CHANGELOG, AI_CONTEXT, roadmap, modal       |
| FASE 8 — Git Flow                    | ⏳ Pendiente  | Commits, push, merge, PR                           |

---

## Archivos Modificados en esta Milestone

### Archivos nuevos

---

## Fases Restantes

### PHASE 4.2 — Code Blocks: Syntax Highlighting & UX

Objective

Improve the presentation and usability of code blocks in TomaNote's Markdown editor and rendered output.

The goal is to make code blocks visually clear, readable, and consistent with the rest of the TomaNote UI, while keeping the implementation lightweight and avoiding unnecessary bundle-size or performance costs.

1. Evaluate Syntax Highlighting

First, investigate the feasibility of using Shiki for syntax highlighting.

**Evaluate:**

- Bundle size impact.
- Runtime vs. build-time implications.
- Compatibility with TomaNote's current Markdown/editor architecture.
- Number of supported languages and whether this is relevant for TomaNote.
- Performance implications.
- Whether Shiki introduces unnecessary complexity for our use case.
- Possible alternatives if Shiki is not the best fit.

Do not introduce Shiki automatically.

First determine whether it is technically justified for TomaNote. If another approach provides a better balance between functionality, bundle size, performance, and maintainability, document and recommend it.

2. Code Block Visual Design

Improve the visual presentation of fenced code blocks.

Code blocks should have:

- A clearly distinguishable background.
- A subtle border.
- Appropriate padding and spacing.
- A monospace font.
- Good readability in both light and dark themes.
- Consistent styling with TomaNote's existing design system.
- Clear visual separation from surrounding Markdown content.

Avoid excessive decoration. The design should remain clean and focused on readability.

3. Language Label

When a fenced code block specifies a language, display an appropriate language label.

For example:

```javascript
const example = true;
```

should expose `JavaScript` (or the project's chosen representation) as the language identifier.

Consider how this should behave when:

- A language is explicitly specified.
- No language is specified.
- The language identifier is unsupported.
- The language identifier uses an alias.

The implementation should fail gracefully rather than producing broken output

4. Line Numbers

Evaluate and implement line numbers for code blocks if they provide meaningful value.

Possible approaches include:

- Shiki-generated line numbers.
- CSS counters.
- Another lightweight implementation.

Consider:

- Performance.
- Accessibility.
- Copy/paste behavior.
- Long code blocks.
- Horizontal scrolling.
- Alignment when lines wrap.
- Consistency with the selected syntax-highlighting solution.

Line numbers should not interfere with selecting or copying the actual code.

### 5. Editor UX

Review the cursor behavior immediately after block-level Markdown elements.

In particular, verify the experience when the user places the cursor after:

- A blockquote.
- A fenced code block.

The user should be able to continue writing naturally after these blocks without unexpected cursor positioning, formatting, or insertion behavior.

Test realistic editing scenarios rather than only the simplest case.

### 6. Testing

Add or update tests for all new behavior introduced by this phase.

At minimum, cover:

- Code block rendering.
- Language detection/labels.
- Missing or unsupported languages.
- Syntax highlighting behavior.
- Line numbers, if implemented.
- Light/dark theme rendering where applicable.
- Cursor behavior after blockquotes.
- Cursor behavior after code blocks.
- Regression cases for existing Markdown functionality.

Do not consider the phase complete simply because the UI looks correct manually. The relevant behavior must be covered by automated tests where technically appropriate.

### 7. Implementation Constraints

While implementing this phase:

- Follow the existing TomaNote architecture and conventions.
- Reuse existing utilities and components where appropriate.
- Avoid introducing unnecessary dependencies.
- Keep bundle size and runtime performance in mind.
- Do not modify unrelated functionality.
- Preserve existing Markdown behavior.
- Maintain accessibility.
- Ensure the implementation works consistently across supported themes.

### Definition of Done

Phase 4.2 is complete when:

- The syntax-highlighting approach has been evaluated and justified.
- Code blocks have a polished and consistent visual presentation.
- Language labels work correctly.
- Line numbers are implemented if the chosen approach justifies them.
- Cursor behavior after blockquotes and code blocks is correct.
- Relevant automated tests have been added.
- Existing Markdown functionality continues to work without regressions.
- The implementation is documented clearly enough for future maintenance.

### FASE 6 — Documentación

- [ ] `package.json` — version "0.5.6"
- [ ] `README.md` — Badge v0.5.6, What's new
- [ ] `AI_CONTEXT.md` — Versión, arquitectura editor, test count
- [ ] `CHANGELOG.md` — v0.5.6 section
- [ ] `src/features/roadmap/roadmap-data.json` — v0.5.6 current
- [ ] `src/features/modal-info/modal-info.astro` — Versión v0.5.6

### FASE 7 — Testing E2E con Playwright

- [ ] Setup Playwright
- [ ] Tests del editor (crear, escribir, formato, persistencia)
- [ ] Tests de UI (sidebar, modales, mobile)
- [ ] Tests de persistencia (localStorage, reload, migración)

### FASE 8 — Git Flow

- [ ] Commits por fase
- [ ] Push milestone-0.5.6
- [ ] Merge → dev
- [ ] PR dev → master

---

## Stack Tecnológico

| Componente    | Tecnología                                     |
| ------------- | ---------------------------------------------- |
| Editor engine | @milkdown/kit (ProseMirror)                    |
| Presets       | commonmark + GFM                               |
| Theme         | @milkdown/theme-nord                           |
| Underline     | Plugin custom (underlinePlugin.js)             |
| History       | @milkdown/kit/prose/history via $prose wrapper |
| Storage       | localStorage (markdown format)                 |
| Auto-save     | MutationObserver + debounced save              |

---

_Documento actualizado: 2026-08-30_
