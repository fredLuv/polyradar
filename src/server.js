import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import 'dotenv/config';
import { PolymarketClient } from './lib/polymarketClient.js';
import { normalizeMarket, scoreMarket, sortMarkets } from './lib/scoring.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDir = path.resolve(__dirname, '../web');

const port = Number(process.env.PORT || 8790);
const defaultLimit = Number(process.env.POLYRADAR_DEFAULT_LIMIT || 20);
const maxEnrich = Number(process.env.POLYRADAR_MAX_ENRICH || 8);
const tradingEnabled = String(process.env.ENABLE_TRADING || 'false').toLowerCase() === 'true';

const client = new PolymarketClient({
  binary: process.env.POLYMARKET_BIN || 'polymarket',
  mockIfUnavailable:
    String(process.env.POLYRADAR_MOCK_IF_UNAVAILABLE || 'true').toLowerCase() === 'true'
});

const app = express();
app.use(express.json());
app.use(express.static(webDir));

function asInt(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.floor(num);
}

function asNum(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseOutcomePrices(value) {
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((v) => asNum(v)).filter((v) => v != null) : [];
  } catch {
    return [];
  }
}

function fallbackDepthFromMarket(market) {
  const raw = market.raw || {};
  const spread = asNum(raw.spread);
  const bestBid = asNum(raw.bestBid);
  const bestAsk = asNum(raw.bestAsk);
  const lastTrade = asNum(raw.lastTradePrice);
  const outcomes = parseOutcomePrices(raw.outcomePrices);

  let midpoint = null;
  if (bestBid != null && bestAsk != null && bestBid >= 0 && bestAsk >= 0) {
    midpoint = (bestBid + bestAsk) / 2;
  } else if (lastTrade != null) {
    midpoint = lastTrade;
  } else if (outcomes.length > 0) {
    midpoint = outcomes[0];
  }

  if (midpoint == null && spread == null) {
    return { midpoint: null, spread: null, source: 'none' };
  }

  return { midpoint, spread, source: 'market' };
}

async function buildScan({ search, limit, enrich, sortBy, order }) {
  const { source, markets } = await client.listMarketsWithFallback({ limit, search });
  const normalized = markets
    .map(normalizeMarket)
    .filter((market) => market.active && !market.closed);

  const enriched = [];
  for (let i = 0; i < normalized.length; i += 1) {
    const market = normalized[i];
    let depth = { midpoint: null, spread: null, source: 'none' };

    if (enrich && i < maxEnrich && market.tokenId) {
      depth = await client.depthWithFallback(market.tokenId);
    }

    if (depth.midpoint == null && depth.spread == null) {
      depth = fallbackDepthFromMarket(market);
    } else if (depth.midpoint == null || depth.spread == null) {
      const fallback = fallbackDepthFromMarket(market);
      depth = {
        midpoint: depth.midpoint ?? fallback.midpoint,
        spread: depth.spread ?? fallback.spread,
        source: depth.source === 'live' ? 'live' : fallback.source
      };
    }

    const metrics = scoreMarket(market, depth);
    enriched.push({
      ...market,
      ...metrics,
      depthSource: depth.source,
      marketUrl: market.slug ? `https://polymarket.com/market/${market.slug}` : null
    });
  }

  return {
    source,
    generatedAt: new Date().toISOString(),
    sortBy,
    order,
    markets: sortMarkets(enriched, { sortBy, order }).slice(0, limit)
  };
}

app.get('/api/health', async (_, res) => {
  try {
    await client.runJson(['markets', 'list', '--limit', '1']);
    res.json({ ok: true, cli: 'live' });
  } catch (error) {
    if (error.code === 'CLI_UNAVAILABLE') {
      res.json({ ok: true, cli: 'unavailable', mockIfUnavailable: client.mockIfUnavailable });
      return;
    }
    res.status(500).json({ ok: false, error: error.message, code: error.code || 'UNKNOWN' });
  }
});

app.get('/api/config', (_, res) => {
  res.json({
    tradingEnabled,
    defaultLimit,
    maxEnrich,
    binary: client.binary,
    mockIfUnavailable: client.mockIfUnavailable
  });
});

app.get('/api/scan', async (req, res) => {
  const search = String(req.query.search || '').trim();
  const limit = Math.min(asInt(req.query.limit, defaultLimit), 100);
  const enrich = String(req.query.enrich || 'true').toLowerCase() !== 'false';
  const sortBy = String(req.query.sort_by || 'liquidity').trim().toLowerCase();
  const order = String(req.query.order || 'desc').trim().toLowerCase() === 'asc' ? 'asc' : 'desc';

  try {
    const result = await buildScan({ search, limit, enrich, sortBy, order });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      code: error.code || 'SCAN_FAILED'
    });
  }
});

app.post('/api/trade/simulate', (req, res) => {
  const token = String(req.body?.token || '').trim();
  const side = String(req.body?.side || '').trim().toLowerCase();
  const amount = Number(req.body?.amount);

  if (!token) return res.status(400).json({ error: 'token is required' });
  if (!['buy', 'sell'].includes(side)) return res.status(400).json({ error: 'side must be buy or sell' });
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'amount must be > 0' });

  const command = client.buildMarketOrderCommand({ token, side, amount });
  res.json({
    command,
    commandText: command.join(' '),
    riskChecks: [
      'Confirm token ID matches desired market outcome.',
      'Check current spread and midpoint before submitting.',
      'Use small amount first to validate fill behavior.'
    ]
  });
});

app.post('/api/trade/execute', async (req, res) => {
  if (!tradingEnabled) {
    return res.status(403).json({
      error: 'Trading is disabled. Set ENABLE_TRADING=true to enable execution.'
    });
  }

  const token = String(req.body?.token || '').trim();
  const side = String(req.body?.side || '').trim().toLowerCase();
  const amount = Number(req.body?.amount);

  if (!token) return res.status(400).json({ error: 'token is required' });
  if (!['buy', 'sell'].includes(side)) return res.status(400).json({ error: 'side must be buy or sell' });
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'amount must be > 0' });

  try {
    const result = await client.marketOrder({ token, side, amount });
    res.json({ ok: true, result });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message, code: error.code || 'EXEC_FAILED' });
  }
});

app.listen(port, '127.0.0.1', () => {
  console.log(`[polyradar] running at http://127.0.0.1:${port}`);
});
