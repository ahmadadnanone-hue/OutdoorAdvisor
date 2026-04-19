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
  cardGlassSoft: 'rgba(255, 255, 255, 0.07)',
  cardGlass: 'rgba(255, 255, 255, 0.11)',
  cardGlassStrong: 'rgba(255, 255, 255, 0.18)',
  tabBarGlass: 'rgba(18, 27, 42, 0.58)',
  tabBarActive: 'rgba(127, 178, 255, 0.24)',
  cardStroke: 'rgba(255, 255, 255, 0.24)',
  cardStrokeSoft: 'rgba(255, 255, 255, 0.14)',
  cardHighlight: 'rgba(255, 255, 255, 0.18)',
  pressedHighlight: 'rgba(255, 255, 255, 0.12)',

  // Text
  textPrimary: '#F5F8FA',
  textSecondary: 'rgba(245, 248, 250, 0.72)',
  textMuted: 'rgba(245, 248, 250, 0.56)',

  // Accents
  accentBlue: '#7FB2FF',
  accentBlueGlow: 'rgba(127, 178, 255, 0.38)',
  accentBlueBg: 'rgba(127, 178, 255, 0.18)',
  accentCyan: '#9BC8FF',
  accentCyanGlow: 'rgba(155, 200, 255, 0.42)',
  accentCyanBg: 'rgba(155, 200, 255, 0.22)',
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
  screen: [colors.bgTop, colors.bgMid, colors.bgBottom],
  screenStart: { x: 0.15, y: 0 },
  screenEnd: { x: 0.82, y: 1 },
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
