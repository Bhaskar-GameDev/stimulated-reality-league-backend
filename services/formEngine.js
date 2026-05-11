const db = require("../firebase");

class FormEngine {
  static async updateForm(playerId, performance) {
    const ref = db.ref(`international/form/${playerId}`);
    const snap = await ref.once("value");
    let form = snap.val() || { confidence: 50, recentScores: [], recentWickets: [], formTrend: "neutral" };

    if (performance.runs !== undefined) {
      form.recentScores.push(performance.runs);
      if (form.recentScores.length > 5) form.recentScores.shift();
    }
    if (performance.wickets !== undefined) {
      form.recentWickets.push(performance.wickets);
      if (form.recentWickets.length > 5) form.recentWickets.shift();
    }

    // Calculate confidence
    const avgRuns = form.recentScores.reduce((a, b) => a + b, 0) / Math.max(1, form.recentScores.length);
    const avgWickets = form.recentWickets.reduce((a, b) => a + b, 0) / Math.max(1, form.recentWickets.length);
    
    let confidenceBoost = 0;
    if (avgRuns > 40 || avgWickets > 2) confidenceBoost += 10;
    else if (avgRuns < 15 && avgWickets < 1) confidenceBoost -= 10;

    form.confidence = Math.max(10, Math.min(99, form.confidence + confidenceBoost));
    
    if (form.confidence > 80) form.formTrend = "hot";
    else if (form.confidence < 30) form.formTrend = "poor";
    else form.formTrend = "neutral";

    await ref.set(form);
    return form;
  }

  static async getForm(playerId) {
    const snap = await db.ref(`international/form/${playerId}`).once("value");
    return snap.val() || { confidence: 50, formTrend: "neutral" };
  }
}

module.exports = FormEngine;
