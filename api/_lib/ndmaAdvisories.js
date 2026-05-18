const NDMA_ADVISORIES_URL = 'https://www.ndma.gov.pk/advisories';
const NDMA_BASE_URL = 'https://www.ndma.gov.pk';
const NDMA_PUSH_MAX_AGE_MS = 72 * 60 * 60 * 1000;
const NDMA_DISPLAY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const REGION_KEYWORDS = [
  'Pakistan', 'Punjab', 'South Punjab', 'Upper Punjab', 'Sindh', 'Balochistan',
  'Eastern Balochistan', 'Khyber Pakhtunkhwa', 'KP', 'Gilgit-Baltistan',
  'GB', 'AJK', 'Azad Kashmir', 'Islamabad',
  'Lahore', 'Rawalpindi', 'Sialkot', 'Multan', 'Faisalabad', 'Rajanpur',
  'Rahim Yar Khan', 'R.Y. Khan', 'Karachi', 'Hyderabad', 'Sukkur', 'Jacobabad',
  'Sibi', 'Nasirabad', 'Peshawar', 'Dir', 'Swat', 'Chitral', 'Kohistan',
  'Hunza', 'Shigar', 'Gilgit', 'Skardu', 'KKH', 'Karakoram Highway',
];

const REGION_ALIASES = {
  KP: 'Khyber Pakhtunkhwa',
  GB: 'Gilgit-Baltistan',
  'R.Y. Khan': 'Rahim Yar Khan',
  KKH: 'Karakoram Highway',
};

const HAZARD_RULES = [
  {
    hazard: 'GLOF / landslide',
    level: 'Extreme',
    pattern: /\b(glof|glacial lake|landslide|debris flow|kkh|karakoram)\b/i,
    action: 'Avoid riverbeds, unstable slopes, and mountain-road travel during rain; check route status before leaving.',
    defaultRegions: ['Gilgit-Baltistan', 'Hunza', 'Shigar', 'Gilgit', 'Skardu', 'Chitral', 'Kohistan', 'Karakoram Highway'],
  },
  {
    hazard: 'Flash flood / heavy rain',
    level: 'Extreme',
    pattern: /\b(flash flood|torrential|very heavy|heavy fall|urban flooding|flood warning)\b/i,
    action: 'Avoid low-lying roads, nullahs, and unnecessary travel; keep extra time and monitor official updates.',
    defaultRegions: [],
  },
  {
    hazard: 'Heatwave',
    level: 'Severe',
    pattern: /\b(heatwave|heat wave|heat dome|extreme heat|temperature.*above normal)\b/i,
    action: 'Avoid peak heat, hydrate often, check vulnerable people, and shift outdoor work to cooler hours.',
    defaultRegions: ['Rajanpur', 'Rahim Yar Khan', 'Jacobabad', 'Sukkur', 'Hyderabad', 'Sibi', 'Nasirabad'],
  },
  {
    hazard: 'Storm / wind / lightning',
    level: 'Severe',
    pattern: /\b(windstorm|thunderstorm|lightning|hailstorm|hail|dust storm|gusty|squall|westerly wave)\b/i,
    action: 'Pause exposed outdoor plans, avoid trees/signboards, and delay travel during active storm cells.',
    defaultRegions: ['Dir', 'Swat', 'Chitral', 'Gilgit-Baltistan', 'AJK', 'Lahore', 'Rawalpindi', 'Sialkot'],
  },
  {
    hazard: 'Weather advisory',
    level: 'Moderate',
    pattern: /\b(weather advisory|rain|wind|advisory)\b/i,
    action: 'Review the official advisory and choose safer timing for outdoor or road plans.',
    defaultRegions: [],
  },
];

export async function fetchNdmaAdvisories({ limit = 10 } = {}) {
  const response = await fetch(NDMA_ADVISORIES_URL, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'OutdoorAdvisor/1.0 NDMA advisory monitor',
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    throw new Error(`NDMA advisories fetch failed (${response.status})`);
  }

  const html = await response.text();
  return parseNdmaAdvisories(html).slice(0, limit);
}

export function parseNdmaAdvisories(html) {
  const advisories = [];
  const seen = new Set();
  const linkRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRe.exec(html || '')) !== null) {
    const href = decodeHtml(match[1]);
    const text = cleanText(match[2]);
    if (!href || !text) continue;
    if (!/view|advisory|alert|warning|flood|heat|glof|rain|storm/i.test(text)) continue;
    if (!/secure-viewer|storage\/advisories|advisories/i.test(href)) continue;

    const sourceUrl = toAbsoluteUrl(href);
    const fileUrl = extractFileUrl(sourceUrl);
    const date = extractDate(text) || extractTextualDate(text) || extractDate(href);
    const title = cleanTitle(text, date);
    if (!title || /^view$/i.test(title)) continue;

    const key = advisoryKey(title, date, sourceUrl);
    if (seen.has(key)) continue;
    seen.add(key);

    const classification = classifyNdmaAdvisory(title);
    const regions = inferNdmaRegions(title);

    advisories.push({
      key,
      title,
      date,
      sourceUrl,
      fileUrl,
      ...classification,
      regions: regions.length ? regions : classification.defaultRegions,
      pushEligible: isNdmaPushFresh(date),
    });
  }

  return advisories.sort((a, b) => {
    const at = a.date ? new Date(`${a.date}T00:00:00Z`).getTime() : 0;
    const bt = b.date ? new Date(`${b.date}T00:00:00Z`).getTime() : 0;
    return bt - at;
  });
}

