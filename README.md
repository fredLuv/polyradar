# PolyRadar

Local scanner + trade-prep UI built on top of [`polymarket-cli`](https://github.com/Polymarket/polymarket-cli).

![PolyRadar GTA scan (limit 12)](docs/polyradar-gta-limit12.png)

## Quick start

```bash
cd /Users/fred/GPT-CODE/polyradar
cp .env.example .env
npm install
npm start
```

Open: `http://127.0.0.1:8790`

## Free remote hosting (Render)

Use this one-click deploy:

[Deploy to Render](https://render.com/deploy?repo=https://github.com/fredLuv/polyradar)

Repo includes [`render.yaml`](render.yaml) with safe defaults:

- `HOST=0.0.0.0` for cloud binding
- `ENABLE_TRADING=false`
- `POLYRADAR_MOCK_IF_UNAVAILABLE=true`

Note: on free hosting, if `polymarket-cli` is not installed, the app stays online using mock fallback data.

## Why

Polymarket has many fast-moving markets. PolyRadar helps you:

- find high-activity markets quickly
- compare quality (volume/liquidity/spread) in one place
- move from discovery to safe trade prep without raw CLI juggling

## Functionalities

- scan and rank live Polymarket markets by liquidity/volume/score
- filter by keyword (example: `GTA`) and open market pages directly
- enrich with midpoint/spread where available, with graceful fallback
- prepare orders via simulate, risk checks, then optional execution

## Config

`.env`:

- `PORT` default `8790`
- `POLYMARKET_BIN` default `polymarket`
- `ENABLE_TRADING` default `false`
- `POLYRADAR_MOCK_IF_UNAVAILABLE` default `true`
- `POLYRADAR_DEFAULT_LIMIT` default `20`
- `POLYRADAR_MAX_ENRICH` default `8`

## API

- `GET /api/health`
- `GET /api/config`
- `GET /api/scan?search=bitcoin&limit=20&enrich=true`
- `POST /api/trade/simulate`
- `POST /api/trade/execute` (only when `ENABLE_TRADING=true`)

## Safety

Execution is off by default. Keep `ENABLE_TRADING=false` unless you explicitly want live orders.
