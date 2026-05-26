# Dashboard / CLI — UI kit

The product surface a developer sees after `zenship init`. Dark by default (it's a tool). Asymmetric layout, no sidebar tree, no widget grid. The CLI is the primary interface; this dashboard is the secondary view.

## Files

- `index.html` — entry, interactive prototype
- `app.jsx` — wires the screens, fake state, fake auth
- `Shell.jsx` — top bar + side rail
- `ProjectList.jsx` — list of deployed projects
- `DeployDetail.jsx` — one project's deploys + logs
- `LogStream.jsx` — tailing logs panel
- `Composer.jsx` — modal terminal: type a command, see fake response
- `dashboard.css` — styles

## Interactions

- Click a project → see its deploys + tail logs
- Hit `⌘K` → opens a terminal composer (fake commands: `zenship send`, `zenship rollback`, `zenship tail`, `zenship ls`)
- The accent is cyan here (not pink). Different product surface, different mode.

## Source of truth

No source codebase or Figma. Visual + interaction patterns derive from `colors_and_type.css` and the brief.
