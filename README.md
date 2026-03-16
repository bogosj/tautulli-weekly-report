# tautulli-weekly-report

Generate and send weekly Plex viewing reports via Tautulli's notification agents.

## Prerequisites

- **Node.js 20+**
- A running [Tautulli](https://tautulli.com/) instance with at least one notification agent configured
- Your Tautulli API key (Settings → Web Interface → API Key)

## Installation

```bash
git clone https://github.com/bogosj/tautulli-weekly-report.git
cd tautulli-weekly-report
npm install
npm link   # makes the CLI available globally
```

## Setup

Run the interactive setup wizard to configure your API key, Tautulli URL, and notification agent:

```bash
tautulli-weekly-report setup
```

You'll be prompted for:

1. **API Key** — your Tautulli API key
2. **Base URL** — the Tautulli server address (e.g. `http://192.168.1.100:8181`)
3. **Notification Agent** — pick from the list of agents configured in Tautulli

Configuration is saved to `~/.tautulli-weekly-report/config.json`.

## Usage

### Generate and send a report

```bash
tautulli-weekly-report report
```

### Preview without sending

```bash
tautulli-weekly-report report --dry-run
```

### Custom date range

```bash
tautulli-weekly-report report --days 14
```

### View current configuration

```bash
tautulli-weekly-report config
```

## Docker

### Build locally

```bash
docker build -t tautulli-weekly-report .
```

### Run with a config file

The container expects configuration at `/config`. Mount your local config directory there:

```bash
# Setup (interactive — writes config.json into mounted dir)
docker run -it -v ~/.tautulli-weekly-report:/config \
  tautulli-weekly-report setup

# Generate and send report
docker run -v ~/.tautulli-weekly-report:/config \
  tautulli-weekly-report report
```

### Run with environment variables

You can skip the config file entirely and pass everything via env vars:

```bash
docker run \
  -e TAUTULLI_API_KEY=your_api_key \
  -e TAUTULLI_BASE_URL=http://192.168.1.100:8181 \
  -e TAUTULLI_NOTIFIER_ID=1 \
  tautulli-weekly-report report
```

Env vars take precedence over values in the config file.

### GitHub Container Registry

The image is built via a manually-triggered GitHub Actions workflow. Trigger it from the Actions tab to push to `ghcr.io/bogosj/tautulli-weekly-report:latest`.

## Report Example

```
📺 Plex Weekly Report (Mar 9 – Mar 16, 2026)
══════════════════════════════════════════════════

👤 Jon Snow
   Movies: 3  |  Episodes: 12
   ────────────────────────────────────────
   🎬 Movies:
      • The Matrix (1999) (2hr 16min)
      • Inception (2010) (2hr 28min)
      • Interstellar (2014) (2hr 49min)
   📺 TV Shows:
      • Game of Thrones (S06 — 8 episodes, S07 — 4 episodes)
   ⏱ Total Watch Time: 18hr 42min

══════════════════════════════════════════════════
📊 Server Totals: 3 movies, 12 episodes
⏱  Total Server Watch Time: 18hr 42min
```