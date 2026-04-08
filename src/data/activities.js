// Full activity catalog. `placesQuery` is used by the Google Places Nearby Search
// to find venues for that activity around the user's location. `placesType` is an
// optional Google Places "type" (overrides keyword when set) for more accurate results.

export const ACTIVITY_CATALOG = [
  // --- Core defaults (enabled out of the box) ---
  {
    id: 'running',
    name: 'Running',
    emoji: '\u{1F3C3}',
    timeWindows: [{ startHour: 5, endHour: 23 }],
    placesQuery: 'running track',
    healthImpact:
      'Running significantly increases your breathing rate, pulling 10-20 times more air into your lungs than at rest. In polluted conditions, this means inhaling far greater quantities of fine particulate matter (PM2.5) and toxic gases deep into your respiratory system, which can cause airway inflammation, reduced lung function, and cardiovascular strain.',
    tips: [
      'Run early in the morning when pollution levels tend to be lowest.',
      'Avoid running near busy roads or industrial areas.',
      'Wear a certified N95 mask designed for exercise if air quality is poor.',
    ],
    indoorAlt:
      'Use a treadmill at home or in a gym with air filtration. High-intensity interval training (HIIT) indoors can replicate outdoor running benefits.',
  },
  {
    id: 'cricket',
    name: 'Cricket',
    emoji: '\u{1F3CF}',
    timeWindows: [{ startHour: 7, endHour: 22 }],
    placesQuery: 'cricket ground',
    healthImpact:
      'Cricket matches can last several hours outdoors, leading to prolonged exposure to pollutants. Fielding, bowling, and batting all require bursts of exertion that increase respiration. Smoggy conditions also reduce visibility, making it harder to track the ball and increasing injury risk.',
    tips: [
      'Schedule matches during times of day with better air quality.',
      'Take breaks in shaded, less polluted areas between overs.',
      'Keep hydrated to help your body flush out inhaled toxins.',
    ],
    indoorAlt: 'Practice batting in indoor nets. Use bowling machines in covered facilities. Play indoor cricket or table cricket for fun.',
  },
  {
    id: 'cycling',
    name: 'Cycling',
    emoji: '\u{1F6B4}',
    timeWindows: [{ startHour: 5, endHour: 22 }],
    placesQuery: 'cycling track',
    healthImpact:
      'Cyclists breathe heavily and are often positioned at vehicle exhaust height on roads. This combination results in very high intake of carbon monoxide, nitrogen dioxide, and particulate matter. Chronic exposure while cycling in polluted areas can lead to long-term respiratory and cardiovascular issues.',
    tips: [
      'Choose routes away from heavy traffic, such as parks or bike trails.',
      'Ride during off-peak traffic hours to minimize exhaust exposure.',
      'Use a pollution-filtering face mask rated for cycling.',
    ],
    indoorAlt: 'Use a stationary bike or indoor cycling trainer. Join virtual cycling apps like Zwift for an engaging indoor ride experience.',
  },
  {
    id: 'walking',
    name: 'Walking',
    emoji: '\u{1F6B6}',
    timeWindows: [{ startHour: 5, endHour: 23 }],
    placesType: 'park',
    placesQuery: 'park',
    healthImpact:
      'While walking involves lower exertion than running, extended walks in polluted air still expose you to harmful particulates. The elderly, children, and those with asthma are especially vulnerable. Even moderate PM2.5 levels can trigger symptoms during a 30-minute walk.',
    tips: [
      'Walk in green areas with trees, which help filter some pollutants.',
      'Avoid walking during peak traffic hours (morning and evening rush).',
      'Shorten your walk duration when AQI is elevated.',
    ],
    indoorAlt: 'Walk on an indoor track or treadmill. Shopping malls offer climate-controlled walking paths. Try indoor yoga or stretching as a low-impact alternative.',
  },
  {
    id: 'swimming',
    name: 'Swimming',
    emoji: '\u{1F3CA}',
    timeWindows: [{ startHour: 6, endHour: 22 }],
    placesQuery: 'swimming pool',
    healthImpact:
      'Outdoor swimming pools expose you to airborne pollutants while you breathe heavily during laps. Additionally, pollutants can settle on the water surface. The combination of chlorine fumes and air pollution can be particularly irritating to the respiratory system.',
    tips: [
      'Prefer indoor pools with proper ventilation and filtration systems.',
      'Avoid outdoor pools on high-AQI days, especially in the afternoon.',
      'Rinse off thoroughly after swimming to remove surface pollutants.',
    ],
    indoorAlt: 'Swim at an indoor heated pool. Aqua aerobics classes in covered facilities provide similar cardiovascular benefits.',
  },
  {
    id: 'gardening',
    name: 'Gardening',
    emoji: '\u{1F331}',
    timeWindows: [{ startHour: 6, endHour: 19 }],
    placesQuery: 'plant nursery',
    healthImpact:
      'Gardening involves extended time outdoors at ground level, where pollutant concentrations can be high. Digging and raking stir up dust that mixes with airborne PM2.5. Prolonged low-level exertion means steady inhalation of contaminated air over hours.',
    tips: [
      'Garden in the early morning when air quality tends to be better.',
      'Wear a dust mask to reduce particulate inhalation.',
      'Water soil before working to reduce dust being kicked up.',
    ],
    indoorAlt: 'Maintain indoor plants and herb gardens. Use a small indoor greenhouse setup. Try hydroponic gardening kits that work indoors.',
  },
  {
    id: 'dining',
    name: 'Outdoor Dining',
    emoji: '\u{1F37D}\u{FE0F}',
    timeWindows: [{ startHour: 12, endHour: 23 }],
    placesType: 'restaurant',
    placesQuery: 'restaurant outdoor seating',
    healthImpact:
      'Eating outdoors in polluted air means that fine particles settle on your food and are ingested along with being inhaled. Pollutants can irritate the eyes and throat, diminishing the dining experience. Children and the elderly face higher risk during prolonged outdoor meals.',
    tips: [
      'Choose restaurants with covered, enclosed patio areas.',
      'Avoid outdoor dining near busy roads or construction sites.',
      'Check the AQI before booking an outdoor reservation.',
    ],
    indoorAlt: 'Dine indoors at restaurants with good ventilation. Host meals at home with air purifiers running. Try a picnic-style indoor dinner setup.',
  },
  {
    id: 'schoolpe',
    name: 'School PE',
    emoji: '\u{1F3EB}',
    timeWindows: [{ startHour: 7, endHour: 15 }],
    placesQuery: 'school',
    healthImpact:
      "Children's lungs are still developing, making them especially vulnerable to air pollution during physical education classes. Vigorous outdoor exercise at school forces children to breathe in large amounts of polluted air, which can worsen asthma, reduce lung growth, and impair concentration for the rest of the school day.",
    tips: [
      'Schools should monitor AQI and move PE indoors on bad air days.',
      'Reduce intensity of outdoor activities when AQI exceeds 100.',
      'Ensure children with asthma have inhalers readily accessible.',
    ],
    indoorAlt: 'Conduct PE in the school gymnasium or multipurpose hall. Indoor activities like dance, yoga, stretching, and light calisthenics are excellent substitutes.',
  },
  {
    id: 'biking',
    name: 'Biking',
    emoji: '\u{1F6B2}',
    timeWindows: [{ startHour: 6, endHour: 22 }],
    placesQuery: 'bike park',
    healthImpact:
      'Recreational biking often takes place on roads and trails where vehicle emissions and dust are present. The elevated breathing rate during biking pulls pollutants deep into the lungs. Long rides in smoggy conditions can cause chest tightness, coughing, and reduced performance.',
    tips: [
      'Plan routes through parks and low-traffic neighborhoods.',
      'Bike in the early morning before pollution levels rise.',
      'Carry water and take breaks in cleaner-air spots along your route.',
    ],
    indoorAlt: 'Use a stationary bike at home or at the gym. Spin classes offer a social, high-energy indoor cycling workout.',
  },
  {
    id: 'tennis',
    name: 'Tennis',
    emoji: '\u{1F3BE}',
    timeWindows: [{ startHour: 6, endHour: 22 }],
    placesQuery: 'tennis court',
    healthImpact:
      'Tennis involves repeated sprints, quick direction changes, and heavy breathing over matches that can last one to three hours. This extended cardiovascular effort in polluted air leads to deep inhalation of PM2.5 and ozone, which can trigger asthma attacks and reduce aerobic capacity.',
    tips: [
      'Play on indoor courts when outdoor AQI is above 100.',
      'Schedule matches in the early morning or after sunset.',
      'Stay well-hydrated and take longer rest breaks between sets.',
    ],
    indoorAlt: 'Play at indoor tennis facilities. Badminton and table tennis are excellent indoor racquet alternatives that provide similar agility training.',
  },

  // --- Extras: user can add from the "More activities" sheet ---
  {
    id: 'padel',
    name: 'Padel Tennis',
    emoji: '\u{1F3BE}',
    placesQuery: 'padel court',
    healthImpact:
      'Padel is a high-intensity racquet sport combining elements of tennis and squash, played in short bursts of explosive movement. Rallies last longer than tennis and heart rates stay elevated. In polluted air, the constant sprinting within an enclosed glass court can still expose players to trapped pollutants if the court is outdoor or semi-covered.',
    tips: [
      'Prefer fully indoor padel clubs with HVAC on smoggy days.',
      'Warm up gradually — the stop-and-go nature is tough on cold airways.',
      'Hydrate between every game, not just between sets.',
    ],
    indoorAlt: 'Many padel venues in Pakistan are fully indoor — check nearby clubs below. Alternatively, play squash or table tennis.',
  },
  {
    id: 'football',
    name: 'Football',
    emoji: '\u{26BD}',
    placesQuery: 'football ground',
    healthImpact:
      'Football demands continuous running, sprinting, and jumping for 90 minutes, pushing your lungs to their peak. This makes it one of the worst sports to play in polluted air — players can inhale hundreds of liters of contaminated air in a single match.',
    tips: [
      'Postpone matches when AQI exceeds 150.',
      'Shorten halves and increase water breaks in hot or hazy conditions.',
      'Do aerobic warm-ups indoors before stepping onto the pitch.',
    ],
    indoorAlt: 'Futsal in an indoor hall gives the same skills with filtered air. Practice dribbling and passing drills at home.',
  },
  {
    id: 'basketball',
    name: 'Basketball',
    emoji: '\u{1F3C0}',
    placesQuery: 'basketball court',
    healthImpact:
      'Basketball involves explosive jumps, constant sprints, and sustained high heart rates. Outdoor courts often sit near roads and urban surfaces where PM2.5 lingers. Deep breathing through the mouth during play bypasses the nose\'s natural filtration.',
    tips: [
      'Move games to an indoor court or gymnasium when AQI > 100.',
      'Avoid playing between 2pm and 6pm in summer (heat + pollution peak).',
      'Take 60-second breathers every 5 minutes in poor air.',
    ],
    indoorAlt: 'Most gyms and university sports complexes have indoor courts. Shooting drills and dribbling practice can be done at home.',
  },
  {
    id: 'badminton',
    name: 'Badminton',
    emoji: '\u{1F3F8}',
    placesQuery: 'badminton court',
    healthImpact:
      'Badminton rallies require explosive bursts and quick recoveries, elevating heart rate sharply. Outdoor badminton is rare but where it happens, wind and pollutants both affect play. Indoor badminton is a good smog-season alternative.',
    tips: [
      'Prefer indoor halls — most competitive badminton is indoor anyway.',
      'Stretch wrists and shoulders thoroughly before rallies.',
      'Hydrate frequently even though sweating may feel minimal indoors.',
    ],
    indoorAlt: 'Almost all badminton clubs in Pakistan are indoor. See nearby courts below.',
  },
  {
    id: 'squash',
    name: 'Squash',
    emoji: '\u{1F3BE}',
    placesQuery: 'squash court',
    healthImpact:
      'Squash is one of the most cardio-intensive sports — players can burn 700-1000 calories per hour. Thankfully, squash courts are almost always indoor, shielding you from outdoor AQI, but ventilation of the court itself matters.',
    tips: [
      'Choose clubs with good HVAC — stale court air can still be unhealthy.',
      'Warm up the shoulders, hips, and calves before going full speed.',
      'Replace lost electrolytes, not just water, after a match.',
    ],
    indoorAlt: 'Squash is already indoor. On very hazardous days even stepping outside to reach the club is a concern — consider home bodyweight circuits instead.',
  },
  {
    id: 'gym',
    name: 'Gym Workout',
    emoji: '\u{1F3CB}\u{FE0F}',
    timeWindows: [{ startHour: 5, endHour: 23 }],
    placesType: 'gym',
    placesQuery: 'gym fitness center',
    healthImpact:
      'Weight training at the gym is mostly anaerobic, so the lung load is lower than running or football. However, gyms with poor ventilation can accumulate dust and CO2, and outdoor-adjacent gyms pull in polluted air through their AC intakes.',
    tips: [
      'Pick a gym with a visible HEPA/filtration system or good airflow.',
      'Avoid gyms right next to major roads.',
      'Rest periods indoors still count — you\'re breathing the ambient air.',
    ],
    indoorAlt: 'Bodyweight routines at home with windows shut and an air purifier running are a great alternative on hazardous days.',
  },
  {
    id: 'yoga',
    name: 'Yoga',
    emoji: '\u{1F9D8}',
    placesQuery: 'yoga studio',
    healthImpact:
      'Yoga emphasizes deep, controlled breathing (pranayama), so practicing outdoors in polluted air means pulling large volumes of PM2.5 straight into the lungs. Paradoxically, the better you breathe during yoga, the worse polluted air affects you.',
    tips: [
      'Always practice indoors on smoggy days.',
      'Use an air purifier in your yoga room if possible.',
      'Skip outdoor park sessions when AQI exceeds 100.',
    ],
    indoorAlt: 'Home yoga with a mat and a YouTube class, or join an indoor studio with filtered air.',
  },
  {
    id: 'golf',
    name: 'Golf',
    emoji: '\u{26F3}',
    placesQuery: 'golf course',
    healthImpact:
      'A round of golf is 4-5 hours of moderate activity spent entirely outdoors. While walking speed is low, total exposure time is very high, so hazardous air adds up over a round. Golf courses are usually greener and slightly cleaner than city centers.',
    tips: [
      'Start early — morning air is usually cleaner and cooler.',
      'Use a cart on hazy days to cut inhalation time.',
      'Keep a hydration bottle in the bag and drink on every tee box.',
    ],
    indoorAlt: 'Indoor golf simulators and driving bays exist in Lahore and Karachi. Putting practice on an indoor mat is zero-pollution.',
  },
  {
    id: 'hiking',
    name: 'Hiking',
    emoji: '\u{1F97E}',
    placesQuery: 'hiking trail',
    healthImpact:
      'Hikes in Pakistan\'s hill stations (Margalla, Murree, Hunza) take you to higher elevation where air is usually much cleaner than the cities. But urban fringe trails (Margalla trails during smog season, Hub valley near Karachi) can be just as bad as the city itself.',
    tips: [
      'Check elevation — above 1500m you usually escape the smog layer.',
      'Margalla Trail 5 and Daman-e-Koh are cleaner than city centers but check AQI.',
      'Carry more water than you think — dry winter air dehydrates fast.',
    ],
    indoorAlt: 'Stair machines and inclined treadmills mimic hiking cardio load in a filtered environment.',
  },
  {
    id: 'skateboarding',
    name: 'Skateboarding',
    emoji: '\u{1F6F9}',
    placesQuery: 'skate park',
    healthImpact:
      'Skateboarding is a mix of explosive effort and rest. Tricks demand short bursts of heavy breathing through the mouth. Skate parks are usually outdoor and often near roads, so exposure is meaningful on polluted days.',
    tips: [
      'Session in the early morning, avoid evening rush hour.',
      'Wear a buff or mask between tricks to reduce intake.',
      'Skip big sessions when AQI > 150.',
    ],
    indoorAlt: 'A few indoor skateparks are emerging. Otherwise, balance boards and flat-ground trick practice at home.',
  },
  {
    id: 'rock_climbing',
    name: 'Rock Climbing',
    emoji: '\u{1F9D7}',
    placesQuery: 'climbing gym',
    healthImpact:
      'Bouldering and sport climbing involve high-effort bursts and long rests. Outdoor climbing is increasingly popular in Pakistan\'s northern areas where air is clean. Indoor climbing gyms in cities are a smog-safe alternative.',
    tips: [
      'Indoor gyms insulate you from outdoor AQI — prefer them in winter.',
      'Chalk dust is itself an irritant — wear a light buff indoors if needed.',
      'Warm up shoulders and fingers thoroughly.',
    ],
    indoorAlt: 'Indoor bouldering walls exist in Islamabad and Lahore. Hangboard training at home builds finger strength anywhere.',
  },
  {
    id: 'martial_arts',
    name: 'Martial Arts',
    emoji: '\u{1F94B}',
    placesQuery: 'martial arts school',
    healthImpact:
      'Karate, taekwondo, BJJ, MMA and boxing classes are usually indoor, so outdoor AQI has limited direct impact. However, sparring and pad work spike heart rate dramatically — good ventilation in the dojo matters.',
    tips: [
      'Choose a dojo with visible ventilation or open windows on clean days.',
      'Hydrate between rounds — easy to forget in a focused session.',
      'Warm up the neck and spine carefully before throws or rolls.',
    ],
    indoorAlt: 'Shadow boxing and kata practice at home with an air purifier on works on the worst smog days.',
  },
  {
    id: 'horse_riding',
    name: 'Horse Riding',
    emoji: '\u{1F434}',
    placesQuery: 'horse riding club',
    healthImpact:
      'Riding itself is moderate exertion but grooming, mucking, and handling horses involves dust exposure (hay, sand, manure) on top of outdoor AQI. Riders with asthma should be especially careful on hazy days.',
    tips: [
      'Wear a dust mask while grooming the horse.',
      'Ride in arenas with settled footing rather than dusty trails on smoggy days.',
      'Rinse hands and face after the session.',
    ],
    indoorAlt: 'Some clubs have indoor arenas with watered ground. Stable visits (no riding) on the worst days.',
  },
  {
    id: 'bowling',
    name: 'Bowling',
    emoji: '\u{1F3B3}',
    placesQuery: 'bowling alley',
    healthImpact:
      'Bowling is indoor and low-intensity, so direct AQI impact is minimal. The main concern is the air quality inside the alley itself — old ventilation systems and smoking-adjacent areas can drop IAQ significantly.',
    tips: [
      'Choose modern bowling alleys with good HVAC.',
      'Avoid eating food next to the lanes if the place has poor airflow.',
      'Warm up the wrist and shoulder before heavy throws.',
    ],
    indoorAlt: 'Bowling is already indoor. Mini-bowling sets for home provide a casual alternative.',
  },
  {
    id: 'ice_skating',
    name: 'Ice Skating',
    emoji: '\u{26F8}\u{FE0F}',
    placesQuery: 'ice skating rink',
    healthImpact:
      'Ice rinks are indoor and usually well-ventilated due to refrigeration needs. Cold dry air can still irritate airways in people with asthma. Direct AQI impact is low.',
    tips: [
      'Dress in thin layers — you\'ll warm up fast once skating.',
      'Skaters with asthma should carry an inhaler on-rink.',
      'Hydrate — cold air feels dry and you lose water quickly.',
    ],
    indoorAlt: 'Roller skating at home or in a parking lot as a hot-weather substitute.',
  },
  {
    id: 'fishing',
    name: 'Fishing',
    emoji: '\u{1F3A3}',
    placesQuery: 'fishing spot lake',
    healthImpact:
      'Fishing is low-intensity but long-duration — you might spend 4-8 hours outdoors. Lakeside and riverside air is often slightly cleaner than city air, but sitting still for hours in any polluted environment still adds up.',
    tips: [
      'Pick lakes outside city limits — AQI drops fast once you leave urban areas.',
      'Bring sun protection and plenty of water.',
      'Avoid fishing in midday heat during summer.',
    ],
    indoorAlt: 'Fly tying and tackle maintenance at home scratch the fishing itch on bad days.',
  },
  {
    id: 'paragliding',
    name: 'Paragliding',
    emoji: '\u{1FA82}',
    placesQuery: 'paragliding',
    healthImpact:
      'Paragliding launches from high elevation (Khanpur, Pir Sohawa, etc.) where air is almost always cleaner than cities. Wind conditions matter more than AQI for safety. Moderate physical exertion during takeoff and landing.',
    tips: [
      'Always check wind forecasts and cloud base before flying.',
      'Altitudes above 2000m put you above the smog inversion layer.',
      'Layer up — it gets cold fast in the air.',
    ],
    indoorAlt: 'Simulators exist at some clubs. Wind tunnel skydiving is a distant cousin.',
  },
  {
    id: 'dance',
    name: 'Dance',
    emoji: '\u{1F483}',
    placesQuery: 'dance studio',
    healthImpact:
      'Dance classes range from gentle to cardio-intensive. Most are held indoors in studios with mirror walls, which vary wildly in ventilation quality. High-tempo styles (Zumba, hip-hop) push heart rate like running.',
    tips: [
      'Check studio ventilation — sealed rooms build up CO2 fast.',
      'Hydrate every 15 minutes during high-tempo classes.',
      'Warm up the ankles and knees to avoid injury.',
    ],
    indoorAlt: 'Dance along to videos at home — zero commute, zero AQI exposure.',
  },
];

// IDs enabled by default (the original 10 activities)
export const DEFAULT_ENABLED_ACTIVITY_IDS = [
  'running', 'cricket', 'cycling', 'walking', 'swimming',
  'gardening', 'dining', 'schoolpe', 'biking', 'tennis', 'gym',
];

export function getActivityById(id) {
  return ACTIVITY_CATALOG.find((a) => a.id === id) || null;
}
