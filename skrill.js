const crypto = require("crypto"), db = require("../lib/db");
const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");
module.exports = async (req, res) => {
  try {
    const p = req.body || {}, secret = process.env.SKRILL_SECRET_WORD;
    if (!secret) return res.status(200).end();
    const sig = md5(String(p.merchant_id || "") + String(p.transaction_id || "") + md5(secret).toUpperCase() + String(p.mb_amount || "") + String(p.mb_currency || "") + String(p.status || "")).toUpperCase();
    if (sig !== String(p.md5sig || "").toUpperCase()) return res.status(400).end();
    if (String(p.status) === "2") {
      const b = await db.hget("bookings", String(p.transaction_id));
      if (b && !b.paid && String(p.pay_to_email || "").toLowerCase() === String(process.env.SKRILL_EMAIL || "").toLowerCase() && Number(p.amount) >= b.total - 0.001 && p.currency === b.currency)
        await db.hset("bookings", { [b.id]: { ...b, paid: true, paidAmount: Number(p.amount), paidAt: Date.now(), paidVia: "skrill", status: "Confirmed" } });
    }
    res.status(200).end();
  } catch (e) { res.status(500).end(); }
};
