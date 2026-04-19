/**
 * Design tokens — typography.
 *
 * iOS-first type scale. Use these named presets instead of inline sizes.
 * Pair with colors.textPrimary / textSecondary / textMuted.
 */

export const typography = {
  // Big hero metric (like the 36° on Apple Weather, or 7.3' on Tide Guide)
  metric: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1.2,
  },
  // Screen-level H1
  screenTitle: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  // Card-level H2
  cardTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  // Sub-card heading
  cardSubtitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  // Small strong label, e.g. row label inside a card
  rowLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  // Uppercase section eyebrow ("LIVE CONDITIONS")
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  // Body copy
  body: {
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '500',
  },
  // Small secondary body
  bodySmall: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  // Caption under small controls
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  // Extra small
  micro: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
};
