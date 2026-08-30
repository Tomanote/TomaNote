# Milestone 0.5.6 — Milkdown Integration & UI Cleanup

> **Estado**: EN PROGRESO — FASES 0-5 completadas. Bugs conocidos pendientes.

---

## Estado de Fases

| Fase | Estado | Notas |
|------|--------|-------|
| FASE 0 — Setup | ✅ Completada | Milkdown instalado, `marked` eliminado |
| FASE 1 — Core Editor | ✅ Completada | Milkdown como base, dual HTML/Markdown |
| FASE 2 — GFM | ✅ Completada | Tablas, imágenes, links, code blocks |
| FASE 3 — Formatting Toolbar | ✅ Completada | Right Sidebar con 12 botones de formato |
| FASE 4 — Dropdowns | ✅ Completada | Toggle, click outside, escape, tab change |
| FASE 4.1 — Fix funcionalidades rotas | ✅ Completada | Underline plugin, headings, undo/redo, context menu |
| FASE 4.2 — Code Blocks + Shiki | ⏳ Pendiente | Syntax highlighting, line numbers |
| FASE 5 — Left Sidebar cleanup | ✅ Completada | Solo logo, search, help, settings |
| FASE 6 — Documentación | ⏳ Pendiente | README, CHANGELOG, AI_CONTEXT |
| FASE 7 — Playwright E2E | ⏳ Pendiente | Tests de UI real |
| FASE 8 — Git Flow | ⏳ Pendiente | Commits, push, PR |

---

## Bugs Conocidos (Pendientes)

### BUG-1: Botones de formato del Right Sidebar no funcionan

**Severidad**: Alta
**Estado**: Reproducido, no corregido

**Descripción**: Los botones de formato del Right Sidebar (Bold, H1-H3, Blockquote, Lists, Code, Link) dejaron de funcionar. Solo Itálica funciona.

**Causa probable**: Se editó `src/lib/scripts/ui/floatingMenu.js` (el archivo legacy) en lugar de `src/features/floating-menu/floating-menu.js` (el archivo que `entry.js` realmente importa). El routing a Milkdown está en el archivo equivocado.

**Fix conocido**: Agregar routing Milkdown a `src/features/floating-menu/floating-menu.js` — el mismo fix que se aplicó anteriormente pero que se perdió o no persistió.

**Archivos afectados**:
- `src/features/floating-menu/floating-menu.js` — Agregar routing `isMilkdown && hasEditor → executeCommand()`
- `src/features/floating-menu/floating-menu.js` — `handleBottomBarTextAction`也需要 routing

---

### BUG-2: Contenido después de blockquote/code — no hay espacio para escribir arriba

**Severidad**: Media
**Estado**: Parcialmente corregido (CSS padding-bottom agregado)

**Descripción**: Al insertar un blockquote, code block, o inline code como primer elemento, el usuario no puede hacer click arriba del bloque para crear un nuevo párrafo. Solo funciona abajo.

**Fix parcial**: Se agregó `padding-bottom: 4em` al `.ProseMirror`. Falta verificar que funciona en todos los casos.

---

### BUG-3: Underline no funciona desde botón del Right Sidebar

**Severidad**: Media
**Estado**: Plugin creado, routing pendiente de verificar

**Descripción**: El plugin de underline fue creado (`underlinePlugin.js`) y el editor lo carga, pero el botón del Right Sidebar no ejecuta el comando correctamente.

**Causa probable**: Mismo issue que BUG-1 — routing en el archivo equivocado.

---

### BUG-4: Ctrl+Z/Y no funciona (Undo/Redo)

**Severidad**: Alta
**Estado**: History plugin agregado, shortcuts registrados, pero no funciona

**Descripción**: A pesar de haber agregado el history plugin de ProseMirror y registrado los shortcuts Ctrl+Z/Y, undo/redo no funciona.

