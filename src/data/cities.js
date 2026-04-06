export const CITIES = [
  { name: 'Lahore', lat: 31.5204, lon: 74.3587 },
  { name: 'Karachi', lat: 24.8607, lon: 67.0011 },
  { name: 'Islamabad', lat: 33.6844, lon: 73.0479 },
  { name: 'Rawalpindi', lat: 33.5651, lon: 73.0169 },
  { name: 'Faisalabad', lat: 31.4504, lon: 73.1350 },
  { name: 'Multan', lat: 30.1575, lon: 71.5249 },
  { name: 'Peshawar', lat: 34.0151, lon: 71.5249 },
  { name: 'Quetta', lat: 30.1798, lon: 66.9750 },
  { name: 'Sialkot', lat: 32.4945, lon: 74.5229 },
  { name: 'Gujranwala', lat: 32.1877, lon: 74.1945 },
];

// Neighborhood / sub-area AQI sampling points for major cities.
// The Google Air Quality API is hyperlocal (~500m grid), so each of these points
// returns a genuinely different reading and lets us render a dense AQI field.
export const AREAS = [
  // --- Lahore ---
  { city: 'Lahore', name: 'DHA Phase 5', lat: 31.4697, lon: 74.4120 },
  { city: 'Lahore', name: 'DHA Phase 8', lat: 31.4790, lon: 74.4550 },
  { city: 'Lahore', name: 'Gulberg', lat: 31.5167, lon: 74.3434 },
  { city: 'Lahore', name: 'Model Town', lat: 31.4843, lon: 74.3229 },
  { city: 'Lahore', name: 'Johar Town', lat: 31.4697, lon: 74.2728 },
  { city: 'Lahore', name: 'Bahria Town', lat: 31.3684, lon: 74.1866 },
  { city: 'Lahore', name: 'Wapda Town', lat: 31.4452, lon: 74.2719 },
  { city: 'Lahore', name: 'Iqbal Town', lat: 31.5040, lon: 74.2860 },
  { city: 'Lahore', name: 'Faisal Town', lat: 31.4800, lon: 74.3030 },
  { city: 'Lahore', name: 'Cantt', lat: 31.5179, lon: 74.4003 },
  { city: 'Lahore', name: 'Shalimar', lat: 31.5970, lon: 74.3811 },
  { city: 'Lahore', name: 'Township', lat: 31.4491, lon: 74.3082 },
  { city: 'Lahore', name: 'Valencia', lat: 31.4068, lon: 74.2390 },

  // --- Karachi ---
  { city: 'Karachi', name: 'Clifton', lat: 24.8138, lon: 67.0300 },
  { city: 'Karachi', name: 'DHA Karachi', lat: 24.8040, lon: 67.0550 },
  { city: 'Karachi', name: 'Gulshan-e-Iqbal', lat: 24.9204, lon: 67.0906 },
  { city: 'Karachi', name: 'North Nazimabad', lat: 24.9410, lon: 67.0374 },
  { city: 'Karachi', name: 'PECHS', lat: 24.8707, lon: 67.0603 },
  { city: 'Karachi', name: 'Korangi', lat: 24.8450, lon: 67.1365 },
  { city: 'Karachi', name: 'Malir', lat: 24.8947, lon: 67.2082 },
  { city: 'Karachi', name: 'SITE', lat: 24.8738, lon: 66.9780 },
  { city: 'Karachi', name: 'Nazimabad', lat: 24.9100, lon: 67.0330 },
  { city: 'Karachi', name: 'Scheme 33', lat: 24.9300, lon: 67.1300 },
  { city: 'Karachi', name: 'Bahria Town KHI', lat: 25.0020, lon: 67.3090 },

  // --- Islamabad ---
  { city: 'Islamabad', name: 'F-6', lat: 33.7294, lon: 73.0776 },
  { city: 'Islamabad', name: 'F-7', lat: 33.7175, lon: 73.0560 },
  { city: 'Islamabad', name: 'F-8', lat: 33.7080, lon: 73.0440 },
  { city: 'Islamabad', name: 'F-10', lat: 33.6910, lon: 73.0170 },
  { city: 'Islamabad', name: 'F-11', lat: 33.6830, lon: 73.0020 },
  { city: 'Islamabad', name: 'G-9', lat: 33.6930, lon: 73.0330 },
  { city: 'Islamabad', name: 'G-11', lat: 33.6680, lon: 72.9920 },
  { city: 'Islamabad', name: 'I-8', lat: 33.6680, lon: 73.0670 },
  { city: 'Islamabad', name: 'DHA Islamabad', lat: 33.5290, lon: 73.1780 },
  { city: 'Islamabad', name: 'Bahria Phase 7', lat: 33.5340, lon: 73.0900 },

  // --- Rawalpindi ---
  { city: 'Rawalpindi', name: 'Saddar', lat: 33.5960, lon: 73.0480 },
  { city: 'Rawalpindi', name: 'Satellite Town', lat: 33.6470, lon: 73.0710 },
  { city: 'Rawalpindi', name: 'Chaklala', lat: 33.5540, lon: 73.1020 },

  // --- Faisalabad ---
  { city: 'Faisalabad', name: 'Peoples Colony', lat: 31.4180, lon: 73.0820 },
  { city: 'Faisalabad', name: 'Madina Town', lat: 31.4270, lon: 73.0920 },
  { city: 'Faisalabad', name: 'Jaranwala Road', lat: 31.4760, lon: 73.1730 },

  // --- Multan ---
  { city: 'Multan', name: 'Gulgasht', lat: 30.2390, lon: 71.4690 },
  { city: 'Multan', name: 'Cantt', lat: 30.1980, lon: 71.4750 },

  // --- Peshawar ---
  { city: 'Peshawar', name: 'University Town', lat: 34.0050, lon: 71.4950 },
  { city: 'Peshawar', name: 'Hayatabad', lat: 33.9880, lon: 71.4390 },

  // --- Quetta ---
  { city: 'Quetta', name: 'Satellite Town', lat: 30.2100, lon: 67.0100 },
];

