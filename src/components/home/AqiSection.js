import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LiveConditionsCard } from '../cards';
import AnimatedWeatherIcon from '../AnimatedWeatherIcon';
import { colors as dc } from '../../design';
import { getAqiColor, getAqiCategory, getWeatherIcon } from './homeUtils';

export default function AqiSection({ aqi, pm25, weather, weatherCurrent, locationDisplay, isUsingDeviceLocation, nightMode, settings, onInsightPress, aqiHistory }) {
  return (
    <View style={styles.section}>
      <LiveConditionsCard
        city={locationDisplay.primary}
        country={isUsingDeviceLocation ? '' : locationDisplay.secondary}
        condition={weather.description}
        tempLabel={settings.formatTempShort(weatherCurrent?.temp)}
        temp={weatherCurrent?.temp ?? null}
        feelsLike={weatherCurrent?.feelsLike ?? weatherCurrent?.temp ?? null}
        feelsLikeLabel={weatherCurrent?.feelsLike != null ? `Feels like ${settings.formatTemp(weatherCurrent.feelsLike)}` : null}
        weatherCode={weatherCurrent?.weatherCode}
        weatherIcon={getWeatherIcon(weatherCurrent?.weatherCode, nightMode)}
        weatherIconNode={<AnimatedWeatherIcon weatherCode={weatherCurrent?.weatherCode} isNight={nightMode} size={64} />}
        aqi={aqi}
        aqiCategory={getAqiCategory(aqi)}
        aqiColor={aqi != null ? getAqiColor(aqi) : dc.accentOrange}
        pm25Label={pm25 != null ? `PM2.5 ${pm25} μg/m³` : null}
        windLabel={weatherCurrent?.windSpeed != null ? settings.formatWind(weatherCurrent.windSpeed) : null}
        humidityLabel={weatherCurrent?.humidity != null ? `${weatherCurrent.humidity}%` : null}
        onPress={onInsightPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {},
});
