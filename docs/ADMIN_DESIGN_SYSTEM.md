# StudyForm Admin UI Design System

This document is the source of truth for the authenticated researcher UI: home, `신청서`, `신청자`, `일정`, and `연락`.

The goal is not to make every page look decorative. The goal is to make the same interaction mean and look the same everywhere.

## 1. Non-negotiable principles

1. **One visual language across every researcher page.**
   - same button variants
   - same input/select/textarea geometry
   - same surface border/radius
   - same divider thickness/color
   - same typography scale
   - same status badge vocabulary
   - same list selection treatment
2. **Hierarchy before decoration.** Use spacing, typography, and one parent surface before adding a box.
3. **No box accumulation.** A new piece of context does not justify a new card by itself. Avoid nested bordered rectangles.
4. **No microcopy accumulation.** If label, status, or value already explains the state, do not repeat it with another 10–11px helper line.
5. **No left-rail state language.** A colored left edge must never be the sole selected/status treatment. Use a subtle full-surface state plus text/badge where needed.
6. **One primary action per operational region.** Secondary/destructive actions must not compete with the next task.
7. **No page-local control styling.** Page CSS may arrange controls, but must not redefine button/control height, border width, radius, or base font size.

## 2. Source of truth in code

### Shared tokens / compatibility layer

`src/app/admin-foundation.css`

This file owns:

- color tokens
- line/divider color and 1px thickness
- typography scale
- control height and radius
- surface radius/padding
- shared button variants
- input/select/textarea geometry
- shared data-row/table geometry
- compatibility aliases for existing `.btn`, `.card`, `.aui-*`, `--line`, `--soft`, etc.

It is imported **last** from `src/app/layout.tsx`. Older page CSS may control layout, but the foundation layer wins for shared geometry and type.

### Shared React primitives

`src/components/admin/AdminUI.tsx`

Use these instead of inventing page-specific equivalents:

- `AdminPageHeader`
- `AdminPanelHeader`
- `AdminSurface`
- `AdminSplitView`
- `AdminButton`
- `AdminInput`
- `AdminSelect`
- `AdminTextarea`
- `AdminField`
- `AdminActions`
- `AdminToolbar`
- `AdminDivider`
- `StatusBadge`
- `AdminListItem`
- `AdminDataList`
- `AdminDataRow`
- `AdminTable`
- `AdminTableRow`
- `AdminTableCell`
- `SegmentedControl`

Existing raw `.btn` / standard inputs remain temporarily supported through the compatibility layer, but new researcher UI should use the primitives above.

## 3. Typography scale

Use only these base roles unless a specific data visualization genuinely needs another size.

- Page title: **26px / 750**
- Section title: **17px / 700**
- Panel/entity title: **16px / 700**
- Body/value: **14px / 400–650**
- Form label: **13px / 650**
- Metadata/helper/status: **12px / 400–650**
- Kicker/index only: **11px / 800**

Do not create routine 10px metadata. If information is too unimportant for 12px metadata, consider removing it.

## 4. Lines, borders, radii

Shared structural line:

- thickness: **1px**
- normal color: `--ui-line`
- stronger interactive border: `--ui-line-strong`

Rules:

- horizontal and vertical dividers use the same 1px system
- table/grid internal lines use the same system
- do not mix 1px/2px/3px borders for ordinary hierarchy
- 2px+ outlines are reserved for explicit focus/temporary selection states only

Radii:

- major surface: **11px**
- controls/buttons: **8px**
- status pills: fully rounded
- timetable internal cells: **0 radius**; only the outer container is rounded

## 5. Surfaces

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
- colored edge strips used as state decoration
- separate status box plus status pill plus helper text saying the same thing

Within a surface, prefer:

- whitespace
- `AdminDivider`
- `AdminDataRow`
- typography hierarchy

## 6. Buttons

All researcher buttons map to four variants:

- `primary`: next/commit action
- `secondary`: useful alternative
- `ghost`: low-priority navigation/utility
- `danger`: destructive action

Shared geometry:

- normal height: **36px**
- small height: **32px**
- font: **13px** normal / **12px** small
- radius: **8px**
- no wrapping

Do not create a page-specific button color/height/padding because a page feels “special.”

## 7. Form controls

Text, date, time, number, select, and textarea controls use one shared geometry:

- minimum single-line height: **38px**
- font: **14px**
- border: **1px `--ui-line-strong`**
- radius: **8px**
- padding: **9px 10px**
- textarea min height: **88px**

Use `AdminField` for label + control + optional one-line hint/error.

Do not stack several helper sentences below a normal input. Keep only information required to complete the task correctly.

## 8. Lists, rows, and tables

Equivalent objects should use the same row language across pages.

### Selection list

Use `AdminListItem` for participant/question/entity navigation.

Selected state:

- subtle full-row background
- 1px inset/outline using shared line color
- never a left-only rail

### Data rows

Use `AdminDataList` + `AdminDataRow` for compact records such as schedule context, recent state, or key/value operational rows.

Rows are separated by 1px shared dividers, not independent cards.

### Tables

Use `AdminTable` primitives for tabular operational data when column alignment matters.

- header/body use the same 1px divider system
- no individual-cell cards
- horizontal scroll when necessary
- do not shrink columns until labels wrap into unreadable stacks

## 9. Schedule/timetable

Schedule grids are a specialized table, not a collection of cards.

- shared 1px grid line
- radius only on outer scroll container
- cell radius 0
- state shown with restrained full-cell background
- text hierarchy remains 12px+ for meaningful labels
- continuation cells should be quiet

Do not use a colored left stripe to identify a schedule state.

## 10. Per-page guidance

### Home

- operational metrics are compact, not dashboard-card theater
- study actions use shared buttons
- upcoming schedule is row-based

### 신청서

- one `기본 정보` surface
- question index + selected editor
- settings sections separated by spacing/dividers rather than multiple cards
- helper copy only where validation/behavior is otherwise unclear

### 신청자

- shared two-pane layout
- participant list uses `AdminListItem`
- detail sections use dividers/data rows

### 일정

- participant list uses the same list treatment as 신청자/연락
- session selection uses the same shared selected-state tokens
- timetable uses the shared line/type system
- confirmation is one clear primary action

### 연락

- participant/inquiry list uses the shared list treatment
- conversation is one main surface
- inline schedule context uses rows/dividers, not another card
- provider identity remains secondary utility UI

## 11. CSS ownership rule

Page-specific CSS may define:

- grid/flex layout
- column widths
- scrolling
- task-specific state backgrounds
- specialized timetable positioning

Page-specific CSS must **not** redefine:

- base button height/font/radius/border
- base input/select/textarea height/font/radius/border
- normal divider thickness/color
- shared surface border/radius/shadow
- shared page/section/body/meta font sizes

If a new requirement cannot be expressed with the shared primitives/tokens, update the design system first rather than adding an isolated one-off style.

## 12. Responsive behavior

- below 900px, two-pane layouts become one column
- action rows may horizontally scroll instead of wrapping labels
- tables/timetables retain a useful minimum width and scroll
- no control text should wrap into multiple lines because the viewport is narrow
