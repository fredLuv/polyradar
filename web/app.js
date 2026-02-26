const statusLine = document.getElementById('statusLine');
const resultsEl = document.getElementById('results');
const scanBtn = document.getElementById('scanBtn');
const searchEl = document.getElementById('search');
const limitEl = document.getElementById('limit');
const enrichEl = document.getElementById('enrich');
const cardTemplate = document.getElementById('cardTemplate');

let config = null;

function fmtMoney(num) {
  if (num == null || Number.isNaN(num)) return '-';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(num);
}

function fmtPct(num) {
  if (num == null || Number.isNaN(num)) return '-';
  return `${(num * 100).toFixed(2)}%`;
}

function toast(message) {
  statusLine.textContent = message;
}

async function loadConfig() {
  const res = await fetch('/api/config');
  config = await res.json();
}

async function simulateCommand(token, side, amount = 5) {
  const res = await fetch('/api/trade/simulate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, side, amount })
  });
  if (!res.ok) throw new Error('simulate failed');
  return res.json();
}

async function copyCommand(token, side) {
  try {
    const payload = await simulateCommand(token, side, 5);
    await navigator.clipboard.writeText(payload.commandText);
    toast(`Copied ${side.toUpperCase()} command`);
  } catch (error) {
    toast(`Could not copy command: ${error.message}`);
  }
}

function renderMarkets(markets) {
  resultsEl.innerHTML = '';

  if (!markets.length) {
    resultsEl.innerHTML = '<p>No markets found.</p>';
    return;
  }

  for (const market of markets) {
    const node = cardTemplate.content.cloneNode(true);
    const card = node.querySelector('.card');
    const score = node.querySelector('.score');
    const link = node.querySelector('.open');
    const question = node.querySelector('.question');
    const meta = node.querySelector('.meta');
    const buy = node.querySelector('.copy-buy');
    const sell = node.querySelector('.copy-sell');

    score.textContent = `Score ${market.score.toFixed(2)}`;
    question.textContent = market.question;

    if (market.marketUrl) {
      link.href = market.marketUrl;
    } else {
      link.removeAttribute('href');
      link.textContent = 'No URL';
    }

    meta.innerHTML = [
      `source=${market.depthSource} | confidence=${(market.confidence * 100).toFixed(0)}%`,
      `volume=$${fmtMoney(market.volume)} | liquidity=$${fmtMoney(market.liquidity)}`,
      `mid=${market.midpoint == null ? '-' : market.midpoint.toFixed(3)} | spread=${fmtPct(market.spread)}`,
      `token=${market.tokenId || '-'}`
    ].join('<br/>');

    if (!market.tokenId) {
      buy.disabled = true;
      sell.disabled = true;
      buy.textContent = 'No token';
      sell.textContent = 'No token';
    } else {
      buy.addEventListener('click', () => copyCommand(market.tokenId, 'buy'));
      sell.addEventListener('click', () => copyCommand(market.tokenId, 'sell'));
    }

    card.dataset.score = String(market.score);
    resultsEl.appendChild(node);
  }
}

async function runScan() {
  scanBtn.disabled = true;
  toast('Scanning markets...');

  const params = new URLSearchParams({
    search: searchEl.value.trim(),
    limit: String(limitEl.value || 20),
    enrich: enrichEl.checked ? 'true' : 'false'
  });

  try {
    const res = await fetch(`/api/scan?${params}`);
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.error || 'scan failed');
    }

    const trading = config?.tradingEnabled ? 'trade=enabled' : 'trade=disabled';
    toast(
      `source=${body.source} | markets=${body.markets.length} | ${trading} | generated=${new Date(body.generatedAt).toLocaleTimeString()}`
    );
    renderMarkets(body.markets);
  } catch (error) {
    toast(`Scan failed: ${error.message}`);
    resultsEl.innerHTML = '<p>Scan failed. Check server logs.</p>';
  } finally {
    scanBtn.disabled = false;
  }
}

scanBtn.addEventListener('click', runScan);

(async function init() {
  await loadConfig();
  limitEl.value = String(config.defaultLimit || 20);
  await runScan();
})();
