const statusLine = document.getElementById('statusLine');
const resultsEl = document.getElementById('results');
const scanBtn = document.getElementById('scanBtn');
const searchEl = document.getElementById('search');
const sortByEl = document.getElementById('sortBy');
const limitEl = document.getElementById('limit');
const enrichEl = document.getElementById('enrich');
const cardTemplate = document.getElementById('cardTemplate');

const tradePanel = document.getElementById('tradePanel');
const tradeModeBadge = document.getElementById('tradeModeBadge');
const tradeMarket = document.getElementById('tradeMarket');
const tradeSideEl = document.getElementById('tradeSide');
const tradeAmountEl = document.getElementById('tradeAmount');
const simulateBtn = document.getElementById('simulateBtn');
const copyCmdBtn = document.getElementById('copyCmdBtn');
const executeBtn = document.getElementById('executeBtn');
const tradeRisk = document.getElementById('tradeRisk');
const tradeCommand = document.getElementById('tradeCommand');
const quickChips = Array.from(document.querySelectorAll('.quick-chip'));

let config = null;
let selectedMarket = null;
let lastSimulation = null;

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

function setTextLines(element, lines) {
  element.replaceChildren();
  lines.forEach((line, index) => {
    if (index > 0) element.appendChild(document.createElement('br'));
    element.appendChild(document.createTextNode(line));
  });
}

function safePolymarketUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && url.hostname === 'polymarket.com') {
      return url.href;
    }
  } catch {
    return null;
  }
  return null;
}

async function loadConfig() {
  const res = await fetch('/api/config');
  config = await res.json();

  tradeModeBadge.textContent = config.tradingEnabled ? 'trade enabled' : 'trade disabled';
  tradeModeBadge.classList.toggle('enabled', config.tradingEnabled);
  executeBtn.disabled = !config.tradingEnabled;
}

async function simulateCommand(token, side, amount) {
  const res = await fetch('/api/trade/simulate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, side, amount })
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'simulate failed');
  return body;
}

async function executeTrade(token, side, amount) {
  const res = await fetch('/api/trade/execute', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, side, amount })
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'execute failed');
  return body;
}

function renderTradePanel() {
  if (!selectedMarket) {
    tradePanel.classList.add('hidden');
    return;
  }

  tradePanel.classList.remove('hidden');
  tradeMarket.replaceChildren();
  const question = document.createElement('strong');
  question.textContent = selectedMarket.question || 'Untitled market';
  tradeMarket.append(
    question,
    document.createElement('br'),
    document.createTextNode(`token=${selectedMarket.tokenId}`),
    document.createElement('br'),
    document.createTextNode(
      `score=${selectedMarket.score.toFixed(2)} | volume=$${fmtMoney(selectedMarket.volume)} | liquidity=$${fmtMoney(selectedMarket.liquidity)}`
    )
  );
}

function resetSimulationState() {
  lastSimulation = null;
  tradeRisk.replaceChildren();
  tradeCommand.textContent = 'No command yet.';
}

async function runSimulation() {
  if (!selectedMarket?.tokenId) {
    toast('Select a market with token ID first.');
    return;
  }

  const side = tradeSideEl.value;
  const amount = Number(tradeAmountEl.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    toast('Amount must be > 0.');
    return;
  }

  simulateBtn.disabled = true;
  toast('Simulating command...');

  try {
    const payload = await simulateCommand(selectedMarket.tokenId, side, amount);
    lastSimulation = { payload, token: selectedMarket.tokenId, side, amount };

    tradeCommand.textContent = payload.commandText;
    tradeRisk.replaceChildren(
      ...payload.riskChecks.map((line) => {
        const item = document.createElement('div');
        item.textContent = `- ${line}`;
        return item;
      })
    );
    toast(`Simulation ready for ${side.toUpperCase()} ${amount}`);
  } catch (error) {
    toast(`Simulation failed: ${error.message}`);
  } finally {
    simulateBtn.disabled = false;
  }
}

async function copyLastCommand() {
  if (!lastSimulation?.payload?.commandText) {
    toast('Run simulation first.');
    return;
  }

  await navigator.clipboard.writeText(lastSimulation.payload.commandText);
  toast('Command copied to clipboard');
}

