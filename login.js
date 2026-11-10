const { makeToken, safeEq, isAdmin } = require("../lib/auth");
const wrap = require("../lib/wrap");
const COOKIE = "; Path=/; HttpOnly; Secure; SameSite=Strict";
module.exports = wrap(async (req, res) => {
  if (req.method === "GET") return res.status(isAdmin(req) ? 200 : 401).json({ ok: isAdmin(req) });
  if (req.method === "DELETE") { res.setHeader("Set-Cookie", "pt_admin=; Max-Age=0" + COOKIE); return res.json({ ok: true }); }
  if (req.method !== "POST") return res.status(405).end();
  if (!process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET) return res.status(500).json({ error: "Not set up yet: add ADMIN_PASSWORD and SESSION_SECRET in Vercel, then redeploy." });
  const ip = String(req.headers["x-forwarded-for"] || "x").split(",")[0].trim(), k = "rl:" + ip;
  let db = null, n = 0;
  try { db = require("../lib/db"); n = await db.incr(k); if (n === 1) await db.expire(k, 900); } catch (e) { db = null; n = 0; }
  if (n > 8) return res.status(429).json({ error: "Too many attempts. Try again in 15 minutes." });
  const pw = String((req.body || {}).password || "");
  if (!safeEq(pw, process.env.ADMIN_PASSWORD)) {
    await new Promise((r) => setTimeout(r, 800));
    return res.status(401).json({ error: "Wrong password." });
  }
  if (db) { try { await db.del(k); } catch (e) {} }
  res.setHeader("Set-Cookie", "pt_admin=" + makeToken() + "; Max-Age=604800" + COOKIE);
  res.json({ ok: true });
});
