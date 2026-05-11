const db = require("../firebase");
const TourEngine = require("./tourEngine");

class CalendarEngine {
  static async scheduleYear(year) {
    // Generate a basic international calendar
    const tours = [
      { host: "Australia", visitor: "India", season: year, series: [{ format: "ODI", matches: 3 }, { format: "T20", matches: 5 }] },
      { host: "England", visitor: "Australia", season: year, series: [{ format: "ODI", matches: 5 }, { format: "T20", matches: 3 }] },
      { host: "India", visitor: "New Zealand", season: year, series: [{ format: "ODI", matches: 3 }, { format: "T20", matches: 3 }] }
    ];

    for (const tour of tours) {
      await TourEngine.createTour(tour.host, tour.visitor, tour.season, tour.series);
    }

    await db.ref(`international/calendar/${year}`).set({ generated: true, tours: tours.map(t => `${t.visitor} in ${t.host}`) });
  }
}

module.exports = CalendarEngine;
