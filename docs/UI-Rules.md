# UI Rules

Use this document as the shared reference for button and interactive-control styling across the app.

## Purpose

When you update a button, nav item, icon-only control, or similar interactive element, follow this pattern so the UI feels consistent from page to page.

## Core Interaction Pattern

### 1. Default state
- Use a neutral, theme-aware background and border.
- Keep spacing, border radius, and dimensions consistent with the surrounding controls.
- Prefer shared theme variables over hardcoded values.
- Use these variables when applicable:
  - `--app-surface` for the base surface
  - `--app-control` for neutral button backgrounds
  - `--app-border` for borders
  - `--app-text` for text color
  - `--app-muted` for secondary or subdued text

### 2. Hover state
- Use a subtle background shift rather than a dramatic visual change.
- Keep the interaction lightweight and polished.
- Use these variables when applicable:
  - `--app-surface-muted` for hover backgrounds
  - `--app-accent` for hover emphasis on selected or primary actions

### 3. Focus-visible state
- Provide a visible keyboard focus outline.
- Use the accent color and keep the outline clear and accessible.
- Use these variables when applicable:
  - `--app-accent` for the focus ring color
  - `--app-on-accent` when the focus treatment needs to contrast with an accented surface

### 4. Active / pressed state
- Use a stronger visual cue when the control is active or pressed.
- A subtle border color change, inset shadow, or accent treatment is preferred.
- Use these variables when applicable:
  - `--app-accent` for active border or indicator color
  - `--app-control-strong` for pressed background depth
  - `--app-surface-muted` for active but non-accented states

### 5. Disabled state
- Reduce opacity and change the cursor to signal that the control is unavailable.
- Do not leave disabled controls looking like they are still fully interactive.
- Use these variables when applicable:
  - `--app-muted` for disabled text
  - `--app-border` for disabled borders
  - reduced opacity rather than a new color treatment

### 6. Search input clear affordance
- Any search or filter input that accepts text should include a clear button when it contains a value.
- The clear control should be inline, keyboard accessible, and use the same hover/focus/active treatment as other interactive controls.
- Provide an accessible label and title (for example, `Clear search`) and ensure activating it clears the current input state and any related filters.
- Keep the control hidden when the field is empty to avoid clutter.

## Styling Guidance

- Favor shared CSS classes and variables over one-off inline styles.
- Keep transitions short and subtle.
- Use the same interaction vocabulary for toolbar buttons, sidebar actions, and page-level actions.
- For destructive actions, use a stronger warning treatment such as `--app-danger`.
- For primary or selected actions, use `--app-accent` consistently.
- If a component needs a custom variant, define it through a shared class or CSS custom property rather than hardcoding a one-off color.

## Current Reference Examples

The patterns below are already reflected in the existing layout styles:
- [src/components/layout/titlebar.css](src/components/layout/titlebar.css)
- [src/components/layout/layout.css](src/components/layout/layout.css)

## Working Rule

When editing a view, page, or component, check whether the control should follow this shared pattern before introducing a new style. If a new interaction pattern is needed, prefer extending the shared approach rather than creating a one-off treatment.
