const db = require("../firebase");
const SeriesEngine = require("./seriesEngine");

class TourEngine {
  static async createTour(host, visitor, season, seriesConfigs) {
    const tourId = `TOUR_${host}_${visitor}_${Date.now()}`;
    const tourData = {
      id: tourId,
      name: `${visitor} Tour of ${host} ${season}`,
      host,
      visitor,
      season,
      series: [],
      status: "scheduled"
    };

    for (const config of seriesConfigs) {
      const seriesId = await SeriesEngine.createSeries(tourId, config.format, config.matches, host, visitor);
      tourData.series.push(seriesId);
    }

    await db.ref(`international/tours/${tourId}`).set(tourData);
    return tourId;
  }
}

module.exports = TourEngine;
