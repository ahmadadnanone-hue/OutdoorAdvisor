/**
 * Design tokens — shadows.
 *
 * Use cardShadow for primary elevated surfaces, subtleShadow for rows/pills.
 * iOS renders shadowColor/shadowOpacity, Android needs `elevation` — both
 * presets include it.
 */

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
    elevation: 10,
  },
  subtle: {
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  glow: {
    // For highlighted active controls (cyan glow effect)
    shadowColor: '#38D6E8',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
};
