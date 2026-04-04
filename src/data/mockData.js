export const mockAqiData = {
  Lahore: { aqi: 180, pm25: 112.5, pm10: 165.0, category: 'Unhealthy' },
  Karachi: { aqi: 95, pm25: 38.2, pm10: 72.4, category: 'Moderate' },
  Islamabad: { aqi: 75, pm25: 24.8, pm10: 58.1, category: 'Moderate' },
  Rawalpindi: { aqi: 88, pm25: 31.5, pm10: 64.3, category: 'Moderate' },
  Faisalabad: { aqi: 155, pm25: 78.4, pm10: 130.2, category: 'Unhealthy for Sensitive Groups' },
  Multan: { aqi: 140, pm25: 65.7, pm10: 118.9, category: 'Unhealthy for Sensitive Groups' },
  Peshawar: { aqi: 165, pm25: 90.3, pm10: 142.6, category: 'Unhealthy' },
  Quetta: { aqi: 60, pm25: 15.4, pm10: 45.8, category: 'Moderate' },
  Sialkot: { aqi: 120, pm25: 52.1, pm10: 98.7, category: 'Unhealthy for Sensitive Groups' },
  Gujranwala: { aqi: 145, pm25: 70.2, pm10: 125.4, category: 'Unhealthy for Sensitive Groups' },
};

const generateWeekForecast = (baseMax, baseMin, codes) =>
  Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return {
      date: date.toISOString().split('T')[0],
      maxTemp: baseMax + Math.round((Math.random() - 0.5) * 6),
      minTemp: baseMin + Math.round((Math.random() - 0.5) * 4),
      weatherCode: codes[i % codes.length],
    };
  });

export const mockWeatherData = {
  Lahore: {
    temp: 34,
    feelsLike: 38,
    humidity: 55,
    windSpeed: 12,
    weatherCode: 1,
    daily: generateWeekForecast(35, 22, [0, 1, 2, 1, 61, 3, 0]),
  },
  Karachi: {
    temp: 32,
    feelsLike: 35,
    humidity: 72,
    windSpeed: 18,
    weatherCode: 2,
    daily: generateWeekForecast(33, 26, [2, 1, 0, 0, 1, 2, 3]),
  },
  Islamabad: {
    temp: 28,
    feelsLike: 30,
    humidity: 48,
    windSpeed: 10,
    weatherCode: 0,
    daily: generateWeekForecast(29, 16, [0, 1, 61, 63, 2, 1, 0]),
  },
  Rawalpindi: {
    temp: 27,
    feelsLike: 29,
    humidity: 50,
    windSpeed: 11,
    weatherCode: 1,
    daily: generateWeekForecast(28, 15, [1, 2, 61, 63, 2, 0, 1]),
  },
  Faisalabad: {
    temp: 36,
    feelsLike: 40,
    humidity: 42,
    windSpeed: 14,
    weatherCode: 0,
    daily: generateWeekForecast(37, 24, [0, 0, 1, 2, 0, 1, 0]),
  },
  Multan: {
    temp: 38,
    feelsLike: 42,
    humidity: 35,
    windSpeed: 16,
    weatherCode: 0,
    daily: generateWeekForecast(40, 26, [0, 0, 1, 0, 0, 2, 1]),
  },
  Peshawar: {
    temp: 30,
    feelsLike: 33,
    humidity: 40,
    windSpeed: 8,
    weatherCode: 45,
    daily: generateWeekForecast(31, 18, [45, 1, 0, 2, 1, 0, 0]),
  },
  Quetta: {
    temp: 22,
    feelsLike: 20,
    humidity: 28,
    windSpeed: 22,
    weatherCode: 3,
    daily: generateWeekForecast(24, 8, [3, 2, 1, 0, 0, 1, 2]),
  },
  Sialkot: {
    temp: 33,
    feelsLike: 36,
    humidity: 58,
    windSpeed: 9,
    weatherCode: 2,
    daily: generateWeekForecast(34, 21, [2, 1, 61, 80, 3, 1, 0]),
  },
  Gujranwala: {
    temp: 35,
    feelsLike: 39,
    humidity: 52,
    windSpeed: 11,
    weatherCode: 1,
    daily: generateWeekForecast(36, 23, [1, 0, 2, 1, 61, 2, 0]),
  },
};
