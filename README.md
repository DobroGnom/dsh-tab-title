# dsh-tab-title

A browser-side plugin for [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness) that keeps the web GUI tab title predictable and shows unobtrusive background-tab alerts.

[Русская версия](README.ru.md)

## What it does

- Pins the idle browser tab title to `DeepSeek Harness`, even when the GUI changes it to the current chat title.
- Shows `✓ DeepSeek Harness` when an agent finishes a turn while the tab is in the background.
- Shows `❓ DeepSeek Harness` when an agent needs your answer, plan review, or approval while the tab is in the background.
- Clears the alert when you return to the tab or start a new turn.
- Supports both the alpha1 pending-interaction API and the alpha2 unified session-status API.

The plugin runs only in the browser. It does not add host-side behavior, collect data, or change conversations.

## Install

Install directly from GitHub:

```sh
dsh plugin add github:DobroGnom/dsh-tab-title
```

Then enable **dsh-tab-title** in **Settings → Plugins** and reload the web GUI if it is already open.

For a local checkout:

```sh
dsh plugin add /absolute/path/to/dsh-tab-title
```

## Development

```sh
pnpm install
pnpm test
pnpm build
```

The build produces `lib/client.js` and `lib/index.js`, the plugin artifacts loaded by DeepSeek Harness.

## License

MIT
