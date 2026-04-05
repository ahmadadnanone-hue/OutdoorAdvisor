import https from 'https';
import http from 'http';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');

  try {
    // Try multiple endpoints — Cloudflare may block some
    let html;
    const urls = [
      'https://nwfc.pmd.gov.pk/new/3-days-forecast.php',
      'http://nwfc.pmd.gov.pk/new/3-days-forecast.php',
    ];
    let lastErr;
    for (const url of urls) {
      try {
        html = await fetchPage(url);
        if (html && html.length > 1000 && /table_rows/.test(html)) break;
        html = null;
      } catch (e) {
        lastErr = e;
        html = null;
      }
    }
    const data = html ? parseForecast(html) : [];

    // Also try to fetch alerts/warnings
    let alerts = [];
    try {
      const alertHtml = await fetchPage('https://nwfc.pmd.gov.pk/new/daily-forecast-en.php');
      alerts = parseAlerts(alertHtml);
    } catch {}

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      cities: data,
      alerts,
      _debug: data.length === 0 ? {
        htmlLength: html ? html.length : 0,
        hasTableRows: html ? /table_rows/.test(html) : false,
        hasBrCity: html ? /<br>[A-Za-z]{3,}<\/td>/.test(html) : false,
        hasTitle: html ? /title="[^"]*\[\d+-\d+\]"/.test(html) : false,
        sample: html ? html.substring(0, 300) : 'No HTML fetched - all URLs blocked',
        cloudflareBlocked: html ? /Just a moment/.test(html) : true,
      } : undefined,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      error: err.message,
      cities: [],
      alerts: [],
    });
  }
}

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
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

function parseForecast(html) {
  const cities = [];
  const stripTags = (s) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/g, '&').replace(/&#\d+;/g, '').replace(/\s+/g, ' ').trim();

  // Extract day names from table headings (th elements)
  const dates = [];
  const thRegex = /<th[^>]*class="table_headings"[^>]*>([\s\S]*?)<\/th>/gi;
  let thMatch;
  const skipHeaders = /province|city|humidity|min\s*temp/i;
  while ((thMatch = thRegex.exec(html)) !== null) {
    const text = stripTags(thMatch[1]);
    if (text && !skipHeaders.test(text)) dates.push(text);
  }

  // Extract rows — use greedy match within <tr>...</tr>
  const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;

  while ((match = rowRegex.exec(html)) !== null) {
    const row = match[1];

    // Must have weather icon titles with [temp-range] to be a city row
    const iconRegex = /title="([^"]*\[\d+-\d+\])"/g;
    const forecasts = [];
    let iconMatch;
    while ((iconMatch = iconRegex.exec(row)) !== null) {
      const title = iconMatch[1];
      const parsed = title.match(/^(.+?)\s*\[(\d+)-(\d+)\]$/);
      if (parsed) {
        forecasts.push({
          condition: parsed[1].trim(),
          minTemp: parseInt(parsed[2]),
          maxTemp: parseInt(parsed[3]),
        });
      }
    }
    if (forecasts.length === 0) continue;

    // Extract all td cells
    const allCells = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      allCells.push(stripTags(cellMatch[1]));
    }

    // Find city name: look for <br> followed by alpha text directly before </td>
    // Province cells have <span> tags inside, city cells have plain text after <br>
    let cityName = '';
    let humidity = '';
    let baseMinTemp = null;

    // Check each table_rows cell for city/humidity/temp
    const dataRegex = /<td[^>]*class="table_rows"[^>]*>([\s\S]*?)<\/td>/gi;
    let dataMatch;
    while ((dataMatch = dataRegex.exec(row)) !== null) {
      const raw = dataMatch[1];
      const text = stripTags(raw);

      // Skip province cells (contain <span> tag)
      if (/<span/.test(raw)) continue;

      if (!cityName && /^[A-Za-z][A-Za-z .'()-]+$/.test(text) && text.length >= 2 && text.length <= 30) {
        cityName = text;
      } else if (!humidity && /%/.test(text)) {
        humidity = text;
      } else if (baseMinTemp == null && /\d/.test(text)) {
        const num = parseInt(text);
        if (!isNaN(num) && num >= -20 && num <= 55) {
          baseMinTemp = num;
        }
      }
    }

    if (!cityName) continue;

    // Build city forecast (3 days)
    const days = [];
    for (let i = 0; i < Math.min(forecasts.length, 3); i++) {
      days.push({
        date: dates[i] || `Day ${i + 1}`,
        condition: forecasts[i].condition,
        maxTemp: forecasts[i].maxTemp,
        minTemp: forecasts[i].minTemp,
        severity: getWeatherSeverity(forecasts[i].condition),
      });
    }

    if (days.length > 0) {
      cities.push({ city: cityName, forecast: days, humidity, baseMinTemp });
    }
  }

  return cities;
}

function parseAlerts(html) {
  const alerts = [];
  const stripTags = (s) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/g, '&').replace(/&#\d+;/g, '').replace(/\s+/g, ' ').trim();

  // Look for warning/alert sections - often in bold red text or special divs
  const patterns = [
    /(?:warning|alert|advisory|caution|severe)[^<]*(?:<[^>]+>)*([^<]{20,500})/gi,
    /<(?:p|div|span)[^>]*(?:color\s*:\s*red|warning|alert)[^>]*>([\s\S]{20,500}?)<\//gi,
    /<strong[^>]*>([\s\S]*?(?:warning|storm|flood|heat|cold|rain|thunder|cyclone)[\s\S]*?)<\/strong>/gi,
  ];

  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(html)) !== null) {
      const text = stripTags(m[1] || m[0]);
      if (text.length > 15 && text.length < 500) {
        alerts.push(text);
      }
    }
  }

  // Deduplicate
  return [...new Set(alerts)].slice(0, 10);
}

function getWeatherSeverity(condition) {
  const c = condition.toLowerCase();
  if (/thunder|storm|heavy rain|flood/i.test(c)) return 'severe';
  if (/rain|shower|drizzle/i.test(c)) return 'rain';
  if (/fog|mist|haze|smog/i.test(c)) return 'fog';
  if (/cloud/i.test(c)) return 'cloudy';
  if (/sunny|clear/i.test(c)) return 'clear';
  return 'other';
}
