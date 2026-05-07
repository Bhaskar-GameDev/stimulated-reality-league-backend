const moment = require('moment-timezone');
const { getRandomVenue } = require('./venues');

const TIME_SLOTS = {
  AFTERNOON: "15:30",
  EVENING: "19:30",
  NIGHT: "19:00",
  DAY: "13:00"
};

const ENVIRONMENTAL_EFFECTS = {
  night: {
    dew: 0.8, // High dew factor
    swing: 1.2, // More swing in early innings
    spinAssistance: 0.7, // Less spin assistance due to moisture
    chaseAdvantage: 1.1 // Easier to chase
  },
  day: {
    dew: 0.0,
    swing: 0.8,
    spinAssistance: 1.3, // Dry pitch helps spin
    heatFatigue: 1.2, // Players tire faster
    batFirstAdvantage: 1.1 // Better to bat first before pitch slows down
  },
  dayNight: {
    dew: 0.5,
    swing: 1.1,
    spinAssistance: 1.0,
    eveningTransition: true // Conditions change as sun sets
  }
};

/**
 * Assigns realistic timing and environment to a match
 */
function getMatchTiming(isWeekend, isDoubleHeader, slotIndex = 0) {
  let localStartTime;
  let dayNight;

  if (isDoubleHeader) {
    if (slotIndex === 0) {
      localStartTime = TIME_SLOTS.AFTERNOON;
      dayNight = "dayNight";
    } else {
      localStartTime = TIME_SLOTS.EVENING;
      dayNight = "night";
    }
  } else {
    // 70% chance of Night match for prime-time feel
    const isNight = Math.random() > 0.3;
    localStartTime = isNight ? TIME_SLOTS.EVENING : TIME_SLOTS.DAY;
    dayNight = isNight ? "night" : "day";
  }

  return { localStartTime, dayNight, effects: ENVIRONMENTAL_EFFECTS[dayNight] };
}

/**
 * Generates a complete schedule from a list of fixtures
 */
function scheduleFixtures(fixtures, startDate, options = {}) {
  const {
    country = "India",
    restDayFrequency = 7,
    doubleHeaderWeekends = true,
    matchesPerDay = 1,
    type = "tournament" // "tournament" (IPL style) or "tour" (Bilateral)
  } = options;

  let currentMoment = moment(startDate).startOf('day');
  let matchCountInDay = 0;
  let dayCount = 0;
  let currentVenue = getRandomVenue(country);
  let matchesAtCurrentVenue = 0;
  const venueChangeFrequency = type === "tour" ? 2 : 1; // Change venue every 2 matches in a tour

  return fixtures.map((fixture, index) => {
    const isWeekend = currentMoment.day() === 0 || currentMoment.day() === 6;
    const isDoubleHeader = doubleHeaderWeekends && isWeekend && matchesPerDay > 1;

    // Determine timing
    const timing = getMatchTiming(isWeekend, isDoubleHeader, matchCountInDay);
    
    // Select Venue with transition logic
    if (matchesAtCurrentVenue >= venueChangeFrequency) {
      currentVenue = getRandomVenue(country);
      matchesAtCurrentVenue = 0;
      // Add a travel day if venue changes in a tour
      if (type === "tour") {
        currentMoment.add(1, 'days');
        dayCount++;
      }
    }
    
    const venue = currentVenue;
    matchesAtCurrentVenue++;
    
    // Calculate UTC Timestamp
    const localDateTimeStr = `${currentMoment.format('YYYY-MM-DD')} ${timing.localStartTime}`;
    const utcTimestamp = moment.tz(localDateTimeStr, "YYYY-MM-DD HH:mm", venue.timezone).utc().toISOString();

    const scheduledMatch = {
      ...fixture,
      venue: venue.name,
      city: venue.city,
      country: venue.country,
      timezone: venue.timezone,
      scheduledDate: currentMoment.format('YYYY-MM-DD'),
      scheduledStartTime: timing.localStartTime,
      localStartTime: timing.localStartTime,
      utcTimestamp,
      dayNight: timing.dayNight,
      environmentalEffects: timing.effects,
      status: "scheduled"
    };

    // Increment logic
    matchCountInDay++;
    
    const maxMatchesToday = isDoubleHeader ? 2 : matchesPerDay;
    
    if (matchCountInDay >= maxMatchesToday) {
      matchCountInDay = 0;
      currentMoment.add(1, 'days');
      dayCount++;

      // Check for rest day
      if (dayCount % restDayFrequency === 0) {
        currentMoment.add(1, 'days');
      }
    }

    return scheduledMatch;
  });
}


module.exports = { scheduleFixtures, getMatchTiming, ENVIRONMENTAL_EFFECTS };
