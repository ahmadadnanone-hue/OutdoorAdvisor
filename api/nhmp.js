import https from 'https';
import http from 'http';
import { kvGetJson, kvSetJson } from './_lib/kv.js';
import { NHMP_FALLBACK_SNAPSHOT } from './_data/nhmpFallback.js';

const NHMP_CACHE_KEY = 'travel:nhmp:latest';
const LIVE_CACHE_MAX_AGE_MS = 15 * 60 * 1000;
const SNAPSHOT_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const NHMP_PAGE_URLS = [
  'https://beta.nhmp.gov.pk/TA/Public/ViewTravel.aspx',
  'http://cpo.nhmp.gov.pk:7892/TA/public/viewtravel.aspx',
  'http://beta.nhmp.gov.pk/TA/Public/ViewTravel.aspx',
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  let cached = null;

  try {
    cached = await kvGetJson(NHMP_CACHE_KEY);
    if (isCacheFresh(cached)) {
      sendPayload(res, cached, { stale: cached.source !== 'live' });
      return;
    }
  } catch {}

  try {
    const livePayload = await fetchLiveNhmp();
    const payload = {
      ...livePayload,
      source: 'live',
      sourceLabel: 'Official NHMP feed',
    };

    try {
      await kvSetJson(NHMP_CACHE_KEY, payload);
    } catch {}

    sendPayload(res, payload);
  } catch (err) {
    if (cached?.advisories?.length) {
      sendPayload(res, cached, {
        stale: true,
        error: err.message,
      });
      return;
    }

    const snapshotPayload = {
      ...NHMP_FALLBACK_SNAPSHOT,
      count: NHMP_FALLBACK_SNAPSHOT.advisories.length,
      source: 'snapshot',
    };

    try {
      await kvSetJson(NHMP_CACHE_KEY, snapshotPayload);
    } catch {}

    sendPayload(res, snapshotPayload, {
      stale: true,
      error: err.message,
    });
  }
}

async function fetchLiveNhmp() {
  let lastErr;

  for (const url of NHMP_PAGE_URLS) {
    try {
      const html = await fetchPage(url);
      if (!html || html.length < 500 || isNhmpErrorPage(html)) {
        throw new Error('NHMP returned an error page');
      }

      const advisories = parseAdvisories(html);
      if (!advisories.length) {
        throw new Error('NHMP returned no advisories');
      }

      return {
        timestamp: new Date().toISOString(),
        count: advisories.length,
        advisories,
      };
    } catch (error) {
      lastErr = error;
    }
  }

  throw lastErr || new Error('All NHMP endpoints failed');
}

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      family: 4,
      timeout: 4500,
      rejectUnauthorized: false,
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        fetchPage(response.headers.location).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode >= 400) {
        response.resume();
        reject(new Error(`NHMP returned ${response.statusCode}`));
        return;
      }

      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => resolve(data));
      response.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

function isCacheFresh(cached) {
  if (!cached?.timestamp || !cached?.advisories?.length) return false;

  const ageMs = Date.now() - new Date(cached.timestamp).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return false;

  const maxAge = cached.source === 'snapshot' ? SNAPSHOT_CACHE_MAX_AGE_MS : LIVE_CACHE_MAX_AGE_MS;
  return ageMs <= maxAge;
}

function isNhmpErrorPage(html) {
  return /server error in '\/' application|timeout expired|exception details:|system\.invalidoperationexception/i.test(html || '');
}

function sendPayload(res, payload, extra = {}) {
  res.status(200).json({
    success: true,
    timestamp: payload.timestamp || new Date().toISOString(),
    count: payload.count || payload.advisories.length,
    advisories: payload.advisories,
    source: payload.source || 'live',
    sourceLabel: payload.sourceLabel || 'Official NHMP feed',
    stale: extra.stale ?? payload.source !== 'live',
    error: extra.error,
  });
}

