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

function withinRange(value, min, max) {
  return value != null && value >= min && value <= max;
}

function getActivityProfile(activityId) {
  const indoor = new Set([
    'yoga',
    'badminton',
    'martial_arts',
  ]);
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
    'golf',
    'yoga',
  ]);

  if (activityId === 'swimming') {
    return {
      indoor: false,
      air: 0.62,
      heat: 0.28,
      wind: 0.35,
      rain: 0.55,
      humidity: 0.48,
      uv: 0.78,
      idealTempMin: 24,
      idealTempMax: 34,
      comfortTempMax: 41,
      idealHumidityMin: 25,
      idealHumidityMax: 72,
      idealUvMax: 6,
      bestWeather: 'warm to hot weather with manageable air and a pool that is not fully exposed to harsh midday sun',
      rationale: 'swimming benefits from warm weather more than most outdoor activities, though AQI, UV, and exposed outdoor pool conditions still matter',
    };
  }

  if (indoor.has(activityId)) {
    return {
      indoor: true,
      air: 0.38,
      heat: 0.32,
      wind: 0.08,
      rain: 0.08,
      humidity: 0.42,
      uv: 0.04,
      idealTempMin: 18,
      idealTempMax: 26,
      comfortTempMax: 31,
      idealHumidityMin: 35,
      idealHumidityMax: 62,
      idealUvMax: 8,
      bestWeather: 'stable indoor air, filtered ventilation, and a comfortable room temperature',
      rationale: 'indoor sessions are buffered from outdoor heat, rain, wind, and UV, but ventilation quality still matters',
    };
  }

  if (intense.has(activityId)) {
    return {
      indoor: false,
      air: 1.2,
      heat: 1.15,
      wind: 1.1,
      rain: 1.15,
      humidity: 1.05,
      uv: 1.1,
      idealTempMin: 12,
      idealTempMax: 24,
      comfortTempMax: 29,
      idealHumidityMin: 35,
      idealHumidityMax: 62,
      idealUvMax: 4,
      bestWeather: 'cloudy or lightly sunny',
      rationale: 'steady exertion and heavier breathing make air, heat, and UV matter more',
    };
  }

  if (light.has(activityId)) {
    return {
      indoor: false,
      air: 0.85,
      heat: 0.85,
      wind: 0.75,
      rain: 0.8,
      humidity: 0.8,
      uv: 0.8,
      idealTempMin: 18,
      idealTempMax: 28,
      comfortTempMax: 33,
      idealHumidityMin: 30,
      idealHumidityMax: 68,
      idealUvMax: 6,
      bestWeather: 'mild, dry weather with some cloud cover',
      rationale: 'comfort matters more than peak performance, so light humidity or warmth is easier to tolerate',
    };
  }

  return {
    indoor: false,
    air: 1,
    heat: 1,
    wind: 0.9,
    rain: 0.95,
    humidity: 0.95,
    uv: 1,
    idealTempMin: 16,
    idealTempMax: 26,
    comfortTempMax: 31,
    idealHumidityMin: 35,
    idealHumidityMax: 65,
    idealUvMax: 5,
    bestWeather: 'comfortable and mostly dry conditions',
    rationale: 'balanced conditions across air, heat, and surface comfort help most',
  };
}

export function getScoreTone(score) {
  if (score >= 85) return { label: 'Great', color: SCORE_COLORS.excellent };
  if (score >= 70) return { label: 'Good', color: SCORE_COLORS.good };
  if (score >= 55) return { label: 'Caution', color: SCORE_COLORS.fair };
  if (score >= 35) return { label: 'Limit', color: SCORE_COLORS.limited };
  return { label: 'Avoid', color: SCORE_COLORS.avoid };
}

function getCurrentUvIndex(weather, hourly = []) {
  if (weather?.uvIndex != null) return weather.uvIndex;
  const nextWithUv = hourly.find((hour) => hour?.uvIndex != null);
  return nextWithUv?.uvIndex ?? null;
}

