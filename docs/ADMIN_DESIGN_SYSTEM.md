# StudyForm Admin UI Design System

This document is the source of truth for the authenticated researcher UI: home, `신청서`, `신청자`, `일정`, and `연락`.

The goal is not to make every page decorative. The goal is to make the same interaction mean and look the same everywhere.

## 1. Non-negotiable principles

1. **One visual language across every researcher page.**
   - same button variants
   - same input/select/textarea geometry
   - same surface border/radius
   - same divider thickness/color
   - same typography scale and font family
   - same status badge vocabulary
   - same list selection treatment
2. **Hierarchy before decoration.** Use spacing, typography, and one parent surface before adding a box.
3. **No box accumulation.** A new piece of context does not justify a new card by itself. Avoid nested bordered rectangles and card-per-value layouts.
4. **No microcopy accumulation.** If label, status, or value already explains the state, do not repeat it with another tiny helper line.
5. **No left-rail state language.** A colored left edge must never be the sole selected/status treatment. Use a subtle full-surface state plus text/badge where needed.
6. **One primary action per operational region.** Secondary/destructive actions must not compete with the next task.
7. **No page-local generic controls.** Generic button, input, dropdown, row, table, metric, menu, or icon-button patterns belong in the shared component system.
8. **No page-local geometry overrides.** Page CSS may arrange controls, but must not redefine button/control height, border width, radius, normal divider, or base type scale.

## 2. Source of truth in code

### Shared tokens / compatibility layer

`src/app/admin-foundation.css`

This file owns:

- `--ui-font-family`
- color tokens
- `--ui-line-width` and the 1px line/divider system
- typography scale
- control height and radius
- surface radius/padding
- shared button variants
- input/select/textarea geometry
- shared list/data-row/table geometry
- selected-state treatment
- compatibility aliases for existing `.btn`, `.card`, `.aui-*`, `--line`, `--soft`, etc.

It is imported **last** from `src/app/layout.tsx`. Older page CSS may control layout or domain-specific state colors, but the foundation layer owns shared geometry and typography.

### Shared React primitives

`src/components/admin/AdminUI.tsx`

Use these instead of inventing page-specific equivalents:

**Navigation and actions**
- `AdminButton`
- `AdminLinkButton`
- `AdminIconButton`
- `AdminActions`
- `AdminToolbar`

**Page and surface structure**
- `AdminPageHeader`
- `AdminSectionHeader`
- `AdminPanelHeader`
- `AdminSurface`
- `AdminSplitView`
- `AdminDivider`

**Form controls**
- `AdminInput`
- `AdminSelect`
- `AdminTextarea`
- `AdminField`

**Lists, menus, state and records**
- `StatusBadge`
- `AdminListItem`
- `AdminMenuItem`
- `AdminActionRow`
- `AdminDataList`
- `AdminDataRow`

**Metrics and tables**
- `AdminMetricStrip`
- `AdminMetric`
- `AdminTable`
- `AdminTableRow`
- `AdminTableCell`
- `SegmentedControl`

Legacy raw `.btn` and standard inputs remain supported by the compatibility layer for old code, but **new researcher UI must not introduce new raw equivalents** when a shared primitive exists.

## 3. Generic vs specialized component boundary

A component is **generic** when the same interaction can appear in more than one work area. It must live in `AdminUI.tsx` or another shared admin module.

Examples:

- button / link button / icon button
- input / textarea / dropdown
- page or section header
- status badge
- selectable list row
- menu row
- data/history row
- metric strip
- table shell

A component may remain **specialized** when its visual structure is inseparable from unique domain behavior.

Allowed examples:

- schedule session selector
- schedule timetable cell
- availability blackout cell
- email message bubble

Specialized components still consume the shared font, line, spacing, radius and semantic-state tokens. “Specialized” is not permission to create a second button/input/table design system.

## 4. Typography scale

