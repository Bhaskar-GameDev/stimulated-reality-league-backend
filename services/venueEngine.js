const db = require("../firebase");

class VenueEngine {
  static defaultVenues = {
    "Wankhede Stadium": { averageFirstInningsODI: 310, averageFirstInningsT20: 185, spinAssist: 0.3, paceAssist: 0.6, dewFactor: 1.3, boundarySize: "small" },
    "MCG": { averageFirstInningsODI: 270, averageFirstInningsT20: 160, spinAssist: 0.4, paceAssist: 0.8, dewFactor: 1.0, boundarySize: "large" },
    "Lord's": { averageFirstInningsODI: 280, averageFirstInningsT20: 165, spinAssist: 0.3, paceAssist: 0.9, dewFactor: 1.1, boundarySize: "medium" }
  };

  static getVenueProfile(venueName) {
    return this.defaultVenues[venueName] || {
      averageFirstInningsODI: 285,
      averageFirstInningsT20: 170,
      spinAssist: 0.5,
      paceAssist: 0.5,
      dewFactor: 1.1,
      boundarySize: "medium"
    };
  }
}

module.exports = VenueEngine;