function getActivityContext(activity, aqi, weather, hourly = []) {
  const profile = getActivityProfile(activity.id);
  const heatValue = weather?.feelsLike ?? weather?.temp ?? null;
  const weatherCode = weather?.weatherCode;
  const windSpeed = weather?.windSpeed ?? 0;
  const humidity = weather?.humidity ?? null;
  const uvIndex = getCurrentUvIndex(weather, hourly);
  const precipProbability = weather?.precipProbability ?? null;
  const precipitation = weather?.precipitation ?? null;
  const isRain = weatherCode != null && [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(weatherCode);
  const isHeavyRain = weatherCode != null && [65, 82].includes(weatherCode);
  const isStorm = weatherCode != null && [95, 96, 99].includes(weatherCode);
  const isCloudy = weatherCode != null && [2, 3].includes(weatherCode);
  const isFog = weatherCode != null && [45, 48].includes(weatherCode);

  return {
    profile,
    heatValue,
    weatherCode,
    windSpeed,
    humidity,
    uvIndex,
    precipProbability,
    precipitation,
    isRain,
    isHeavyRain,
    isStorm,
    isCloudy,
    isFog,
    aqi: aqi ?? 0,
  };
}

function evaluateActivity(activity, aqi, weather, hourly = []) {
  const context = getActivityContext(activity, aqi, weather, hourly);
  const {
    profile,
    heatValue,
    humidity,
    uvIndex,
    windSpeed,
    precipProbability,
    precipitation,
    isRain,
    isHeavyRain,
    isStorm,
    isCloudy,
    isFog,
  } = context;

  let score = 78;
  const reasons = [];
  const isIndoorActivity = profile.indoor === true;

  if (context.aqi <= 50) {
    score += 12;
    reasons.push({ kind: 'good', text: 'AQI is clean enough for comfortable breathing.' });
  } else if (context.aqi <= 100) {
    score += 2;
    reasons.push({ kind: 'neutral', text: `AQI ${context.aqi} is manageable for most people.` });
  } else if (context.aqi <= 150) {
    const penalty = Math.round((context.aqi - 100) * 0.36 * profile.air + 12);
    score -= penalty;
    reasons.push({ kind: 'bad', text: `AQI ${context.aqi} raises breathing strain, especially during longer effort.` });
  } else if (context.aqi <= 200) {
    const penalty = Math.round((context.aqi - 150) * 0.42 * profile.air + 28);
    score -= penalty;
    reasons.push({ kind: 'bad', text: `AQI ${context.aqi} is poor enough to drag this activity into a shorter, lower-effort window.` });
  } else {
    const penalty = Math.round((context.aqi - 200) * 0.24 * profile.air + 44);
    score -= penalty;
    reasons.push({ kind: 'bad', text: isIndoorActivity ? `AQI ${context.aqi} is severe outside, so indoor ventilation quality matters much more than usual.` : `AQI ${context.aqi} is severe for outdoor exertion right now.` });
  }

  if (isIndoorActivity && context.aqi > 100) {
    score += context.aqi > 200 ? 18 : 12;
    reasons.push({ kind: 'good', text: 'This activity gets useful protection from being indoors, especially if the venue has strong air filtration.' });
  }

  if (heatValue != null) {
    if (withinRange(heatValue, profile.idealTempMin, profile.idealTempMax)) {
      score += 10;
      reasons.push({ kind: 'good', text: `${Math.round(heatValue)}° feels close to the sweet spot for ${activity.name.toLowerCase()}.` });
    } else if (heatValue > profile.comfortTempMax) {
      const penalty = Math.round((heatValue - profile.comfortTempMax) * 2.8 * profile.heat + 10);
      score -= penalty;
      reasons.push({ kind: 'bad', text: `${Math.round(heatValue)}° feels hot enough to sap comfort and performance.` });
    } else if (heatValue > profile.idealTempMax) {
      const penalty = Math.round((heatValue - profile.idealTempMax) * 1.6 * profile.heat);
      score -= penalty;
      reasons.push({ kind: 'neutral', text: `${Math.round(heatValue)}° is workable, but warmer than ideal for this activity.` });
    } else if (heatValue < profile.idealTempMin - 5) {
      score -= Math.round((profile.idealTempMin - heatValue) * 1.1);
      reasons.push({ kind: 'neutral', text: `${Math.round(heatValue)}° is cooler than ideal, so warm-up and comfort matter more.` });
    }
  }

  if (activity.id === 'swimming' && heatValue != null) {
    if (heatValue >= 30 && heatValue <= 40) {
      score += 12;
      reasons.push({ kind: 'good', text: `Warm ${Math.round(heatValue)}° conditions can actually suit swimming better than many other outdoor activities.` });
    } else if (heatValue > 40 && heatValue <= 45) {
      score += 5;
      reasons.push({ kind: 'neutral', text: `Swimming can still work in this heat, but shade, cooling breaks, and avoiding peak-sun exposure matter much more.` });
    }
  }

  if (isIndoorActivity && heatValue != null && heatValue >= 38) {
    score += heatValue >= 47 ? 18 : 10;
    reasons.push({ kind: 'good', text: 'Because it is indoors, this option avoids the worst of the outdoor heat stress right now.' });
  }

  if (humidity != null) {
    if (withinRange(humidity, profile.idealHumidityMin, profile.idealHumidityMax)) {
      score += 6;
      reasons.push({ kind: 'good', text: `${humidity}% humidity is in a comfortable range.` });
    } else if (humidity > 80) {
      score -= Math.round((humidity - 80) * 0.45 * profile.humidity + 6);
      reasons.push({ kind: 'bad', text: `${humidity}% humidity makes exertion feel heavier and slows cooling.` });
    } else if (humidity > profile.idealHumidityMax) {
      score -= Math.round((humidity - profile.idealHumidityMax) * 0.18 * profile.humidity);
      reasons.push({ kind: 'neutral', text: `${humidity}% humidity adds some stickiness even if the temperature looks fine.` });
    }
  }

  if (uvIndex != null) {
    if (uvIndex <= 3) {
      score += 4;
      reasons.push({ kind: 'good', text: `UV ${uvIndex} is gentle enough for a more comfortable outdoor window.` });
    } else if (uvIndex > profile.idealUvMax + 3) {
      score -= Math.round((uvIndex - profile.idealUvMax) * 2.4 * profile.uv + 3);
      reasons.push({ kind: 'bad', text: `UV ${uvIndex} adds meaningful sun exposure risk for this activity.` });
    } else if (uvIndex > profile.idealUvMax) {
      score -= Math.round((uvIndex - profile.idealUvMax) * 1.3 * profile.uv);
      reasons.push({ kind: 'neutral', text: `UV ${uvIndex} is higher than ideal, so shade and sunscreen matter.` });
    }
  }

  if (isStorm) {
    score -= 50;
    reasons.push({ kind: 'bad', text: isIndoorActivity ? 'Stormy conditions still make travel to the venue less comfortable, but the session itself is sheltered.' : 'Thunderstorm risk is a hard stop for exposed outdoor activity.' });
  } else if (isHeavyRain) {
    score -= Math.round(26 * profile.rain + ((precipProbability ?? 0) > 70 ? 4 : 0));
    reasons.push({ kind: 'bad', text: isIndoorActivity ? 'Heavy rain mainly affects the trip to the venue rather than the activity itself.' : 'Heavy rain makes surfaces, visibility, and comfort much worse.' });
  } else if (isRain) {
    score -= Math.round(12 * profile.rain + ((precipProbability ?? 0) > 40 ? 3 : 0));
    reasons.push({ kind: 'neutral', text: isIndoorActivity ? 'Rain is less of a problem once you are inside, though the commute may still be messy.' : 'Rain is manageable, but it still chips away at comfort and traction.' });
  } else if (isCloudy && precipitation == null) {
    score += 4;
    reasons.push({ kind: 'good', text: 'Cloud cover helps keep the outdoor window more comfortable.' });
  }

  if (isFog) {
    score -= 8;
    reasons.push({ kind: 'neutral', text: 'Fog reduces visibility, which makes route choice more important.' });
  }

  if (windSpeed >= 35) {
    score -= Math.round((windSpeed - 35) * 0.9 * profile.wind + 8);
    reasons.push({ kind: 'bad', text: `${Math.round(windSpeed)} km/h wind is disruptive for movement and comfort.` });
  } else if (windSpeed >= 22) {
    score -= Math.round((windSpeed - 22) * 0.45 * profile.wind);
    reasons.push({ kind: 'neutral', text: `${Math.round(windSpeed)} km/h wind is noticeable and may affect exposed routes.` });
  }

  if (context.aqi > 100) {
    score = Math.min(score, isIndoorActivity ? 82 : activity.id === 'swimming' ? 72 : profile.air > 1 ? 60 : 66);
  }
  if (context.aqi > 150) {
    score = Math.min(score, isIndoorActivity ? 72 : activity.id === 'swimming' ? 58 : profile.air > 1 ? 42 : 48);
  }
  if (context.aqi > 200) {
    score = Math.min(score, isIndoorActivity ? 62 : activity.id === 'swimming' ? 34 : 24);
  }
  if (isStorm) {
    score = Math.min(score, isIndoorActivity ? 58 : 18);
  }

  const normalized = Math.round(clamp(score, 0, 100));
  const tone = getScoreTone(normalized);
  const sortedReasons = reasons
    .sort((a, b) => {
      const rank = { bad: 0, neutral: 1, good: 2 };
      return rank[a.kind] - rank[b.kind];
    })
    .map((item) => item.text);

  return {
    score: normalized,
    ...tone,
    rationale: sortedReasons.slice(0, 4),
    idealScenario: `${activity.name} scores best in ${profile.bestWeather}, around ${profile.idealTempMin}–${profile.idealTempMax}°C, with lower humidity, lower UV, and cleaner air.`,
    profileReason: profile.rationale,
  };
}

export function scoreActivityConditions(activity, aqi, weather, hourly = []) {
  return evaluateActivity(activity, aqi, weather, hourly);
}

function formatHour(date) {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    hour12: true,
  });
}

