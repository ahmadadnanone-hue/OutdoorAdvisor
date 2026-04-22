/**
 * /api/alerts — Pakistan PMD CAP weather alert feed
 *
 * Source: https://cap-sources.s3.amazonaws.com/pk-pmd-en/rss.xml
 * Public AWS S3 feed, no auth, machine-readable CAP XML.
 *
 * Returns up to 10 most recent active alerts with severity, regions, expiry.
 */

import https from 'https';

const RSS_URL = 'https://cap-sources.s3.amazonaws.com/pk-pmd-en/rss.xml';
const MAX_ALERTS = 10;
const CAP_FETCH_LIMIT = 6; // fetch full CAP XML for first N alerts

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');

  try {
    const rssXml = await fetchUrl(RSS_URL);
    const items = parseRssItems(rssXml);

    // Fetch full CAP XML for the first CAP_FETCH_LIMIT items in parallel
    const capPromises = items.slice(0, CAP_FETCH_LIMIT).map(async (item) => {
      try {
        if (!item.link) return item;
        const capXml = await fetchUrl(item.link);
        const capData = parseCapXml(capXml);
        return { ...item, ...capData };
      } catch {
        return item; // fallback to RSS-only data
      }
    });

    const enriched = await Promise.all(capPromises);
    // append remaining items (RSS-only, no CAP detail fetch)
    const remaining = items.slice(CAP_FETCH_LIMIT).map((item) => item);
    const all = [...enriched, ...remaining];

    // Filter to non-expired alerts only
    const now = Date.now();
    const active = all.filter((a) => {
      if (!a.expires) return true; // no expiry = keep
      return new Date(a.expires).getTime() > now;
    });

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      count: active.length,
      alerts: active.slice(0, MAX_ALERTS),
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      error: err.message,
      alerts: [],
    });
  }
}

// ─── Fetch helper ─────────────────────────────────────────────────────────────

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'OutdoorAdvisor/1.0 (Pakistan weather app)',
        'Accept': 'application/xml, text/xml, application/rss+xml, */*',
      },
      timeout: 12000,
      rejectUnauthorized: false,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location).then(resolve).catch(reject);
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

// ─── RSS parser ───────────────────────────────────────────────────────────────

function parseRssItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1];
    const title   = extractTag(block, 'title');
    const desc    = extractTag(block, 'description');
    const pubDate = extractTag(block, 'pubDate');
    const link    = extractTag(block, 'link') || extractCdata(block, 'link');

    if (!title) continue;

    items.push({
      id: link || title,
      title: cleanText(title),
      description: cleanText(desc),
      pubDate: pubDate ? new Date(pubDate).toISOString() : null,
      link: link?.trim(),
      // defaults — may be overwritten by CAP XML
      severity: guessSeverityFromTitle(title),
      urgency: 'Expected',
      certainty: 'Possible',
      event: cleanText(title),
      regions: extractRegionsFromText(title + ' ' + desc),
      onset: null,
      expires: null,
      instruction: null,
    });
  }
  return items;
}

// ─── CAP XML parser ───────────────────────────────────────────────────────────

function parseCapXml(xml) {
  const info = extractBlock(xml, 'cap:info') || extractBlock(xml, 'info');
  if (!info) return {};

  const severity  = extractTag(info, 'cap:severity')  || extractTag(info, 'severity');
  const urgency   = extractTag(info, 'cap:urgency')   || extractTag(info, 'urgency');
  const certainty = extractTag(info, 'cap:certainty') || extractTag(info, 'certainty');
  const event     = extractTag(info, 'cap:event')     || extractTag(info, 'event');
  const headline  = extractTag(info, 'cap:headline')  || extractTag(info, 'headline');
  const desc      = extractTag(info, 'cap:description') || extractTag(info, 'description');
  const instr     = extractTag(info, 'cap:instruction') || extractTag(info, 'instruction');
  const onset     = extractTag(info, 'cap:onset')     || extractTag(info, 'onset');
  const expires   = extractTag(info, 'cap:expires')   || extractTag(info, 'expires');
  const areaDesc  = extractTag(info, 'cap:areaDesc')  || extractTag(info, 'areaDesc');

  return {
    severity:    normalizeSeverity(severity),
    urgency:     urgency    || 'Expected',
    certainty:   certainty  || 'Possible',
    event:       cleanText(event || headline),
    description: cleanText(desc),
    instruction: cleanText(instr),
    onset:       onset  ? parseCapDate(onset)  : null,
    expires:     expires ? parseCapDate(expires) : null,
    regions:     areaDesc
      ? areaDesc.split(/[,\/]/).map((r) => r.trim()).filter(Boolean)
      : [],
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i');
  const m = re.exec(xml);
  return m ? m[1].trim() : null;
}

function extractCdata(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]>`, 'i');
  const m = re.exec(xml);
  return m ? m[1].trim() : null;
}

function extractBlock(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = re.exec(xml);
  return m ? m[1] : null;
}

function cleanText(str) {
  if (!str) return '';
  return str
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSeverity(s) {
  if (!s) return 'Minor';
  const v = s.trim().toLowerCase();
  if (v === 'extreme') return 'Extreme';
  if (v === 'severe')  return 'Severe';
  if (v === 'moderate') return 'Moderate';
  return 'Minor';
}

function guessSeverityFromTitle(title) {
  const t = (title || '').toLowerCase();
  if (/flash flood|extreme|cyclone|hurricane/i.test(t)) return 'Severe';
  if (/warning|storm|heavy rain|thunder/i.test(t))      return 'Moderate';
  return 'Minor';
}

function extractRegionsFromText(text) {
  const REGIONS = [
    'Punjab', 'Sindh', 'KPK', 'Khyber Pakhtunkhwa', 'Balochistan',
    'Gilgit-Baltistan', 'AJK', 'Azad Kashmir', 'Islamabad',
    'Lahore', 'Karachi', 'Peshawar', 'Quetta', 'Rawalpindi',
    'Murree', 'Swat', 'Chitral', 'Hunza', 'Gilgit', 'Skardu',
    'Muzaffarabad', 'Multan', 'Faisalabad', 'Hyderabad',
  ];
  return REGIONS.filter((r) => new RegExp(r, 'i').test(text));
}

function parseCapDate(str) {
  // CAP dates: "2026-04-06T06:26:00+05:00" or ISO
  try {
    return new Date(str).toISOString();
  } catch {
    return null;
  }
}
