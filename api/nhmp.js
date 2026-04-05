import https from 'https';
import http from 'http';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

  try {
    // Try multiple NHMP endpoints
    let html;
    const urls = [
      'http://cpo.nhmp.gov.pk:7892/TA/public/viewtravel.aspx',
      'https://beta.nhmp.gov.pk/TA/Public/ViewTravel.aspx',
    ];
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
      timeout: 25000,
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

  // Extract all table rows
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;

  while ((match = rowRegex.exec(html)) !== null) {
    const row = match[1];
    const cells = [];
    const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch;
    while ((cellMatch = cellRe.exec(row)) !== null) {
      cells.push(stripTags(cellMatch[1]));
    }

    if (cells.length < 2) continue;

    // Check for highlight colors (warnings)
    const hasWarning = /yellow|#ff|orange|red/i.test(match[0]);

    // Try to find route identifier in cells
    const routePattern = /\b(M-?\d+|N-?\d+|E-?\d+|Swat\s*Express)/i;
    let routeName = '';
    let sector = '';
    let status = '';

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (!routeName && routePattern.test(cell)) {
        routeName = cell.replace(/\s+/g, ' ').trim();
      } else if (routeName && !sector && cell.length > 2 && cell.length < 80 && !isLikelyStatus(cell)) {
        sector = cell;
      } else if (cell.length > 5 && isLikelyStatus(cell)) {
        status = cell;
      }
    }

    // Fallback: first cell = route, last meaningful cell = status
    if (!routeName && cells[0] && cells[0].length > 1 && cells[0].length < 80) {
      routeName = cells[0];
    }
    if (!status) {
      for (let i = cells.length - 1; i >= 1; i--) {
        if (cells[i].length > 5) {
          status = cells[i];
          break;
        }
      }
    }

    if (routeName && status && status.length > 3) {
      // Skip header/label rows
      if (/^(S\.?\s*No|Sr|#|Date|Time|Route|Sector|Zone|Status|Remarks)/i.test(routeName)) continue;
      if (routeName.length > 100 || status.length > 500) continue;

      const severity = getSeverity(status);

      results.push({
        route: routeName,
        sector: sector || '',
        status,
        severity,
        hasWarning,
      });
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