async function runExecute() {
  if (!config?.tradingEnabled) {
    toast('Trading is disabled on server.');
    return;
  }

  if (!selectedMarket?.tokenId) {
    toast('Select a market first.');
    return;
  }

  const side = tradeSideEl.value;
  const amount = Number(tradeAmountEl.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    toast('Amount must be > 0.');
    return;
  }

  const confirmed = window.confirm(`Execute ${side.toUpperCase()} ${amount} for selected market?`);
  if (!confirmed) return;

  executeBtn.disabled = true;
  toast('Executing market order...');

  try {
    const result = await executeTrade(selectedMarket.tokenId, side, amount);
    tradeCommand.textContent = JSON.stringify(result, null, 2);
    toast('Trade submitted. Check order/trade status in CLI.');
  } catch (error) {
    toast(`Execute failed: ${error.message}`);
  } finally {
    executeBtn.disabled = !config.tradingEnabled;
  }
}

async function copyToken(token) {
  await navigator.clipboard.writeText(token);
  toast('Token copied');
}

function selectMarket(market) {
  selectedMarket = market;
  renderTradePanel();
  resetSimulationState();
  renderSelectedCardState();
  tradePanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderSelectedCardState() {
  const cards = Array.from(resultsEl.querySelectorAll('.card'));
  for (const card of cards) {
    const sameId = selectedMarket && card.dataset.marketId === selectedMarket.id;
    card.classList.toggle('selected', Boolean(sameId));
  }
}

function renderMarkets(markets) {
  resultsEl.replaceChildren();

  if (!markets.length) {
    const empty = document.createElement('p');
    empty.textContent = 'No markets found.';
    resultsEl.appendChild(empty);
    return;
  }

  for (const market of markets) {
    const node = cardTemplate.content.cloneNode(true);
    const card = node.querySelector('.card');
    const score = node.querySelector('.score');
    const link = node.querySelector('.open');
    const question = node.querySelector('.question');
    const meta = node.querySelector('.meta');
    const prepareBtn = node.querySelector('.prepare-trade');
    const copyTokenBtn = node.querySelector('.copy-token');

    score.textContent = `Score ${market.score.toFixed(2)}`;
    question.textContent = market.question;

    const marketUrl = safePolymarketUrl(market.marketUrl);
    if (marketUrl) {
      link.href = marketUrl;
    } else {
      link.removeAttribute('href');
      link.textContent = 'No URL';
    }

    const metaLines = [`volume=$${fmtMoney(market.volume)} | liquidity=$${fmtMoney(market.liquidity)}`];
    if (market.midpoint != null || market.spread != null) {
      metaLines.push(
        `mid=${market.midpoint == null ? '-' : market.midpoint.toFixed(3)} | spread=${fmtPct(market.spread)}`
      );
    }
    metaLines.push(`token=${market.tokenId || '-'}`);
    setTextLines(meta, metaLines);

    if (!market.tokenId) {
      prepareBtn.disabled = true;
      copyTokenBtn.disabled = true;
      prepareBtn.textContent = 'Token unavailable';
      copyTokenBtn.textContent = 'No token';
    } else {
      prepareBtn.addEventListener('click', () => selectMarket(market));
      copyTokenBtn.addEventListener('click', () => copyToken(market.tokenId));
    }

    card.dataset.score = String(market.score);
    card.dataset.marketId = market.id;
    resultsEl.appendChild(node);
  }

  renderSelectedCardState();
}

async function runScan() {
  scanBtn.disabled = true;
  toast('Scanning markets...');

  const params = new URLSearchParams({
    search: searchEl.value.trim(),
    sort_by: sortByEl.value || 'liquidity',
    order: 'desc',
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
      `source=${body.source} | sort=${body.sortBy || sortByEl.value}:desc | markets=${body.markets.length} | ${trading} | generated=${new Date(body.generatedAt).toLocaleTimeString()}`
    );
    renderMarkets(body.markets);
  } catch (error) {
    toast(`Scan failed: ${error.message}`);
    const failure = document.createElement('p');
    failure.textContent = 'Scan failed. Check server logs.';
    resultsEl.replaceChildren(failure);
  } finally {
    scanBtn.disabled = false;
  }
}

scanBtn.addEventListener('click', runScan);
simulateBtn.addEventListener('click', runSimulation);
copyCmdBtn.addEventListener('click', () => {
  copyLastCommand().catch((error) => toast(`Copy failed: ${error.message}`));
});
executeBtn.addEventListener('click', runExecute);
tradeSideEl.addEventListener('change', resetSimulationState);
tradeAmountEl.addEventListener('input', resetSimulationState);
for (const chip of quickChips) {
  chip.addEventListener('click', async () => {
    searchEl.value = chip.dataset.query || '';
    await runScan();
  });
}

(async function init() {
  await loadConfig();
  limitEl.value = String(config.defaultLimit || 20);
  await runScan();
})();
