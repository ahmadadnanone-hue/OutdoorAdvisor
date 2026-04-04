import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export default function CircularGauge({
  value = 0,
  maxValue = 100,
  unit = '',
  size = 120,
  color = '#3B82F6',
  backgroundColor = '#E5E7EB',
}) {
  const strokeWidth = Math.max(size * 0.1, 10);
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;

  // We use a full circle but only show the top half via rotation + dasharray
  const circumference = 2 * Math.PI * radius;
  const halfCircumference = circumference / 2;

  const ratio = Math.min(Math.max(value / maxValue, 0), 1);
  const filledLength = halfCircumference * ratio;

  // rotate -180 so the dash starts from the left, going right across the top
  // dasharray: [half-circumference visible, half-circumference hidden] for background
  // For the fill: [filledLength visible, rest hidden]

  return (
    <View style={[styles.container, { width: size, height: size * 0.58 }]}>
      <Svg width={size} height={size} style={{ marginTop: -(size * 0.42) }}>
        {/* Background track - top semicircle */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${halfCircumference} ${halfCircumference}`}
          strokeLinecap="round"
          transform={`rotate(180 ${cx} ${cy})`}
        />
        {/* Filled portion */}
        {ratio > 0 && (
          <Circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${filledLength} ${circumference - filledLength}`}
            strokeLinecap="round"
            rotation={180}
            origin={`${cx}, ${cy}`}
          />
        )}
      </Svg>

      {/* Centered value + unit */}
      <View style={styles.labelContainer}>
        <Text style={[styles.valueText, { fontSize: size * 0.26, color }]}>
          {Math.round(value)}
        </Text>
        {unit !== '' && (
          <Text style={[styles.unitText, { fontSize: size * 0.12, color }]}>
            {unit}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
    overflow: 'hidden',
  },
  labelContainer: {
    position: 'absolute',
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  valueText: {
    fontWeight: '700',
  },
  unitText: {
    opacity: 0.8,
    marginTop: -2,
  },
});
