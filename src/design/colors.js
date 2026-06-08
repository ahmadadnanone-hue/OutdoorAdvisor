import { DynamicColorIOS, Platform } from 'react-native';

const adaptive = (light, dark) => (
  Platform.OS === 'ios' && typeof DynamicColorIOS === 'function'
    ? DynamicColorIOS({ light, dark })
    : dark
);

/**
 * Design tokens — colors.
 *
 * Tide Guide-inspired atmospheric palette. Slightly lighter than the first
 * dark pass so screens feel premium and airy instead of heavy.
 *
 * DO NOT inline `rgba(...)` in screens or components — import from here.
 */

export const colors = {
  // Gradient stops (top → mid → bottom)
  bgTop: '#2A3343',
  bgMid: '#3B4E68',
  bgBottom: '#58739A',

  // Background graphics / blobs
  blobCyan: 'rgba(122, 178, 255, 0.12)',
  blobTeal: 'rgba(126, 222, 232, 0.10)',
  ringDark: 'rgba(8, 11, 19, 0.34)',
  ringSoft: 'rgba(255, 255, 255, 0.14)',
  orbDark: 'rgba(7, 10, 17, 0.66)',
  orbLight: 'rgba(255, 255, 255, 0.08)',

  // Glass surfaces
  cardGlassSoft: adaptive('rgba(255, 255, 255, 0.46)', 'rgba(255, 255, 255, 0.07)'),
  cardGlass: adaptive('rgba(255, 255, 255, 0.58)', 'rgba(255, 255, 255, 0.11)'),
  cardGlassStrong: adaptive('rgba(255, 255, 255, 0.72)', 'rgba(255, 255, 255, 0.18)'),
  tabBarGlass: 'rgba(18, 27, 42, 0.58)',
  tabBarActive: 'rgba(127, 178, 255, 0.24)',
  cardStroke: adaptive('rgba(40, 62, 84, 0.22)', 'rgba(255, 255, 255, 0.24)'),
  cardStrokeSoft: adaptive('rgba(40, 62, 84, 0.14)', 'rgba(255, 255, 255, 0.14)'),
  cardHighlight: adaptive('rgba(255, 255, 255, 0.64)', 'rgba(255, 255, 255, 0.18)'),
  pressedHighlight: adaptive('rgba(45, 88, 132, 0.10)', 'rgba(255, 255, 255, 0.12)'),

  // Text
  textPrimary: adaptive('#24364B', '#F5F8FA'),
  textSecondary: adaptive('rgba(36, 54, 75, 0.76)', 'rgba(245, 248, 250, 0.72)'),
  textMuted: adaptive('rgba(36, 54, 75, 0.58)', 'rgba(245, 248, 250, 0.56)'),

  // Accents
  accentBlue: '#7FB2FF',
  accentBlueGlow: 'rgba(127, 178, 255, 0.38)',
  accentBlueBg: 'rgba(127, 178, 255, 0.18)',
  accentCyan: adaptive('#2268B7', '#9BC8FF'),
  accentCyanGlow: adaptive('rgba(34, 104, 183, 0.30)', 'rgba(155, 200, 255, 0.42)'),
  accentCyanBg: adaptive('rgba(34, 104, 183, 0.12)', 'rgba(155, 200, 255, 0.22)'),
  accentCyanSoftBg: adaptive('rgba(34, 104, 183, 0.12)', 'rgba(155, 200, 255, 0.13)'),
  accentCyanSoftStroke: adaptive('rgba(34, 104, 183, 0.26)', 'rgba(155, 200, 255, 0.27)'),
  accentCyanTrack: adaptive('rgba(34, 104, 183, 0.50)', 'rgba(155, 200, 255, 0.53)'),
  accentGreen: '#8FF0B7',
  accentYellow: '#FFD874',
  accentOrange: '#FFAF66',
  accentRed: '#FF7A86',

  // Semantic glass tints (translucent card fills)
  dangerGlass: 'rgba(255, 122, 134, 0.16)',
  dangerStroke: 'rgba(255, 122, 134, 0.34)',
  warningGlass: 'rgba(255, 175, 102, 0.16)',
  warningStroke: 'rgba(255, 175, 102, 0.34)',
  successGlass: 'rgba(143, 240, 183, 0.14)',
  successStroke: 'rgba(143, 240, 183, 0.30)',
  infoGlass: 'rgba(127, 178, 255, 0.16)',
  infoStroke: 'rgba(127, 178, 255, 0.32)',
};

export const gradient = {
  screen: ['#2A3343', '#3B4E68', '#58739A'],
  screenStart: { x: 0.5, y: 0 },
  screenEnd: { x: 0.5, y: 1 },
  lightScreen: ['#71C1F3', '#DDF3FF', '#FFFFFF'],
  lightScreenStart: { x: 0.5, y: 0 },
  lightScreenEnd: { x: 0.5, y: 1 },
};

/**
 * Status → color helpers so decision/risk UIs stay consistent.
 */
export function statusColor(status) {
  switch (status) {
    case 'go':
    case 'good':
    case 'success':
      return { tint: colors.successGlass, stroke: colors.successStroke, fg: colors.accentGreen };
    case 'caution':
    case 'warning':
      return { tint: colors.warningGlass, stroke: colors.warningStroke, fg: colors.accentOrange };
    case 'danger':
    case 'avoid':
      return { tint: colors.dangerGlass, stroke: colors.dangerStroke, fg: colors.accentRed };
    case 'info':
    default:
      return { tint: colors.infoGlass, stroke: colors.infoStroke, fg: colors.accentCyan };
  }
}
