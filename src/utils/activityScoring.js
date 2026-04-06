const SCORE_COLORS = {
  excellent: '#22C55E',
  good: '#84CC16',
  fair: '#F59E0B',
  limited: '#F97316',
  avoid: '#EF4444',
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getActivityProfile(activityId) {
  const intense = new Set([
    'running',
    'cycling',
    'cricket',
    'football',
    'basketball',
    'tennis',
    'hiking',
    'paragliding',
    'biking',
    'skateboarding',
    'martial_arts',
  ]);
  const light = new Set([
    'walking',
    'dining',
    'fishing',
    'bowling',
    'ice_skating',
    'golf',
    'yoga',
  ]);

  if (intense.has(activityId)) {
    return { air: 1.2, heat: 1.15, wind: 1.1, rain: 1.1, idealMax: 29 };
  }
  if (light.has(activityId)) {
    return { air: 0.8, heat: 0.85, wind: 0.75, rain: 0.8, idealMax: 33 };
  }
  return { air: 1, heat: 1, wind: 0.9, rain: 0.95, idealMax: 31 };
}

export function getScoreTone(score) {
  if (score >= 80) return { label: 'Great', color: SCORE_COLORS.excellent };
  if (score >= 65) return { label: 'Good', color: SCORE_COLORS.good };
  if (score >= 50) return { label: 'Fair', color: SCORE_COLORS.fair };
  if (score >= 35) return { label: 'Limited', color: SCORE_COLORS.limited };
  return { label: 'Avoid', color: SCORE_COLORS.avoid };
}

export function scoreActivityConditions(activity, aqi, weather) {
  const profile = getActivityProfile(activity.id);
  const heatValue = weather?.feelsLike ?? weather?.temp ?? null;
  const weatherCode = weather?.weatherCode;
  const windSpeed = weather?.windSpeed ?? 0;
  const humidity = weather?.humidity ?? null;
  const isRain = weatherCode != null && [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(weatherCode);
  const isHeavyRain = weatherCode != null && [65, 82].includes(weatherCode);
  const isStorm = weatherCode != null && [95, 96, 99].includes(weatherCode);

  let score = 100;

  if (aqi > 50) score -= Math.min(14, (aqi - 50) * 0.22 * profile.air);
  if (aqi > 100) score -= Math.min(22, (aqi - 100) * 0.45 * profile.air + 8);
  if (aqi > 150) score -= Math.min(24, (aqi - 150) * 0.34 * profile.air + 10);
  if (aqi > 200) score -= Math.min(26, (aqi - 200) * 0.3 * profile.air + 12);

  if (heatValue != null && heatValue > profile.idealMax) {
    score -= Math.min(24, (heatValue - profile.idealMax) * 2.3 * profile.heat);
  }
  if (heatValue != null && heatValue >= 44) score -= 14;
  if (humidity != null && humidity > 85 && heatValue != null && heatValue >= 34) {
    score -= 8 * profile.heat;
  }

  if (isStorm) score -= 45;
  else if (isHeavyRain) score -= 20 * profile.rain;
  else if (isRain) score -= 10 * profile.rain;

  if (windSpeed > 25) score -= Math.min(16, (windSpeed - 25) * 0.8 * profile.wind);

  if (aqi > 100) {
    const cautionCap = 72 - (profile.air > 1 ? 6 : 0);
    score = Math.min(score, cautionCap);
  }
  if (aqi > 150) {
    score = Math.min(score, 54 - (profile.air > 1 ? 4 : 0));
  }
  if (aqi > 200) {
    score = Math.min(score, 32);
  }

  const normalized = Math.round(clamp(score, 0, 100));
  return {
    score: normalized,
    ...getScoreTone(normalized),
  };
}

function formatHour(date) {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    hour12: true,
  });
}

export function getBestTimeLabel(activity, aqi, hourly = []) {
  const now = new Date();
  const todayKey = now.toDateString();
  const candidates = hourly
    .map((hour) => {
      const date = hour?.time ? new Date(hour.time) : null;
      if (!date || Number.isNaN(date.getTime())) return null;
      if (date < now) return null;
      if (date.toDateString() !== todayKey) return null;
      return {
        ...hour,
        date,
        summary: scoreActivityConditions(activity, aqi, hour),
      };
    })
    .filter(Boolean);

  if (candidates.length === 0) {
    return 'Use the next comfortable weather window';
  }

  let best = { score: -1, startIndex: 0, span: 1 };
  for (let i = 0; i < candidates.length; i += 1) {
    const current = candidates[i];
    const next = candidates[i + 1];
    const pairScore = next
      ? Math.round((current.summary.score + next.summary.score) / 2)
      : current.summary.score;
    if (pairScore > best.score) {
      best = {
        score: pairScore,
        startIndex: i,
        span: next ? 2 : 1,
      };
    }
  }

  const start = candidates[best.startIndex].date;
  if (best.span === 1) return formatHour(start);

  const end = new Date(start.getTime() + best.span * 60 * 60 * 1000);
  const startHour = formatHour(start).replace(':00', '');
  const endHour = formatHour(end).replace(':00', '');
  return `${startHour}–${endHour}`;
}

export function getActivitySummary(activity, aqi, weather, hourly) {
  const score = scoreActivityConditions(activity, aqi, weather);
  const bestTime = getBestTimeLabel(activity, aqi, hourly);
  return {
    ...score,
    bestTime,
  };
}
