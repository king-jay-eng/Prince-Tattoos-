module.exports = (fn) => async (req, res) => {
  try { await fn(req, res); }
  catch (e) { console.error(e); if (!res.headersSent) res.status(500).json({ error: "Server error: " + ((e && e.message) || "unknown") }); }
};
