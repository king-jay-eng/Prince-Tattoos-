const db = require("../lib/db"), { isAdmin } = require("../lib/auth");
const wrap = require("../lib/wrap");
const cl = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
module.exports = wrap(async (req, res) => {
  const DEP = +process.env.DEPOSIT || 50, CUR = process.env.CURRENCY || "USD";
  if (req.method === "POST") {
    const b = req.body || {}, name = cl(b.name, 80), contact = cl(b.contact, 120);
    if (!name || !contact) return res.status(400).json({ error: "Please add your name and phone or email." });
    const today = new Date().toISOString().slice(0, 10);
    const dates = [...new Set((Array.isArray(b.dates) ? b.dates : []).map(String))]
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d > today).slice(0, 10).sort();
    if (!dates.length) return res.status(400).json({ error: "Please choose at least one date ." });
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6), total = dates.length * DEP;
    const bk = { id, name, contact, placement: cl(b.placement, 60), style: cl(b.style, 40), time: cl(b.time, 10), notes: cl(b.notes, 400), dates, total, currency: CUR, status: "New", paid: false, created: Date.now() };
    await db.hset("bookings", { [id]: bk });
    const o = "https://" + req.headers.host;
    const skrill = process.env.SKRILL_EMAIL ? { url: "https://pay.skrill.com", fields: {
      pay_to_email: process.env.SKRILL_EMAIL, transaction_id: id, status_url: o + "/api/skrill", return_url: o + "/?paid=1", cancel_url: o + "/?cancelled=1",
      language: "EN", amount: total.toFixed(2), currency: CUR, detail1_description: "Prince Tattoos deposit", detail1_text: dates.length + " session(s): " + dates.join(", ") } } : null;
    return res.json({ id, total, currency: CUR, skrill });
  }
  if (!isAdmin(req)) return res.status(401).json({ error: "Unauthorized" });
  if (req.method === "GET") {
    const all = (await db.hgetall("bookings")) || {};
    return res.json(Object.values(all).sort((a, b) => b.created - a.created));
  }
  const id = cl((req.body || {}).id || req.query.id, 40), b = await db.hget("bookings", id);
  if (!b) return res.status(404).json({ error: "Not found" });
  if (req.method === "DELETE") { await db.hdel("bookings", id); return res.json({ ok: true }); }
  if (req.method === "PATCH") {
    const p = req.body || {};
    if (["New", "Confirmed", "Completed", "Cancelled"].includes(p.status)) b.status = p.status;
    if (p.paid === true && !b.paid) { b.paid = true; b.paidAmount = b.total; b.paidAt = Date.now(); b.paidVia = "manual"; }
    if (p.paid === false) { b.paid = false; delete b.paidAmount; delete b.paidAt; delete b.paidVia; }
    await db.hset("bookings", { [id]: b });
    return res.json(b);
  }
  res.status(405).end();
});
