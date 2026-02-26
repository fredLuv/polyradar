# PolyRadar

PolyRadar is a local scanner + execution copilot built on top of the official `polymarket` CLI.

It is designed for fast market triage:

- pulls markets from `polymarket markets list/search`
- enriches top rows with CLOB midpoint/spread
- ranks opportunities with a transparent score
- generates copy-ready market order commands
- keeps execution off by default (`ENABLE_TRADING=false`)

## Why this is useful

Polymarket has many active markets, but raw lists are noisy. PolyRadar gives you one screen with:

- liquidity + volume context
- spread quality (microstructure)
- token IDs ready for execution flow
- lightweight risk checks before sending orders

## Features

- Real-time scan endpoint: `GET /api/scan`
- Rank score formula: liquidity + volume + spread penalty + active-market bias
- Trade simulation endpoint: `POST /api/trade/simulate`
- Optional real execution endpoint: `POST /api/trade/execute`
- Mock fallback mode when `polymarket` binary is unavailable

## Stack

- Node.js + Express backend
- Vanilla JS frontend
- `polymarket` CLI adapter layer

## Setup

```bash
cd /Users/fred/GPT-CODE/polyradar
cp .env.example .env
npm install
```

Install the Polymarket CLI separately (if not already installed):

- Repo: [https://github.com/Polymarket/polymarket-cli](https://github.com/Polymarket/polymarket-cli)

## Configuration

`.env` options:

- `PORT`: server port (`8790` default)
- `POLYMARKET_BIN`: binary name/path (`polymarket` default)
- `ENABLE_TRADING`: `false` by default (recommended)
- `POLYRADAR_MOCK_IF_UNAVAILABLE`: fallback to mock data when CLI missing
- `POLYRADAR_DEFAULT_LIMIT`: default market scan size
- `POLYRADAR_MAX_ENRICH`: max markets to enrich with midpoint/spread calls per scan

## Run

```bash
npm start
```

Open:

- `http://127.0.0.1:8790`

## Live screenshot

Polymarket-style themed UI after typing `bitcoin` in Search and running `Run Scan`:

![PolyRadar themed bitcoin scan](docs/polyradar-theme-bitcoin.png)

## API

- `GET /api/health`
- `GET /api/config`
- `GET /api/scan?search=bitcoin&limit=20&enrich=true`
- `POST /api/trade/simulate`
- `POST /api/trade/execute` (requires `ENABLE_TRADING=true`)

Example simulate request:

```bash
curl -s -X POST http://127.0.0.1:8790/api/trade/simulate \
  -H 'content-type: application/json' \
  -d '{"token":"48331043336612883...","side":"buy","amount":5}'
```

## Safety model

- Execution is disabled by default.
- Simulate first, then manually review command/token/side/amount.
- Use small notional test trades before scaling.

## Next upgrades

- Add watchlists + alerts (Discord/Telegram)
- Add portfolio import (`polymarket data positions/value/trades`)
- Add reward-aware maker mode (`clob current-rewards`, `order-scoring`)
