const venues = [
  {
    id: "WANKHEDE",
    name: "Wankhede Stadium",
    city: "Mumbai",
    country: "India",
    timezone: "Asia/Kolkata",
    capacity: 33000,
    type: "stadium"
  },
  {
    id: "CHIDAMBARAM",
    name: "M. A. Chidambaram Stadium",
    city: "Chennai",
    country: "India",
    timezone: "Asia/Kolkata",
    capacity: 50000,
    type: "stadium"
  },
  {
    id: "EDEN_GARDENS",
    name: "Eden Gardens",
    city: "Kolkata",
    country: "India",
    timezone: "Asia/Kolkata",
    capacity: 66000,
    type: "stadium"
  },
  {
    id: "MCG",
    name: "Melbourne Cricket Ground",
    city: "Melbourne",
    country: "Australia",
    timezone: "Australia/Melbourne",
    capacity: 100000,
    type: "stadium"
  },
  {
    id: "SCG",
    name: "Sydney Cricket Ground",
    city: "Sydney",
    country: "Australia",
    timezone: "Australia/Sydney",
    capacity: 48000,
    type: "stadium"
  },
  {
    id: "ADELAIDE_OVAL",
    name: "Adelaide Oval",
    city: "Adelaide",
    country: "Australia",
    timezone: "Australia/Adelaide",
    capacity: 53000,
    type: "stadium"
  },
  {
    id: "LORDS",
    name: "Lord's",
    city: "London",
    country: "England",
    timezone: "Europe/London",
    capacity: 30000,
    type: "stadium"
  },
  {
    id: "THE_OVAL",
    name: "The Oval",
    city: "London",
    country: "England",
    timezone: "Europe/London",
    capacity: 25000,
    type: "stadium"
  },
  {
    id: "OLD_TRAFFORD",
    name: "Old Trafford",
    city: "Manchester",
    country: "England",
    timezone: "Europe/London",
    capacity: 26000,
    type: "stadium"
  },
  {
    id: "GABBIE",
    name: "The Gabba",
    city: "Brisbane",
    country: "Australia",
    timezone: "Australia/Brisbane",
    capacity: 42000,
    type: "stadium"
  },
  {
    id: "UPPER_ARYAN",
    name: "Narendra Modi Stadium",
    city: "Ahmedabad",
    country: "India",
    timezone: "Asia/Kolkata",
    capacity: 132000,
    type: "stadium"
  }
];

function getVenuesByCountry(country) {
  return venues.filter(v => v.country.toLowerCase() === country.toLowerCase());
}

function getRandomVenue(country = null) {
  const options = country ? getVenuesByCountry(country) : venues;
  if (options.length === 0) return venues[Math.floor(Math.random() * venues.length)];
  return options[Math.floor(Math.random() * options.length)];
}

module.exports = { venues, getVenuesByCountry, getRandomVenue };
