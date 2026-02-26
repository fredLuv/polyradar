import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mockDepth, mockMarkets } from './mockData.js';

const execFileAsync = promisify(execFile);

function cliError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function unwrapArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.markets)) return payload.markets;
    if (Array.isArray(payload.items)) return payload.items;
  }
  return [];
}

export class PolymarketClient {
  constructor({ binary = 'polymarket', mockIfUnavailable = true } = {}) {
    this.binary = binary;
    this.mockIfUnavailable = mockIfUnavailable;
  }

  async runJson(args, { timeoutMs = 20_000 } = {}) {
    try {
      const { stdout, stderr } = await execFileAsync(this.binary, ['-o', 'json', ...args], {
        timeout: timeoutMs,
        maxBuffer: 20 * 1024 * 1024
      });

      const text = String(stdout || '').trim();
      if (!text) return {};
      try {
        return JSON.parse(text);
      } catch {
        throw cliError('CLI did not return valid JSON.', 'BAD_JSON', {
          stdout: text,
          stderr: String(stderr || '').trim()
        });
      }
    } catch (error) {
      if (error?.code === 'ENOENT') {
        throw cliError(`Binary not found: ${this.binary}`, 'CLI_UNAVAILABLE', { cause: error });
      }
      if (error?.killed) {
        throw cliError('CLI command timed out.', 'CLI_TIMEOUT', { cause: error });
      }
      if (error?.code === 'BAD_JSON') throw error;
      throw cliError('CLI command failed.', 'CLI_FAILED', { cause: error });
    }
  }

  async listMarkets({ limit = 20, search = '' } = {}) {
    if (search) {
      const payload = await this.runJson(['markets', 'search', search, '--limit', String(limit)]);
      return unwrapArray(payload);
    }

    const payload = await this.runJson([
      'markets',
      'list',
      '--limit',
      String(limit),
      '--active',
      'true',
      '--closed',
      'false'
    ]);
    return unwrapArray(payload);
  }

  async midpoint(tokenId) {
    const payload = await this.runJson(['clob', 'midpoint', tokenId]);
    return Number(payload.midpoint ?? payload.mid ?? payload.price ?? NaN);
  }

  async spread(tokenId) {
    const payload = await this.runJson(['clob', 'spread', tokenId]);
    return Number(payload.spread ?? payload.width ?? NaN);
  }

  async marketOrder({ token, side, amount }) {
    return this.runJson([
      'clob',
      'market-order',
      '--token',
      token,
      '--side',
      side,
      '--amount',
      String(amount)
    ]);
  }

  buildMarketOrderCommand({ token, side, amount }) {
    return [
      this.binary,
      'clob',
      'market-order',
      '--token',
      token,
      '--side',
      side,
      '--amount',
      String(amount)
    ];
  }

  async listMarketsWithFallback({ limit, search }) {
    try {
      const markets = await this.listMarkets({ limit, search });
      return { source: 'live', markets };
    } catch (error) {
      if (!this.mockIfUnavailable || error.code !== 'CLI_UNAVAILABLE') throw error;
      const filtered =
        search && search.trim()
          ? mockMarkets.filter((m) =>
              m.question.toLowerCase().includes(search.toLowerCase()) ||
              m.slug.toLowerCase().includes(search.toLowerCase())
            )
          : mockMarkets;
      return { source: 'mock', markets: filtered.slice(0, limit) };
    }
  }

  async depthWithFallback(tokenId) {
    if (!tokenId) return { midpoint: null, spread: null, source: 'none' };

    try {
      const [midpoint, spread] = await Promise.all([this.midpoint(tokenId), this.spread(tokenId)]);
      return {
        midpoint: Number.isFinite(midpoint) ? midpoint : null,
        spread: Number.isFinite(spread) ? spread : null,
        source: 'live'
      };
    } catch (error) {
      if (!this.mockIfUnavailable || error.code !== 'CLI_UNAVAILABLE') {
        return { midpoint: null, spread: null, source: 'unavailable' };
      }

      const mock = mockDepth[tokenId];
      return {
        midpoint: mock ? mock.midpoint : null,
        spread: mock ? mock.spread : null,
        source: mock ? 'mock' : 'none'
      };
    }
  }
}
