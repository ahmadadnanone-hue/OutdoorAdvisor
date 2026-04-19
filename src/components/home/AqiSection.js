import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LiveConditionsCard } from '../cards';
import Icon, { ICON } from '../Icon';
import { colors as dc } from '../../design';
import { getAqiColor, getAqiCategory, getWeatherIcon } from './homeUtils';

function NightPartlyCloudyIcon() {
  return (
    <View style={styles.nightIcon}>
      <Icon name={ICON.weatherNight} size={34} color="rgba(155,200,255,0.95)" style={styles.moon} />
      <Icon name={ICON.weatherCloudy} size={48} color={dc.accentCyan} style={styles.cloud} />
    </View>
  );
}

export default function AqiSection({ aqi, pm25, weather, weatherCurrent, locationDisplay, isUsingDeviceLocation, nightMode, settings, onInsightPress, aqiHistory }) {
  return (
    <View style={styles.section}>
      <LiveConditionsCard
        city={locationDisplay.primary}
        country={isUsingDeviceLocation ? '' : locationDisplay.secondary}
        condition={weather.description}
        tempLabel={settings.formatTempShort(weatherCurrent?.temp)}
        feelsLikeLabel={weatherCurrent?.feelsLike != null ? `Feels like ${settings.formatTemp(weatherCurrent.feelsLike)}` : null}
        weatherIcon={getWeatherIcon(weatherCurrent?.weatherCode, nightMode)}
        weatherIconNode={nightMode && weatherCurrent?.weatherCode != null && weatherCurrent.weatherCode <= 3 ? <NightPartlyCloudyIcon /> : null}
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
  nightIcon: { width: 56, height: 56, position: 'relative' },
  moon: { position: 'absolute', top: 0, left: 0, zIndex: 2 },
  cloud: { position: 'absolute', bottom: 0, right: 0, zIndex: 1 },
});