function isHourWithinWindow(hour, window) {
  if (!window) return true;
  const start = Number(window.startHour);
  const end = Number(window.endHour);
  if (Number.isNaN(start) || Number.isNaN(end)) return true;
  if (start === end) return true;
  if (start < end) {
    return hour >= start && hour < end;
  }
  return hour >= start || hour < end;
}

function getActivityTimeWindows(activity) {
  return Array.isArray(activity?.timeWindows) && activity.timeWindows.length > 0
    ? activity.timeWindows
    : null;
}

function isActivityAvailableAtDate(activity, date) {
  const windows = getActivityTimeWindows(activity);
  if (!windows) return true;
  return windows.some((window) => isHourWithinWindow(date.getHours(), window));
}

function getTimeWindowPenalty(activity, date) {
  const windows = getActivityTimeWindows(activity);
  if (!windows || isActivityAvailableAtDate(activity, date)) {
    return 0;
  }
  return 36;
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
      if (!isActivityAvailableAtDate(activity, date)) return null;
      return {
        ...hour,
        date,
        summary: scoreActivityConditions(activity, aqi, hour, []),
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

export function getActivitySummary(activity, aqi, weather, hourly = []) {
  const nowPenalty = getTimeWindowPenalty(activity, new Date());
  const score = {
    ...scoreActivityConditions(activity, aqi, weather, hourly),
  };
  if (nowPenalty > 0) {
    score.score = clamp(score.score - nowPenalty, 0, 100);
    score.rationale = [
      `${activity.name} is usually not scheduled at this time of day.`,
      ...score.rationale,
    ].slice(0, 4);
    const tone = getScoreTone(score.score);
    score.label = tone.label;
    score.color = tone.color;
  }
  const bestTime = getBestTimeLabel(activity, aqi, hourly);
  return {
    ...score,
    bestTime,
  };
}
