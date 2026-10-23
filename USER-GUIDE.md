# CliffWatch User Guide

CliffWatch runs locally on your computer. It reads quota data from tools you already use, stores history in a local SQLite file, and shows the result at `http://127.0.0.1:3000`.

## Try the project from this source folder

Open PowerShell in the project folder:

```powershell
cd "C:\Users\DELL\Documents\Codex\2026-10-21\start\outputs\quotadog"
npm ci
npm run build:dashboard
```

Check the current quota once:

```powershell
npm exec --workspace=cliffwatch -- cliffwatch status
```

Start continuous monitoring in the first PowerShell window:

```powershell
npm exec --workspace=cliffwatch -- cliffwatch daemon
```

Keep that window open. In a second PowerShell window, start the dashboard:

```powershell
cd "C:\Users\DELL\Documents\Codex\2026-10-21\start\outputs\quotadog"
npm exec --workspace=cliffwatch -- cliffwatch dashboard
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Press `Ctrl+C` in either terminal to stop its process.

## What you need

- Node.js 20 or newer. Building this repository needs Node.js 22.13 or newer.
- Codex CLI installed and signed in. CliffWatch uses that existing local session; it does not ask for your password.
- OpenRouter is optional and disabled by default.

## Configuration

Your config file is `C:\Users\DELL\.cliffwatch\config.yaml` on this Windows account. Start with:

```yaml
intervalSeconds: 300
dashboardPort: 3000
thresholds: [70, 85, 95]
providers:
  codex:
    enabled: true
    source: live
    command: codex
  openrouter:
    enabled: false
channels:
  - type: desktop
```

To monitor OpenRouter too, set `enabled: true` and provide the key to the same terminal before starting the daemon:

```powershell
$env:OPENROUTER_API_KEY = "your-key"
```

Keep secret values out of the YAML file. CliffWatch stores history at `C:\Users\DELL\.cliffwatch\cliffwatch.sqlite` by default.

## Use the dashboard

- **Overview** shows remaining quota, reset time, pace and projected exhaustion.
- **History** shows the last seven days recorded by the daemon.
- **Settings** shows active providers, thresholds and alert channels without exposing secret values.
- **Test alert** sends a real notification through the first configured channel.

`UNKNOWN` means CliffWatch does not have enough trustworthy data. It does not replace missing data with an invented percentage. If the cards are empty after setup, run `cliffwatch status` in the terminal first; the error message will identify a missing login, command or configuration.