export function parseAdvisories(html) {
  const results = [];
  const stripTags = (s) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/g, '&').replace(/&#\d+;/g, '').replace(/\s+/g, ' ').trim();
  const tableRegex = /<table[^>]*id="GridView\d+"[^>]*>([\s\S]*?)<\/table>/gi;
  let match;

  while ((match = tableRegex.exec(html)) !== null) {
    const tableBody = match[1];
    const advisoryRows = [];
    const advisoryRegex = /<tr[^>]*class="([^"]*)"[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;
    let advisoryMatch;

    while ((advisoryMatch = advisoryRegex.exec(tableBody)) !== null) {
      const status = stripTags(advisoryMatch[2]);
      if (status && status.length > 3) {
        advisoryRows.push({
          status,
          hasWarning: /warning|danger|yellow|orange|red/i.test(advisoryMatch[1] || ''),
        });
      }
    }

    if (!advisoryRows.length) continue;

    const contextWindow = html.slice(Math.max(0, match.index - 900), match.index);
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const contextCells = [];
    let tdMatch;
    while ((tdMatch = tdRegex.exec(contextWindow)) !== null) {
      const raw = tdMatch[1];
      const text = stripTags(raw);
      if (text) {
        contextCells.push({ raw, text });
      }
    }

    const routeCell = [...contextCells].reverse().find((cell) =>
      /\b(M-?\d+|N-?\d+|E-?\d+|GT Road|Highway|Expressway|Swat|Murree|Karakoram|Hazara|Lahore|Islamabad|Peshawar|Karachi|Hyderabad)\b/i.test(cell.text)
    );
    const sectorCell = [...contextCells].reverse().find((cell) => /sector/i.test(cell.text));

    let routeName = '';
    if (routeCell) {
      const routeCode = routeCell.text.match(/\b(M-?\d+|N-?\d+|E-?\d+)\b/i)?.[1] || '';
      const bracketText = routeCell.text.match(/\(([^)]+)\)/)?.[1] || '';
      routeName = [routeCode, bracketText && `(${bracketText})`].filter(Boolean).join(' ').trim() || routeCell.text;
    }

    const sector = sectorCell?.text || '';

    for (const advisory of advisoryRows) {
      if (/^last updated/i.test(advisory.status)) continue;
      results.push({
        route: routeName || sector || 'NHMP corridor',
        sector,
        status: advisory.status,
        severity: getSeverity(advisory.status),
        hasWarning: advisory.hasWarning,
      });
    }
  }

  // Also try table with id="c" which NHMP sometimes uses
  const altTableRegex = /<table[^>]*id="c"[^>]*>([\s\S]*?)<\/table>/gi;
  let altMatch;
  while ((altMatch = altTableRegex.exec(html)) !== null) {
    const tableBody = altMatch[1];
    const advisoryRegex = /<tr[^>]*class="([^"]*)"[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;
    let advisoryMatch;
    while ((advisoryMatch = advisoryRegex.exec(tableBody)) !== null) {
      const status = stripTags(advisoryMatch[2]);
      if (status && status.length > 3 && !/^last updated/i.test(status)) {
        const contextWindow = html.slice(Math.max(0, altMatch.index - 900), altMatch.index);
        const routeCell = stripTags(contextWindow.match(/<td[^>]*>([\s\S]*?)<\/td>\s*$/i)?.[1] || '');
        results.push({
          route: routeCell || 'NHMP corridor',
          sector: '',
          status,
          severity: getSeverity(status),
          hasWarning: /warning|danger|yellow|orange|red/i.test(advisoryMatch[1] || ''),
        });
      }
    }
  }

  // Deduplicate
  const seen = new Set();
  return results.filter((r) => {
    const key = `${r.route}|${r.status}`.substring(0, 200);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isLikelyStatus(text) {
  return /clear|rain|fog|cloud|diversion|clos|open|shut|block|road\s*work|weather|smog|wind|storm|procession|protest|wet|dry|normal|restoration/i.test(text);
}

function getSeverity(status) {
  const s = status.toLowerCase();
  if (/clos|block|shut|suspend/i.test(s)) return 'closed';
  if (/fog|smog|haz|visibility/i.test(s)) return 'fog';
  if (/rain|wet|shower|storm|thunder/i.test(s)) return 'rain';
  if (/diversion|lane\s*clos|road\s*work|construction|procession|protest|restoration/i.test(s)) return 'warning';
  if (/cloud/i.test(s)) return 'cloudy';
  return 'clear';
}