Use only these base roles unless a specific data visualization genuinely needs another size.

- Page title: **26px / 750**
- Section title: **17px / 700**
- Panel/entity title: **16px / 700**
- Body/value: **14px / 400–650**
- Form label: **13px / 650**
- Metadata/helper/status: **12px / 400–650**
- Kicker/index only: **11px / 800**

Default family is `--ui-font-family` from `admin-foundation.css`.

Do not create routine 10px metadata. If information is too unimportant for 12px metadata, remove it or reveal it only when needed.

## 5. Lines, borders, radii

Shared structural line:

- thickness: **1px** via `--ui-line-width`
- normal color: `--ui-line`
- stronger interactive border: `--ui-line-strong`

Rules:

- horizontal and vertical dividers use the same 1px system
- table/timetable/blackout internal grid lines use the same system
- do not mix 1px/2px/3px borders for ordinary hierarchy
- 2px+ outlines are reserved for explicit focus/temporary selection states only

Radii:

- major surface: **11px**
- controls/buttons: **8px**
- status pills: fully rounded
- timetable internal cells: **0 radius**; only the outer container is rounded

## 6. Surfaces

A major surface is a real work area: participant list, editor, conversation, timetable, dashboard group.

Shared surface:

- white background
- 1px `--ui-line`
- 11px radius
- no decorative shadow
- 18px default padding

Avoid:

- card inside card inside card
- one bordered rectangle per metric/value
- one box per option/date when a divider row or quiet action is enough
- colored edge strips used as state decoration
- separate status box plus status pill plus helper text saying the same thing

Within a surface, prefer:

- whitespace
- `AdminDivider`
- `AdminDataRow`
- `AdminActionRow`
- typography hierarchy

## 7. Buttons

Researcher buttons use shared variants:

- `primary`: next/commit action
- `secondary`: useful alternative
- `ghost`: low-priority bordered navigation/utility
- `danger`: destructive action
- `text`: quiet inline action that should not become another rectangle

`AdminIconButton` is for compact icon-only utility controls such as previous/next or drag/remove actions.

Shared geometry:

- normal height: **36px**
- small height: **32px**
- font: **13px** normal / **12px** small
- radius: **8px**
- no wrapping

Do not create a page-specific button color/height/padding because a page feels “special.”

## 8. Form controls

Text, date, time, number, select, and textarea controls use one shared geometry:

- minimum single-line height: **38px**
- font: **14px**
- border: **1px `--ui-line-strong`**
- radius: **8px**
- padding: **9px 10px**
- textarea min height: **88px**

Use `AdminField` for label + control + at most one useful hint/error.

Do not stack several helper sentences below a normal input. Keep only information required to complete the task correctly.

## 9. Lists, rows, menus, and tables

Equivalent objects use the same row language across pages.

### Selection list

Use `AdminListItem` for participant/question/entity navigation.

Selected state:

- subtle full-row background
- 1px inset/outline using shared line color
- never a left-only rail

### Menu/action row

Use `AdminMenuItem` for compact choice menus and `AdminActionRow` for clickable record/agenda rows. Do not build a custom rounded box for every action.

### Data rows

Use `AdminDataList` + `AdminDataRow` for compact records such as schedule context, history, or key operational rows.

Rows are separated by the shared 1px divider, not independent cards.

### Tables

Use `AdminTable` primitives for tabular operational data when column alignment matters.

- header/body use the same 1px divider system
- no individual-cell cards
- horizontal scroll when necessary
- do not shrink columns until labels wrap into unreadable stacks

## 10. Schedule/timetable

Schedule grids are a specialized table, not a collection of cards.

- shared 1px grid line
- radius only on outer scroll container
- cell radius 0
- state shown with restrained full-cell background
- meaningful labels use the shared 12px+ type scale
- continuation cells should be quiet
- search/filter/date navigation/confirmation buttons use shared admin primitives

Do not use a colored left stripe to identify a schedule state.

