import { CITIES, TRAVEL_ROUTES } from '../data/cities';

const ROUTE_ALERT_KEYWORDS = {
  E35: ['hazara', 'mansehra', 'abbottabad', 'haripur', 'burhan'],
  KKH: ['karakoram', 'gilgit', 'chilas', 'besham', 'mansehra', 'abbottabad'],
  N15: ['naran', 'kaghan', 'balakot', 'babusar', 'mansehra'],
  MURREE: ['murree', 'bhurban', 'patriata', 'kohala'],
  SWAT: ['swat', 'mingora', 'kalam', 'malakand', 'mardan'],
  M1: ['m1', 'peshawar', 'nowshera', 'attock', 'islamabad'],
  M2: ['m2', 'islamabad', 'chakri', 'bhera', 'kharian', 'gujranwala', 'lahore'],
  M3: ['m3', 'lahore', 'sheikhupura', 'faisalabad', 'abdul hakam'],
  M4: ['m4', 'abdul hakam', 'khanewal', 'multan'],
  M5: ['m5', 'multan', 'jalalpur pirwala', 'rahim yar khan', 'ghotki', 'sukkur'],
  M9: ['m9', 'hyderabad', 'nooriabad', 'karachi'],
};

const NHMP_ROUTE_ALIASES = {
  M1: ['m1', 'peshawar-islamabad', 'peshawar to islamabad', 'islamabad to peshawar'],
  M2: ['m2', 'islamabad-lahore', 'islamabad to lahore', 'lahore to islamabad'],
  M3: ['m3', 'lahore-abdul hakam', 'lahore to abdul hakam', 'abdul hakam to lahore'],
  M4: ['m4', 'abdul hakam-multan', 'abdul hakam to multan', 'multan to abdul hakam'],
  M5: ['m5', 'multan-sukkur', 'multan to sukkur', 'sukkur to multan'],
  M9: ['m9', 'karachi-hyderabad', 'karachi to hyderabad', 'hyderabad to karachi'],
  E35: ['e35', 'hazara expressway', 'burhan to thakot', 'islamabad to mansehra'],
  MURREE: ['n75', 'murree', 'islamabad-murree', 'kohala'],
  SWAT: ['swat', 'mingora', 'kalam', 'malakand'],
  KKH: ['karakoram highway', 'gilgit', 'chilas', 'besham'],
  N15: ['n15', 'naran', 'kaghan', 'babusar'],
};

function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeStop(stop) {
  return {
    ...stop,
    key: normalizeName(stop.name),
  };
}

