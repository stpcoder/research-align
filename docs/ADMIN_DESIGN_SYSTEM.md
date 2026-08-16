# StudyForm Admin UI Design System

This document is the source of truth for the authenticated admin UI (`신청서`, `신청자`, `일정`, `연락`). New components should reuse these rules rather than introducing page-specific visual language.

## 1. Core principles

1. **One visual language across every admin page.** Same page header, surface, spacing, typography, input, button, status, and list patterns.
2. **Hierarchy before decoration.** Do not add a rectangle simply to separate content. Use spacing, typography, and one parent surface first.
3. **One primary action per work area.** Secondary/destructive actions must not compete visually.
4. **Status is semantic, not ornamental.** Never indicate state with only a colored left edge. Use full subtle background + readable label/pill.
5. **No accidental wrapping.** Action labels stay on one line. Dense tables scroll horizontally rather than crushing controls into 2–3 lines.
6. **Admin workflow first.** Screens should always answer: what is selected, what state is it in, and what should I do next?

## 2. Layout

- App content max width: **1180px**.
- Page horizontal padding: **24px desktop / 14px tablet / 12px mobile**.
- Page section spacing: **24px**.
- Card/surface padding: **20px**.
- Major two-pane gap: **16–20px**.
- Avoid nested cards. A child inside a card should normally use spacing/divider, not another bordered card.

### Page header pattern

Every admin work page uses:

- Kicker/context: 11px / 800 / uppercase or short contextual label.
- Page title: **26px / 750 / line-height 1.2**.
- Description: **14px / normal / muted**.
- Primary action aligned right when present.

## 3. Typography scale

- Page title: **26px / 750**.
- Section title: **18px / 700**.
- Panel title / selected entity name: **17px / 700**.
- Question/input primary value: **16px / 650**.
- Body: **14px / 400–500**.
- Form label: **13px / 650**.
- Metadata/helper: **12px / 400–500**.
- Kicker/index (`문항 1`, `FORM`, `SCHEDULE`): **11px / 750–800**.

Do not let `문항 1`, field type, field label, and field input all have the same visual weight.

## 4. Surfaces

### Primary surface (`.card` / `.admin-surface`)

- Background: white.
- Border: `1px solid #e5e5df`.
- Radius: **12–14px**.
- Shadow: at most `0 1px 2px rgba(0,0,0,.025)`.

Use for meaningful work areas: participant list, editor, conversation, timetable container.

### Do not

- Put each option/button in a large bordered rectangle unless it behaves like a selectable item.
- Nest 3+ bordered rectangles.
- Use a colored left edge as the only state signal.
- Mix borderless and card layouts for equivalent list panels on different pages.

## 5. Inputs

All text/select/date/time controls:

- Font size: **14px**.
- Height: **40px minimum**.
- Padding: **10px 11px**.
- Border: `1px solid #d8d8d2`.
- Radius: **8–9px**.
- Background: white.

Large semantic inputs (experiment name, question text): **16px / 650**.

Textarea minimum height: **88px**.

### Application link / slug

- The slug is customizable.
- Full preview must be shown as `/s/{slug}` or the absolute application URL.
- Allowed characters: lower/upper Latin letters, digits, `-`, `_` (the UI normalizes invalid characters to `-`).
- `studies.slug` is globally unique in the database.
- UI should check availability before/while saving and show `사용 가능` / `이미 사용 중`.

## 6. Buttons

- Primary: dark fill, white text.
- Secondary: neutral soft fill.
- Ghost: no fill, used for low-priority actions.
- Destructive: red text or very light red fill only.
- Labels never wrap (`white-space: nowrap`).
- Prefer one primary CTA in a panel.

## 7. Status system

Fixed admin status vocabulary:

- **미배정**: neutral gray.
- **미확정**: amber/orange.
- **확정**: green.
- **완료**: blue/neutral as needed.
- **오류/차단**: red.

A status component must include readable text. Status backgrounds are full rounded surfaces/pills, never a lone colored edge.

## 8. 신청서 editor

- Top: `기본 정보` as a single surface.
- Main: two panes.
  - Left: question list + `+ 문항 추가`.
  - Right: only the selected question editor.
- Question list row hierarchy:
  - index: 11px,
  - question label: 14px/650,
  - type + required metadata: 12px muted.
- Do not display all question configuration panels expanded simultaneously.
- Availability editor is allowed to expand because its timetable is the task itself.

## 9. 신청자 page

- Always use a white two-pane work surface.
- Left: searchable participant list.
- Right: selected participant detail.
- The list and detail must visually match the `일정` and `연락` participant selectors.
- Export buttons live in the page header, not inside participant rows.

## 10. 일정 page

Two modes:

### 참가자별 배정

`participant → session → available cell → draft → confirm`.

The selected participant always has an action/status surface explaining the next step.

### 전체 배정

`session → unassigned queue → global timetable → draft queue → confirm all`.

The admin should be able to place several participants without changing pages.

### Timetable

- Timetable is a grid, but cells should not look like independent random cards.
- Thin shared grid lines, radius only on outer container.
- Cell state uses restrained full-cell background.
- Confirmed assignment uses green-tinted background; draft uses amber; selected available slot uses green-neutral; preference uses warm highlight; occupied by someone else uses neutral blue/gray.
- Each occupied block shows participant name at the start cell; continuation cells are visually continuous and quiet.

## 11. 연락 page

- Left participant list, right conversation.
- KeyID/technical identity status is secondary utility UI.
- Do not expose `thread`, provider IDs, or channel implementation language in primary UI.

## 12. Responsive behavior

- Below 900px: two-pane layouts become one column.
- Participant list may become a 2-column compact grid where useful.
- Timetables/tables retain minimum width and scroll horizontally.
- Never shrink action controls until text wraps into multiple lines.
