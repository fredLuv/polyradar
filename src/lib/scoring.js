function toNumber(value, fallback = 0) {
  if (value == null || value === '') return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function extractTokenId(market) {
  const seen = new Set();
  const push = (value) => {
    if (value == null) return;
    const str = String(value).trim();
    if (!str || seen.has(str)) return;
    seen.add(str);
  };

  const addTokenList = (value) => {
    if (Array.isArray(value)) {
      value.forEach(push);
      return;
    }
    if (typeof value !== 'string') return;

    const trimmed = value.trim();
    if (!trimmed) return;

    try {
      if (trimmed.startsWith('[')) {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          parsed.forEach(push);
          return;
        }
      }
    } catch {
      // Fall through to comma-split parsing.
    }

    trimmed.split(',').forEach(push);
  };

  addTokenList(market.clob_token_ids);
  addTokenList(market.clobTokenIds);

  if (Array.isArray(market.tokens)) {
    market.tokens.forEach((token) => {
      if (!token || typeof token !== 'object') return;
      push(token.token_id);
      push(token.tokenId);
      push(token.clob_token_id);
      push(token.clobTokenId);
      push(token.id);
    });
  }

  push(market.token_id);
  push(market.tokenId);

  return Array.from(seen)[0] || null;
}

export function normalizeMarket(raw) {
  const tokenId = extractTokenId(raw);
  const volume = toNumber(
    raw.volume_num ?? raw.volumeNum ?? raw.volume ?? raw.event_volume ?? raw.eventVolume
  );
  const liquidity = toNumber(raw.liquidity_num ?? raw.liquidityNum ?? raw.liquidity ?? raw.depth);

  return {
    id: String(raw.id ?? raw.market_id ?? raw.slug ?? tokenId ?? 'unknown'),
    slug: String(raw.slug ?? raw.id ?? ''),
    question: String(raw.question ?? raw.title ?? raw.market_question ?? raw.slug ?? 'Untitled market'),
    active: Boolean(raw.active ?? !raw.closed),
    closed: Boolean(raw.closed ?? false),
    endDate: raw.end_date ?? raw.endDate ?? null,
    conditionId: raw.condition_id ?? raw.conditionId ?? null,
    tokenId,
    volume,
    liquidity,
    raw
  };
}

export function scoreMarket(market, depth = {}) {
  const spread = toNumber(depth.spread, null);
  const midpoint = toNumber(depth.midpoint, null);

  const liquidityScore = Math.log10(market.liquidity + 1) * 17;
  const volumeScore = Math.log10(market.volume + 1) * 14;
  const activityScore = market.active ? 14 : -35;
  const spreadPenalty = spread == null ? 0 : Math.min(25, spread * 100 * 1.6);
  const midStabilityBonus = midpoint == null ? 0 : 8 - Math.abs(midpoint - 0.5) * 10;

  const score = liquidityScore + volumeScore + activityScore + midStabilityBonus - spreadPenalty;

  return {
    score: Number(score.toFixed(2)),
    spread,
    midpoint
  };
}

export function sortByScore(rows) {
  return [...rows].sort((a, b) => b.score - a.score);
}

export function sortMarkets(rows, { sortBy = 'score', order = 'desc' } = {}) {
  const direction = order === 'asc' ? 1 : -1;
  const key = ['score', 'liquidity', 'volume', 'spread', 'midpoint'].includes(sortBy)
    ? sortBy
    : 'score';

  const valueOf = (row) => {
    const raw = row?.[key];
    if (raw == null) return Number.NEGATIVE_INFINITY;
    const num = Number(raw);
    return Number.isFinite(num) ? num : Number.NEGATIVE_INFINITY;
  };

  return [...rows].sort((a, b) => (valueOf(a) - valueOf(b)) * direction);
}