function dedupeBy(items, getKey) {
  const seen = new Set();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getSegment(route, fromName, toName) {
  const normalizedStops = route.stops.map(normalizeStop);
  const fromIndex = normalizedStops.findIndex((stop) => stop.key === normalizeName(fromName));
  const toIndex = normalizedStops.findIndex((stop) => stop.key === normalizeName(toName));

  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return null;

  const ascending = fromIndex < toIndex;
  const sliced = ascending
    ? normalizedStops.slice(fromIndex, toIndex + 1)
    : normalizedStops.slice(toIndex, fromIndex + 1).reverse();

  return {
    routeId: route.id,
    routeName: route.name,
    routeKind: route.kind,
    emoji: route.emoji,
    from: sliced[0].name,
    to: sliced[sliced.length - 1].name,
    stops: sliced,
    sourceRoute: route,
  };
}

export function getPlannerCityOptions() {
  const routeStops = TRAVEL_ROUTES.flatMap((route) => route.stops);
  const merged = dedupeBy([...routeStops, ...CITIES], (item) => normalizeName(item.name));

  return merged
    .map((item) => ({
      name: item.name,
      lat: item.lat,
      lon: item.lon,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getPlannerQuickPairs() {
  return [
    { from: 'Lahore', to: 'Islamabad' },
    { from: 'Islamabad', to: 'Murree' },
    { from: 'Islamabad', to: 'Mansehra' },
    { from: 'Multan', to: 'Sukkur' },
    { from: 'Hyderabad', to: 'Karachi' },
  ];
}

export function buildPlannerCandidates(fromName, toName) {
  if (!fromName || !toName || normalizeName(fromName) === normalizeName(toName)) return [];

  const direct = [];
  for (const route of TRAVEL_ROUTES) {
    const segment = getSegment(route, fromName, toName);
    if (!segment) continue;

    direct.push({
      id: `${route.id}:${normalizeName(fromName)}:${normalizeName(toName)}`,
      kind: 'direct',
      title: `${segment.routeName}`,
      summary: `${segment.from} to ${segment.to}`,
      legs: [segment],
    });
  }

  const transfers = [];
  for (const firstRoute of TRAVEL_ROUTES) {
    const firstNormalizedStops = firstRoute.stops.map(normalizeStop);
    const originIndex = firstNormalizedStops.findIndex((stop) => stop.key === normalizeName(fromName));
    if (originIndex === -1) continue;

    for (const secondRoute of TRAVEL_ROUTES) {
      if (secondRoute.id === firstRoute.id) continue;
      const secondNormalizedStops = secondRoute.stops.map(normalizeStop);
      const destinationIndex = secondNormalizedStops.findIndex((stop) => stop.key === normalizeName(toName));
      if (destinationIndex === -1) continue;

      const sharedStops = firstNormalizedStops.filter((stop) =>
        secondNormalizedStops.some((secondStop) => secondStop.key === stop.key)
      );

      for (const sharedStop of sharedStops) {
        if (sharedStop.key === normalizeName(fromName) || sharedStop.key === normalizeName(toName)) continue;

        const firstLeg = getSegment(firstRoute, fromName, sharedStop.name);
        const secondLeg = getSegment(secondRoute, sharedStop.name, toName);
        if (!firstLeg || !secondLeg) continue;

        transfers.push({
          id: `${firstRoute.id}:${secondRoute.id}:${normalizeName(fromName)}:${normalizeName(sharedStop.name)}:${normalizeName(toName)}`,
          kind: 'transfer',
          title: `${firstLeg.routeName} then ${secondLeg.routeName}`,
          summary: `Transfer at ${sharedStop.name}`,
          legs: [firstLeg, secondLeg],
        });
      }
    }
  }

  return dedupeBy([...direct, ...transfers], (item) => item.id).slice(0, 6);
}

function findNhmpRouteMatch(route, advisories) {
  const haystackAliases = [
    route.id.toLowerCase(),
    route.name.toLowerCase(),
    ...(NHMP_ROUTE_ALIASES[route.id] || []),
    ...route.stops.map((stop) => stop.name.toLowerCase()),
  ];

  return advisories.find((advisory) => {
    const haystack = `${advisory.route || ''} ${advisory.sector || ''} ${advisory.status || ''}`.toLowerCase();
    return haystackAliases.some((alias) => haystack.includes(alias));
  }) || null;
}

function findRelevantPmdAlerts(route, alerts) {
  const keywords = [...new Set([
    ...(ROUTE_ALERT_KEYWORDS[route.id] || []),
    route.name.toLowerCase(),
    ...route.stops.map((stop) => stop.name.toLowerCase()),
  ])];

  return alerts.filter((alert) => {
    const text = String(alert || '').toLowerCase();
    return keywords.some((keyword) => text.includes(keyword));
  });
}

function isFog(weatherCode) {
  return weatherCode === 45 || weatherCode === 48;
}

function isRain(weatherCode) {
  return weatherCode >= 61 && weatherCode <= 82;
}

function getStopRisk(stop) {
  let risk = 0;

  if (stop?.aqi != null) {
    if (stop.aqi >= 200) risk += 18;
    else if (stop.aqi >= 150) risk += 12;
    else if (stop.aqi >= 100) risk += 6;
  }

  if (isFog(stop?.weatherCode)) risk += 12;
  else if (isRain(stop?.weatherCode)) risk += 7;

  if ((stop?.windSpeed ?? 0) >= 28) risk += 5;

  return risk;
}

function getLegRisk(leg, nhmpData, pmdAlerts, stopConditions) {
  const advisory = findNhmpRouteMatch(leg.sourceRoute, nhmpData);
  const weatherAlerts = findRelevantPmdAlerts(leg.sourceRoute, pmdAlerts);
  const stopRisk = leg.stops.reduce((sum, stop) => {
    const key = `${stop.lat.toFixed(3)}:${stop.lon.toFixed(3)}`;
    return sum + getStopRisk(stopConditions[key]);
  }, 0);

  let advisoryRisk = 0;
  if (advisory?.severity === 'closed') advisoryRisk += 100;
  else if (advisory?.severity === 'fog') advisoryRisk += 72;
  else if (advisory?.severity === 'rain') advisoryRisk += 54;
  else if (advisory?.severity === 'warning') advisoryRisk += 46;
  else if (advisory?.severity === 'cloudy') advisoryRisk += 18;
  else if (advisory?.severity === 'clear') advisoryRisk -= 12;

  return {
    advisory,
    weatherAlerts,
    stopRisk,
    totalRisk: advisoryRisk + Math.min(24, weatherAlerts.length * 8) + stopRisk,
  };
}

export function scorePlannerCandidates(candidates, nhmpData, pmdAlerts, stopConditions) {
  return candidates
    .map((candidate) => {
      const legs = candidate.legs.map((leg) => ({
        ...leg,
        metrics: getLegRisk(leg, nhmpData, pmdAlerts, stopConditions),
      }));

      const totalRisk = legs.reduce((sum, leg) => sum + leg.metrics.totalRisk, 0) + (candidate.kind === 'transfer' ? 12 : 0);
      const worstAdvisory = legs.find((leg) => leg.metrics.advisory?.severity === 'closed')
        || legs.find((leg) => leg.metrics.advisory?.severity === 'fog')
        || legs.find((leg) => leg.metrics.advisory?.severity === 'rain')
        || legs.find((leg) => leg.metrics.advisory?.severity === 'warning')
        || null;
      const allAlerts = legs.flatMap((leg) => leg.metrics.weatherAlerts);

      let recommendation = 'Low caution';
      let tone = '#22C55E';
      if (totalRisk >= 100) {
        recommendation = 'High caution';
        tone = '#EF4444';
      } else if (totalRisk >= 55) {
        recommendation = 'Go with care';
        tone = '#F97316';
      } else if (totalRisk >= 25) {
        recommendation = 'Some caution';
        tone = '#EAB308';
      }

      const reasons = [];
      if (worstAdvisory?.metrics?.advisory?.status) {
        reasons.push(worstAdvisory.metrics.advisory.status);
      }
      if (allAlerts[0]) {
        reasons.push(allAlerts[0]);
      }

      const highestAqiStop = candidate.legs
        .flatMap((leg) => leg.stops)
        .map((stop) => {
          const key = `${stop.lat.toFixed(3)}:${stop.lon.toFixed(3)}`;
          return {
            stop,
            aqi: stopConditions[key]?.aqi ?? null,
          };
        })
        .filter((item) => item.aqi != null)
        .sort((a, b) => b.aqi - a.aqi)[0];

      if (highestAqiStop?.aqi >= 100) {
        reasons.push(`${highestAqiStop.stop.name} AQI ${highestAqiStop.aqi}`);
      }

      return {
        ...candidate,
        legs,
        totalRisk,
        recommendation,
        tone,
        reasons,
      };
    })
    .sort((a, b) => a.totalRisk - b.totalRisk || a.legs.length - b.legs.length || a.title.localeCompare(b.title));
}
