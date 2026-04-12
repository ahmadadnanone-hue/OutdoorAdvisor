import https from 'https';
import http from 'http';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  try {
    let html;
    const urls = ['https://beta.nhmp.gov.pk/TA/Public/ViewTravel.aspx'];
    let lastErr;
    for (const url of urls) {
      try {
        html = await fetchPage(url);
        if (html && html.length > 500) break;
      } catch (e) {
        lastErr = e;
        html = null;
      }
    }
    if (!html) throw lastErr || new Error('All NHMP endpoints failed');
    const advisories = parseAdvisories(html);

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      count: advisories.length,
      advisories,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      error: err.message,
      advisories: [],
    });
  }
}

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 20000,
      rejectUnauthorized: false,
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        fetchPage(response.headers.location).then(resolve).catch(reject);
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

function parseAdvisories(html) {
  const results = [];
  const stripTags = (s) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/g, '&').replace(/&#\d+;/g, '').replace(/\s+/g, ' ').trim();
  const routePattern = /\b(M-?\d+|N-?\d+|E-?\d+|GT Road|Swat|Murree|Karakoram|Hazara)\b/i;

  // Try GridView tables first, fall back to all tables
  const tableRegex = /<table[^>]*id="[^"]*(?:GridView|gv|grid)[^"]*"[^>]*>([\s\S]*?)<\/table>/gi;
  const allTableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;

  function parseTables(regex) {
    let match;
    while ((match = regex.exec(html)) !== null) {
      const tableBody = match[1];
      const rowRegex = /<tr([^>]*)>([\s\S]*?)<\/tr>/gi;
      let rowMatch;

      while ((rowMatch = rowRegex.exec(tableBody)) !== null) {
        const rowAttrs = rowMatch[1];
        const rowContent = rowMatch[2];

        // Extract all cell texts from this row
        const cells = [];
        const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        let cellMatch;
        while ((cellMatch = cellRe.exec(rowContent)) !== null) {
          const text = stripTags(cellMatch[1]);
          if (text) cells.push(text);
        }

        if (cells.length < 2) continue;

        const hasWarning = /warning|danger|yellow|orange|red/i.test(rowAttrs);

        // Identify route, sector, status from cells
        let routeName = '';
        let sector = '';
        let status = '';

        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i];
          if (!routeName && routePattern.test(cell)) {
            const code = cell.match(/\b(M-?\d+|N-?\d+|E-?\d+)\b/i)?.[1] || '';
            const bracket = cell.match(/\(([^)]+)\)/)?.[1] || '';
            routeName = [code, bracket && `(${bracket})`].filter(Boolean).join(' ').trim() || cell;
          } else if (routeName && !sector && cell.length > 1 && cell.length < 80 && !isLikelyStatus(cell)) {
            sector = cell;
          } else if (cell.length > 3 && isLikelyStatus(cell)) {
            status = cell;
          }
        }

        // Positional fallback: first cell = route/info, last cell = status
        if (!status && cells.length >= 2) {
          status = cells[cells.length - 1];
          if (!routeName) routeName = cells[0];
          if (!sector && cells.length >= 3) sector = cells[1];
        }

        if (!status || status.length <= 3) continue;
        if (!routeName && !sector) continue;
        // Skip header rows
        if (/^(S\.?\s*No|Sr|#|Date|Time|Route|Sector|Zone|Status|Remarks)/i.test(routeName || cells[0])) continue;
        if (/^last updated/i.test(status)) continue;

        results.push({
          route: routeName || sector || 'NHMP corridor',
          sector: sector || '',
          status,
          severity: getSeverity(status),
          hasWarning,
        });
      }
    }
  }

  parseTables(tableRegex);
  // If GridView tables yielded nothing, try all tables
  if (!results.length) parseTables(allTableRegex);

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