// Convenience: merged list of all balloons to show on the map (major cities + sub-areas)
export const ALL_AQI_POINTS = [
  ...CITIES.map((c) => ({ key: c.name, label: c.name, sub: null, lat: c.lat, lon: c.lon, isMajor: true })),
  ...AREAS.map((a) => ({ key: `${a.city}:${a.name}`, label: a.name, sub: a.city, lat: a.lat, lon: a.lon, isMajor: false })),
];

export const MOTORWAYS = [
  {
    id: 'M1',
    name: 'M1 Peshawar-Islamabad',
    stops: [
      { name: 'Peshawar', lat: 34.0151, lon: 71.5249 },
      { name: 'Nowshera', lat: 34.0159, lon: 71.9747 },
      { name: 'Attock', lat: 33.7660, lon: 72.3609 },
      { name: 'Islamabad', lat: 33.6844, lon: 73.0479 },
    ],
  },
  {
    id: 'M2',
    name: 'M2 Islamabad-Lahore',
    stops: [
      { name: 'Islamabad', lat: 33.6844, lon: 73.0479 },
      { name: 'Thalian', lat: 33.4500, lon: 73.2000 },
      { name: 'Chakri', lat: 33.3500, lon: 73.1500 },
      { name: 'Bhera', lat: 32.4811, lon: 72.9083 },
      { name: 'Kharian', lat: 32.8111, lon: 73.8847 },
      { name: 'Gujranwala', lat: 32.1877, lon: 74.1945 },
      { name: 'Lahore', lat: 31.5204, lon: 74.3587 },
    ],
  },
  {
    id: 'M3',
    name: 'M3 Lahore-Abdul Hakam',
    stops: [
      { name: 'Lahore', lat: 31.5204, lon: 74.3587 },
      { name: 'Sheikhupura', lat: 31.7131, lon: 73.9850 },
      { name: 'Faisalabad', lat: 31.4504, lon: 73.1350 },
      { name: 'Abdul Hakam', lat: 30.7500, lon: 72.1167 },
    ],
  },
  {
    id: 'M4',
    name: 'M4 Abdul Hakam-Multan',
    stops: [
      { name: 'Abdul Hakam', lat: 30.7500, lon: 72.1167 },
      { name: 'Khanewal', lat: 30.3000, lon: 71.9333 },
      { name: 'Multan', lat: 30.1575, lon: 71.5249 },
    ],
  },
  {
    id: 'M9',
    name: 'M9 Karachi-Hyderabad',
    stops: [
      { name: 'Karachi', lat: 24.8607, lon: 67.0011 },
      { name: 'Hyderabad', lat: 25.3960, lon: 68.3578 },
    ],
  },
];
