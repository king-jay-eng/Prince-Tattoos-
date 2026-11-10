const { makeToken, safeEq, isAdmin } = require("../lib/auth");
const db = require("../lib/db");
const COOKIE = "; Path=/; HttpOnly; Secure; SameSite=Strict";
module.exports = async (req, res) => {
  if (req.method === "GET") return res.status(isAdmin(req) ? 200 : 401).json({ ok: isAdmin(req) });
  if (req.method === "DELETE") { res.setHeader("Set-Cookie", "pt_admin=; Max-Age=0" + COOKIE); return res.json({ ok: true }); }
  if (req.method !== "POST") return res.status(405).end();
  const ip = String(req.headers["x-forwarded-for"] || "x").split(",")[0].trim(), k = "rl:" + ip;
  const n = await db.incr(k);
  if (n === 1) await db.expire(k, 900);
  if (n > 8) return res.status(429).json({ error: "Too many attempts. Try again in 15 minutes." });
  const pw = String((req.body || {}).password || "");
  if (!process.env.ADMIN_PASSWORD || !safeEq(pw, process.env.ADMIN_PASSWORD)) {
    await new Promise((r) => setTimeout(r, 800));
    return res.status(401).json({ error: "Wrong password." });
  }
  await db.del(k);
  res.setHeader("Set-Cookie", "pt_admin=" + makeToken() + "; Max-Age=604800" + COOKIE);
  res.json({ ok: true });
};
