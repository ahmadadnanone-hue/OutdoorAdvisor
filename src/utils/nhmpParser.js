const NHMP_URL = 'https://beta.nhmp.gov.pk/TA/Public/ViewTravel.aspx';

function isNhmpErrorPage(html) {
  return /server error in '\/' application|timeout expired|exception details:|system\.invalidoperationexception/i.test(html || '');
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/g, '&').replace(/&#\d+;/g, '').replace(/\s+/g, ' ').trim();
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

export function parseNhmpHtml(html) {
  const results = [];
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
      const text = stripTags(tdMatch[1]);
      if (text) contextCells.push(text);
    }

    const routeCell = [...contextCells].reverse().find((t) =>
      /\b(M-?\d+|N-?\d+|E-?\d+|GT Road|Highway|Expressway|Swat|Murree|Karakoram|Hazara|Lahore|Islamabad|Peshawar|Karachi|Hyderabad)\b/i.test(t)
    );
    const sectorCell = [...contextCells].reverse().find((t) => /sector/i.test(t));

    let routeName = '';
    if (routeCell) {
      const routeCode = routeCell.match(/\b(M-?\d+|N-?\d+|E-?\d+)\b/i)?.[1] || '';
      const bracketText = routeCell.match(/\(([^)]+)\)/)?.[1] || '';
      routeName = [routeCode, bracketText && `(${bracketText})`].filter(Boolean).join(' ').trim() || routeCell;
    }

    const sector = sectorCell || '';

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

  // Also try table with id="c"
  const altTableRegex = /<table[^>]*id="c"[^>]*>([\s\S]*?)<\/table>/gi;
  let altMatch;
  while ((altMatch = altTableRegex.exec(html)) !== null) {
    const advisoryRegex = /<tr[^>]*class="([^"]*)"[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;
    let advisoryMatch;
    while ((advisoryMatch = advisoryRegex.exec(altMatch[1])) !== null) {
      const status = stripTags(advisoryMatch[2]);
      if (status && status.length > 3 && !/^last updated/i.test(status)) {
        const contextWindow = html.slice(Math.max(0, altMatch.index - 900), altMatch.index);
        const routeText = stripTags(contextWindow.match(/<td[^>]*>([\s\S]*?)<\/td>\s*$/i)?.[1] || '');
        results.push({
          route: routeText || 'NHMP corridor',
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

export async function fetchNhmpDirect() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  let response;

  try {
    response = await fetch(NHMP_URL, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) throw new Error(`NHMP returned ${response.status}`);
  const html = await response.text();
  if (!html || html.length < 500 || isNhmpErrorPage(html)) {
    throw new Error('NHMP response was not usable');
  }

  const advisories = parseNhmpHtml(html);
  if (!advisories.length) throw new Error('NHMP response returned no advisories');

  return {
    success: true,
    timestamp: new Date().toISOString(),
    count: advisories.length,
    advisories,
  };
}
