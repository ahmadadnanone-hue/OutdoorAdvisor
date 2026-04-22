import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AuthorizationRequestStatus,
  getRequestStatusForAuthorization,
  isHealthDataAvailableAsync,
  queryQuantitySamples,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';

const HEALTH_CACHE_KEY = 'outdooradvisor_health_today_v1';
const HEALTH_CACHE_TTL = 5 * 60 * 1000;

const READ_TYPES = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
];

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

function isIosHealthSupported() {
  return Platform.OS === 'ios';
}

function zeroHealthSnapshot(extra = {}) {
  return {
    steps: 0,
    distanceKm: 0,
    calories: 0,
    supported: isIosHealthSupported(),
    authorized: false,
    status: isIosHealthSupported() ? 'not-authorized' : 'unsupported',
    updatedAt: Date.now(),
    ...extra,
  };
}

async function readHealthCache() {
  try {
    const raw = await AsyncStorage.getItem(HEALTH_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function writeHealthCache(snapshot) {
  await AsyncStorage.setItem(HEALTH_CACHE_KEY, JSON.stringify(snapshot));
}

async function queryQuantityTotal(identifier, unit) {
  const samples = await queryQuantitySamples(identifier, {
    limit: -1,
    unit,
    ascending: true,
    filter: {
      date: {
        startDate: startOfToday(),
        endDate: new Date(),
      },
    },
  });

  return samples.reduce((sum, sample) => sum + (Number(sample.quantity) || 0), 0);
}

export async function initializeHealthPermissions({ prompt = true } = {}) {
  if (!isIosHealthSupported()) {
    return zeroHealthSnapshot({ supported: false, status: 'unsupported' });
  }

  try {
    const available = await isHealthDataAvailableAsync();
    if (!available) {
      return zeroHealthSnapshot({ supported: false, status: 'unavailable' });
    }

    const requestStatus = await getRequestStatusForAuthorization({ toRead: READ_TYPES });

    if (
      requestStatus === AuthorizationRequestStatus.shouldRequest &&
      !prompt
    ) {
      return zeroHealthSnapshot({ supported: true, authorized: false, status: 'not-authorized' });
    }

    if (requestStatus === AuthorizationRequestStatus.shouldRequest) {
      const granted = await requestAuthorization({ toRead: READ_TYPES });
      if (!granted) {
        return zeroHealthSnapshot({ supported: true, authorized: false, status: 'denied' });
      }
    }

    return {
      steps: null,
      distanceKm: null,
      calories: null,
      supported: true,
      authorized: true,
      status: 'authorized',
      updatedAt: Date.now(),
    };
  } catch (error) {
    return zeroHealthSnapshot({
      supported: true,
      authorized: false,
      status: 'error',
      error: error?.message || 'Health access failed',
    });
  }
}

export async function getTodayHealthSnapshot({ force = false, prompt = false } = {}) {
  if (!force) {
    const cached = await readHealthCache();
    if (cached && Date.now() - cached.updatedAt < HEALTH_CACHE_TTL) {
      return cached;
    }
  }

  const permissionState = await initializeHealthPermissions({ prompt });
  if (!permissionState.authorized) {
    const next = zeroHealthSnapshot(permissionState);
    await writeHealthCache(next);
    return next;
  }

  try {
    const [steps, distanceMeters, calories] = await Promise.all([
      queryQuantityTotal('HKQuantityTypeIdentifierStepCount', 'count'),
      queryQuantityTotal('HKQuantityTypeIdentifierDistanceWalkingRunning', 'm'),
      queryQuantityTotal('HKQuantityTypeIdentifierActiveEnergyBurned', 'kcal'),
    ]);

    const snapshot = {
      steps: Math.round(steps),
      distanceKm: Number((distanceMeters / 1000).toFixed(2)),
      calories: Math.round(calories),
      supported: true,
      authorized: true,
      status: 'authorized',
      updatedAt: Date.now(),
    };

    await writeHealthCache(snapshot);
    return snapshot;
  } catch (error) {
    const fallback = zeroHealthSnapshot({
      supported: true,
      authorized: false,
      status: 'error',
      error: error?.message || 'Could not read health samples',
    });
    await writeHealthCache(fallback);
    return fallback;
  }
}

export async function getTodaySteps(options) {
  const snapshot = await getTodayHealthSnapshot(options);
  return snapshot.steps || 0;
}

export async function getTodayDistance(options) {
  const snapshot = await getTodayHealthSnapshot(options);
  return snapshot.distanceKm || 0;
}

export async function getTodayCalories(options) {
  const snapshot = await getTodayHealthSnapshot(options);
  return snapshot.calories || 0;
}

export default function useHealthData({ prompt = false } = {}) {
  const [data, setData] = useState(zeroHealthSnapshot({ status: 'idle' }));
  const [loading, setLoading] = useState(isIosHealthSupported());

  const refresh = useCallback(async (options = {}) => {
    setLoading(true);
    const snapshot = await getTodayHealthSnapshot({ prompt, ...options });
    setData(snapshot);
    setLoading(false);
    return snapshot;
  }, [prompt]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isIosHealthSupported() || loading || data.authorized) return undefined;

    // When the app asks for Health access during startup, this follow-up refresh
    // gives the hook a chance to pick up the newly granted permission and load
    // real step data without requiring a manual reload.
    const timer = setTimeout(() => {
      refresh({ force: true, prompt: false }).catch(() => {});
    }, 1600);

    return () => clearTimeout(timer);
  }, [data.authorized, loading, refresh]);

  return {
    ...data,
    loading,
    refresh,
    requestAccess: () => refresh({ force: true, prompt: true }),
  };
}