**Causa probable**: El history plugin puede no estar registrándose correctamente, o los shortcuts están siendo capturados por ProseMirror antes de que nuestro handler los vea.

**Archivos afectados**:
- `src/lib/scripts/core/milkdownEditor.js` — Verificar que `proseHistory` se usa correctamente
- `src/lib/scripts/ui/keyboardShortcuts.js` — Verificar shortcuts Ctrl+Z/Y

---

### BUG-5: Context menu undo/redo no funciona

**Severidad**: Media
**Estado**: Routing agregado pero no funciona

**Descripción**: Las opciones Undo/Redo del menú contextual no ejecutan acciones para tabs markdown.

**Causa probable**: Mismo issue que BUG-4 — el history plugin no está funcionando.

---

## Archivos Modificados en esta Milestone

### Archivos nuevos

| Archivo | Descripción |
|---------|-------------|
| `src/lib/scripts/core/milkdownEditor.js` | Wrapper de Milkdown — editor, auto-save, comandos |
| `src/lib/scripts/core/contentMigration.js` | Utilidad HTML↔Markdown |
| `src/lib/scripts/core/imageStorage.js` | Almacenamiento base64 de imágenes |
| `src/lib/scripts/core/plugins/underlinePlugin.js` | Plugin custom underline para ProseMirror |
| `src/lib/scripts/core/__tests__/milkdownEditor.test.js` | Tests del editor Milkdown |
| `src/lib/scripts/core/__tests__/milkdownAutosave.test.js` | Tests de auto-save |
| `src/styles/components/milkdown-editor.scss` | Estilos del editor Milkdown |
| `milestone-0.5.6.md` | Este archivo |

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `package.json` | +Milkdown deps, -marked |
| `src/lib/scripts/entry.js` | Init order: milkdownEditor antes de tabsSystem |
| `src/lib/scripts/core/tabs.js` | createTabElement dual, saveTabs simplificado, handleMilkdownTabSwitch, updateTabIds sync |
| `src/lib/scripts/core/tabDeletion.js` | Destroy editor + orphan cleanup |
| `src/features/floating-menu/floating-menu.js` | Routing Milkdown (RUTA CORRECTA) |
| `src/features/floating-menu/floating-menu.astro` | Formatting toolbar con 12 botones |
| `src/features/floating-menu/floating-menu.scss` | Estilos formatting toolbar |
| `src/features/contextual-menu/contextual-menu.js` | Routing Milkdown para bold/italic/underline/undo/redo/paste |
| `src/lib/scripts/ui/keyboardShortcuts.js` | Ctrl+B/I/U/Z/Y routing a Milkdown |
| `src/lib/scripts/ui/floatingMenu.js` | Legacy routing (no se usa — ver BUG-1) |
| `src/components/icons/Icon.astro` | +12 iconos de formato |
| `src/locales/en.json` | +claves i18n para formatting |
| `src/locales/es.json` | +claves i18n para formatting |
| `src/features/sidebar-left/SidebarLeft.astro` | Eliminados 4 botones externos |

---

## Fases Restantes

### FASE 4.2 — Code Blocks: Syntax Highlighting y UX

**Objetivo**: Mejorar presentación de bloques de código.

- [ ] Evaluar Shiki (bundle size, viabilidad)
- [ ] Code blocks: fondo, borde, monospace, label de lenguaje
- [ ] Line numbers (via Shiki o CSS counters)
- [ ] UX: cursor después de blockquote/code block

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

| Componente | Tecnología |
|------------|-----------|
| Editor engine | @milkdown/kit (ProseMirror) |
| Presets | commonmark + GFM |
| Theme | @milkdown/theme-nord |
| Underline | Plugin custom (underlinePlugin.js) |
| History | @milkdown/kit/prose/history via $prose wrapper |
| Storage | localStorage (markdown format) |
| Auto-save | MutationObserver + debounced save |

---

_Documento actualizado: 2026-08-30_