export function classifyNdmaAdvisory(title) {
  const rule = HAZARD_RULES.find((item) => item.pattern.test(title || ''));
  if (!rule) {
    return {
      hazard: 'Advisory',
      level: 'Info',
      important: false,
      recommendedAction: 'Review the official NDMA advisory before making outdoor or travel plans.',
      defaultRegions: [],
    };
  }
  return {
    hazard: rule.hazard,
    level: rule.level,
    important: rule.level === 'Extreme' || rule.level === 'Severe',
    recommendedAction: rule.action,
    defaultRegions: rule.defaultRegions || [],
  };
}

export function ndmaAdvisoryMatchesDevice(advisory, device) {
  if (!advisory?.important) return false;
  if (advisory.pushEligible === false || !isNdmaPushFresh(advisory.date)) return false;
  const city = normalize(device?.location?.city);
  const region = normalize(device?.location?.region);
  if (!city || city === 'selected') return false;

  const regions = advisory.regions || [];
  if (!regions.length) return false;
  if (regions.some((item) => /^pakistan$/i.test(item))) return true;

  return regions.some((item) => {
    const needle = normalize(item);
    return city.includes(needle) || needle.includes(city) || region.includes(needle) || needle.includes(region);
  });
}

export function buildNdmaPushCopy(advisory, device) {
  const city = device?.location?.city && !/^selected$/i.test(device.location.city)
    ? device.location.city
    : null;
  const prefix = city ? `${city}: ` : '';
  const hazard = advisory.hazard || 'Advisory';
  const title = advisory.level === 'Extreme' ? `NDMA ${hazard} alert` : `NDMA ${hazard} advisory`;
  const body = truncateSms(`${prefix}${advisory.title}. ${advisory.recommendedAction}`);
  return { title: truncateText(title, 58), body };
}

export function summarizeNdmaForBrief(advisories, locationName) {
  const location = normalize(locationName);
  return (advisories || [])
    .filter((advisory) => advisory.important)
    .filter((advisory) => isNdmaDisplayFresh(advisory.date))
    .filter((advisory) => {
      if (!location) return true;
      if (!advisory.regions?.length) return true;
      if (advisory.regions.some((region) => isBroadRegion(region))) return true;
      return advisory.regions.some((region) => {
        const needle = normalize(region);
        return location.includes(needle) || needle.includes(location);
      });
    })
    .slice(0, 3)
    .map((advisory) => ({
      title: advisory.title,
      date: advisory.date,
      hazard: advisory.hazard,
      level: advisory.level,
      regions: advisory.regions,
      action: advisory.recommendedAction,
    }));
}

function cleanText(value) {
  return decodeHtml(String(value || '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanTitle(text, date) {
  let title = cleanText(text)
    .replace(/\bView\b/gi, '')
    .replace(/\bNew\s*[-–—>]+\s*/gi, '')
    .replace(/\(\s*\d{1,2}\s+[A-Za-z]+\s+20\d{2}\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (date) {
    const [year, month, day] = date.split('-');
    const datePatterns = [
      `${day}-${month}-${year}`,
      `${day}/${month}/${year}`,
      `${Number(day)}-${Number(month)}-${year}`,
    ];
    for (const pattern of datePatterns) {
      title = title.replace(pattern, '').trim();
    }
  }
  return title.replace(/\s*[-–—]\s*$/g, '').trim();
}

function extractDate(value) {
  const match = String(value || '').match(/\b(\d{1,2})[-/](\d{1,2})[-/](20\d{2})\b/);
  if (!match) return null;
  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  return `${match[3]}-${month}-${day}`;
}

function extractTextualDate(value) {
  const months = {
    january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
  };
  const match = String(value || '').match(/\b(\d{1,2})(?:st|nd|rd|th)?(?:\s*(?:&|and|-)\s*(\d{1,2})(?:st|nd|rd|th)?)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i);
  if (!match) return null;
  const day = String(match[2] || match[1]).padStart(2, '0');
  const month = months[match[3].toLowerCase()];
  return `${match[4]}-${month}-${day}`;
}

export function isNdmaPushFresh(date, now = Date.now()) {
  return isNdmaFreshWithin(date, NDMA_PUSH_MAX_AGE_MS, now);
}

export function isNdmaDisplayFresh(date, now = Date.now()) {
  return isNdmaFreshWithin(date, NDMA_DISPLAY_MAX_AGE_MS, now);
}

function isNdmaFreshWithin(date, maxAgeMs, now = Date.now()) {
  if (!date) return false;
  const timestamp = new Date(`${date}T23:59:59+05:00`).getTime();
  if (!Number.isFinite(timestamp)) return false;
  return now - timestamp <= maxAgeMs;
}

function inferNdmaRegions(text) {
  const found = REGION_KEYWORDS.filter((region) => new RegExp(`\\b${escapeRegExp(region)}\\b`, 'i').test(text || ''))
    .map((region) => REGION_ALIASES[region] || region);
  return [...new Set(found)];
}

function isBroadRegion(region) {
  return /pakistan|punjab|sindh|balochistan|khyber|gilgit|azad|ajk|gb|kp/i.test(region || '');
}

function toAbsoluteUrl(href) {
  try {
    return new URL(href, NDMA_BASE_URL).toString();
  } catch {
    return href;
  }
}

function extractFileUrl(sourceUrl) {
  try {
    const url = new URL(sourceUrl);
    const file = url.searchParams.get('file');
    return file ? new URL(file, NDMA_BASE_URL).toString() : sourceUrl;
  } catch {
    return sourceUrl;
  }
}

function advisoryKey(title, date, sourceUrl) {
  const raw = `${title}|${date || ''}|${sourceUrl || ''}`.toLowerCase();
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  return `ndma:${Math.abs(hash)}`;
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function truncateSms(value) {
  return truncateText(value, 158);
}

function truncateText(value, maxLength) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trim()}...`;
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