## 11. Per-page implementation state

### Home

- page header/actions: shared
- metric strip: shared; one surface with dividers rather than four metric cards
- study status/buttons: shared
- per-study operational counts: quiet text actions rather than small boxes
- study list: one parent surface with standard 1px divider rows rather than one rounded card per study
- upcoming agenda: `AdminActionRow`

### 신청서

- basic inputs/selects/textareas/actions: shared
- question menu: `AdminMenuItem`
- choice input/remove/drag controls: shared
- settings sections separated by spacing/dividers rather than multiple cards
- date selections are quiet text actions instead of pill boxes
- redundant date-count microcopy is not shown
- blackout cells remain specialized because drag-paint behavior is domain-specific

### 신청자

- shared two-pane layout
- participant list uses `AdminListItem`
- detail/history uses shared data-row language

### 일정

- search/filter/actions/date navigation use shared controls
- participant list uses the same list treatment as 신청자/연락
- session selector is one divider-row list inside a surface, not a nested mini-card grid
- timetable uses the shared line/type system
- routine cell/legend metadata is 12px
- change/coordination/blocking context uses inline divider-separated messaging instead of another rounded card
- confirmation uses shared buttons with one clear primary action

### 연락

- participant/inquiry list uses the shared list treatment
- conversation is one main surface
- composer inputs/actions are shared
- inline schedule context uses data rows/dividers, not another card
- automatic schedule-message labeling is quiet metadata, not another pill
- email message bubbles remain specialized

## 12. Build-time mutation constraint

`ResearchHome.tsx` now owns the stop-before-delete lifecycle directly, and `FormBuilderUnified.tsx` owns its publish-save callback directly. `scripts/prebuild-ui-copy.mjs` no longer patches those two component behaviors.

The remaining build-time mutation is the legacy top-level `page.tsx` / `StudyWorkspace` compatibility layer plus the schedule date-window safety rewrite. Removing that remaining mutation is still desirable technical debt.

## 13. CSS ownership rule

Page-specific CSS may define:

- grid/flex layout
- column widths
- scrolling
- task-specific state backgrounds
- specialized timetable/blackout positioning

Page-specific CSS must **not** redefine:

- base font family
- base button height/font/radius/border
- base input/select/textarea height/font/radius/border
- normal horizontal/vertical divider thickness/color
- shared surface border/radius/shadow
- shared page/section/body/meta font sizes

If a new requirement cannot be expressed with the shared primitives/tokens, update the design system first rather than adding an isolated one-off style.

## 14. Responsive behavior

- below 900px, two-pane layouts become one column
- action rows may horizontally scroll instead of wrapping labels
- tables/timetables retain a useful minimum width and scroll
- no control text should wrap into multiple lines because the viewport is narrow

## 15. CSS cascade ownership

`admin-foundation.css` is not merely a last-loaded patch layer. It is the **sole structural owner** of generic authenticated-researcher UI styling.

The following files may contain page/domain layout and state styling, but must not re-implement generic component geometry or typography:

- `admin-unified.css`
- `workspace.css`
- `ops-enhancements.css`
- `schedule-planner.css`
- `form-controls.css`
- `availability-editor.css`

Rules:

- do not add high-specificity descendant selectors such as `.page input` or `.tool select` to change shared control padding/font/height
- do not redefine `.aui-page-*`, `.aui-surface`, `.aui-list-item`, `.aui-status`, `.aui-field`, `.aui-button`, or `.aui-control` outside the foundation/shared component layer
- specialized schedule/blackout/message selectors may define task-specific layout and state backgrounds, but line thickness and meaningful text scale still come from shared tokens
- a stale stylesheet must be removed from the runtime import graph rather than relying on a later override to neutralize it

As of CHANGE-20260817-018, `ui-polish.css` is no longer imported by `layout.tsx`; its legacy Contact/tiny-text rules do not participate in runtime CSS.
