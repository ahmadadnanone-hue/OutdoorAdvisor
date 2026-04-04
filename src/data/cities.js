export const CITIES = [
  { name: 'Lahore', lat: 31.5204, lon: 74.3587, waqiName: 'lahore' },
  { name: 'Karachi', lat: 24.8607, lon: 67.0011, waqiName: 'karachi' },
  { name: 'Islamabad', lat: 33.6844, lon: 73.0479, waqiName: 'islamabad' },
  { name: 'Rawalpindi', lat: 33.5651, lon: 73.0169, waqiName: 'rawalpindi' },
  { name: 'Faisalabad', lat: 31.4504, lon: 73.1350, waqiName: 'faisalabad' },
  { name: 'Multan', lat: 30.1575, lon: 71.5249, waqiName: 'multan' },
  { name: 'Peshawar', lat: 34.0151, lon: 71.5249, waqiName: 'peshawar' },
  { name: 'Quetta', lat: 30.1798, lon: 66.9750, waqiName: 'quetta' },
  { name: 'Sialkot', lat: 32.4945, lon: 74.5229, waqiName: 'sialkot' },
  { name: 'Gujranwala', lat: 32.1877, lon: 74.1945, waqiName: 'gujranwala' },
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
