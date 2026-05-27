export const SEEDED_PREMIUM_EMAILS = [
  'ahmadadnanone@gmail.com',
  'saqibmasoodcma@google.com',
  'baburfaruq@gmail.com',
  'tipu0002017@gmail.com',
  'jameelayesha86@gmail.com',
];

export function normalizePremiumEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function parsePremiumEmailAllowlist(input) {
  return String(input || '')
    .split(',')
    .map((value) => normalizePremiumEmail(value))
    .filter(Boolean);
}

export function getPremiumEmailAllowlist(input) {
  return [
    ...new Set([
      ...SEEDED_PREMIUM_EMAILS.map((value) => normalizePremiumEmail(value)),
      ...parsePremiumEmailAllowlist(input),
    ]),
  ];
}
