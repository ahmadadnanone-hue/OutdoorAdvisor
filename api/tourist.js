/**
 * /api/tourist — PMD tourist destination weather
 *
 * Fetches live observations + 3-day forecasts for Pakistan's major
 * tourist stations from nwfc.pmd.gov.pk/new/tourist.php?station=NNNNN
 *
 * Updated twice daily by PMD (10:30 & 17:30 PST).
 */

import https from 'https';

// ─── Station catalog ──────────────────────────────────────────────────────────
const STATIONS = [
  { id: '41573', name: 'Murree',        region: 'Punjab' },
  { id: '41516', name: 'Gilgit',        region: 'Gilgit-Baltistan' },
  { id: '41505', name: 'Hunza',         region: 'Gilgit-Baltistan' },
  { id: '41510', name: 'Kalam',         region: 'KPK' },
  { id: '43532', name: 'Muzaffarabad',  region: 'AJK' },
  { id: '41506', name: 'Chitral',       region: 'KPK' },
  { id: '41523', name: 'Saidu Sharif',  region: 'Swat, KPK' },
  { id: '41525', name: 'Malam Jabba',   region: 'KPK' },
  { id: '43533', name: 'Garhi Dopatta', region: 'AJK' },
  { id: '41574', name: 'Rawalakot',     region: 'AJK' },
  { id: '41661', name: 'Quetta',        region: 'Balochistan' },
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

  try {
    // Fetch all stations in parallel (limit to avoid rate-limiting)
    const results = await Promise.allSettled(
      STATIONS.map((station) => fetchStation(station))
    );

    const stations = results
      .map((r, i) => r.status === 'fulfilled' ? r.value : { ...STATIONS[i], error: true })
      .filter((s) => !s.error);

    // Also fetch the bulletin from the first station page (it's the same on all)
    let bulletin = null;
    const first = results.find((r) => r.status === 'fulfilled');
    if (first?.value?.bulletin) bulletin = first.value.bulletin;

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      bulletin,
      stations,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      error: err.message,
      bulletin: null,
      stations: [],
    });
  }
}

// ─── Per-station fetch + parse ────────────────────────────────────────────────

async function fetchStation(station) {
  const url = `https://nwfc.pmd.gov.pk/new/tourist.php?station=${station.id}`;
  const html = await fetchPage(url);
  return parseStation(html, station);
}

function parseStation(html, station) {
  const strip = (s) => s.replace(/<[^>]+>/g, '')
    .replace(/&deg;/gi, '°').replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&').replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ').trim();

  // ── Bulletin (same on all pages) ──
  const bulletinMatch = html.match(/<p>(.{30,600}?)<\/p>/s);
  const bulletin = bulletinMatch ? strip(bulletinMatch[1]).slice(0, 400) : null;

  // ── Current temperature from H1 ──
  const tempMatch = html.match(/<h1[^>]*>(\d{1,2})\s*(?:&deg;|°|&#176;)/i);
  const tempC = tempMatch ? parseInt(tempMatch[1]) : null;

  // ── Station label + last updated ──
  const stationMatch = html.match(/<h4[^>]*>([A-Z][A-Z\s]+?)\s*\(Last Updated:\s*([^)]+)\)/i);
  const stationLabel = stationMatch ? stationMatch[1].trim() : station.name;
  const lastUpdated  = stationMatch ? stationMatch[2].trim() : null;

  // ── Current obs from TDs ──
  const tds = [];
  const tdRe = /<td[^>]*>(.*?)<\/td>/gis;
  let tm;
  while ((tm = tdRe.exec(html)) !== null) {
    tds.push(strip(tm[1]));
  }

  // Layout: Humidity, XX%, _, Wind Speed, XX KM/H, _, Pressure, MB, _, Visibility, XX KM
  let humidity = null, windSpeed = null, visibility = null;
  for (let i = 0; i < tds.length - 1; i++) {
    if (/humidity/i.test(tds[i]))   humidity   = tds[i + 1];
    if (/wind speed/i.test(tds[i])) windSpeed  = tds[i + 1];
    if (/visib/i.test(tds[i]))      visibility = tds[i + 1];
  }

  // ── Current condition icon ──
  const icons = [...html.matchAll(/assets\/icons\/([^"]+\.png)/g)].map((m) => m[1]);
  const currentIcon = icons[0] || null;
  const condition   = iconToCondition(currentIcon);

  // ── 3-day forecast ──
  const days  = [...html.matchAll(/<th[^>]*>(\w+)<\/th>/gi)].map((m) => m[1]);
  const ranges = [...html.matchAll(/<h5[^>]*>(\d{1,2}-\d{1,2})<\/h5>/gi)].map((m) => m[1]);
  // icons[0] = current obs, icons[1..3] = forecast days
  const forecastIcons = icons.slice(1, 4);

  const forecast = days.slice(0, 3).map((day, i) => {
    const [min, max] = (ranges[i] || '').split('-').map(Number);
    return {
      day,
      icon: forecastIcons[i] || null,
      condition: iconToCondition(forecastIcons[i]),
      minTemp: min || null,
      maxTemp: max || null,
    };
  });

  return {
    id:          station.id,
    name:        stationLabel || station.name,
    region:      station.region,
    lastUpdated,
    bulletin,
    current: {
      tempC,
      condition,
      icon:       currentIcon,
      humidity:   parseFloat(humidity) || null,
      windKph:    parseFloat(windSpeed) || null,
      visibilityKm: parseFloat(visibility) || null,
    },
    forecast,
  };
}

// ─── Icon → condition label ───────────────────────────────────────────────────

function iconToCondition(filename) {
  if (!filename) return 'Unknown';
  const f = filename.toLowerCase().replace('.png', '');
  if (f.includes('thunderstorm') || f.includes('thunder')) return 'Thunderstorm';
  if (f.includes('heavy-rain') || f.includes('heavy_rain')) return 'Heavy Rain';
  if (f.includes('rain') && f.includes('snow'))             return 'Sleet';
  if (f.includes('rain') || f.includes('shower'))           return 'Rain';
  if (f.includes('drizzle'))                                return 'Drizzle';
  if (f.includes('snow') || f.includes('blizzard'))         return 'Snow';
  if (f.includes('fog') || f.includes('haze') || f.includes('smog')) return 'Fog';
  if (f.includes('overcast') || f.includes('cloudy') && !f.includes('partly')) return 'Overcast';
  if (f.includes('partly'))                                 return 'Partly Cloudy';
  if (f.includes('sunny') || f.includes('clear'))           return 'Clear';
  return 'Variable';
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
        'Cache-Control': 'no-cache',
      },
      timeout: 15000,
      rejectUnauthorized: false,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchPage(res.headers.location).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}
