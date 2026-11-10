// One file handles every /api/* route (login, media, upload, bookings, skrill, health).
const crypto = require("crypto");
const E = process.env;
const cl = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ---- storage (Upstash Redis) ----
let _db;
const getDb = () => _db || (_db = new (require("@upstash/redis").Redis)({
  url: E.UPSTASH_REDIS_REST_URL || E.KV_REST_API_URL,
  token: E.UPSTASH_REDIS_REST_TOKEN || E.KV_REST_API_TOKEN,
}));

// ---- auth ----
const sign = (v) => crypto.createHmac("sha256", E.SESSION_SECRET || "").update(v).digest("hex");
const h256 = (s) => crypto.createHash("sha256").update(String(s)).digest();
const safeEq = (a, b) => crypto.timingSafeEqual(h256(a), h256(b));
const isAdmin = (req) => {
  if (!E.SESSION_SECRET) return false;
  const m = (req.headers.cookie || "").match(/(?:^|; )pt_admin=([^;]+)/);
  if (!m) return false;
  const [t, s] = m[1].split(".");
  if (!t || !s || +t < Date.now()) return false;
  const a = Buffer.from(s), b = Buffer.from(sign(t));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const COOKIE = "; Path=/; HttpOnly; Secure; SameSite=Strict";

const H = {};

H.health = (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({
    site: "ok",
    adminPassword: !!E.ADMIN_PASSWORD, sessionSecret: !!E.SESSION_SECRET,
    redis: !!((E.UPSTASH_REDIS_REST_URL || E.KV_REST_API_URL) && (E.UPSTASH_REDIS_REST_TOKEN || E.KV_REST_API_TOKEN)),
    blob: !!E.BLOB_READ_WRITE_TOKEN, skrillEmail: !!E.SKRILL_EMAIL, skrillSecret: !!E.SKRILL_SECRET_WORD,
  });
};

H.login = async (req, res) => {
  if (req.method === "GET") return res.status(isAdmin(req) ? 200 : 401).json({ ok: isAdmin(req) });
  if (req.method === "DELETE") { res.setHeader("Set-Cookie", "pt_admin=; Max-Age=0" + COOKIE); return res.json({ ok: true }); }
  if (req.method !== "POST") return res.status(405).end();
  if (!E.ADMIN_PASSWORD || !E.SESSION_SECRET) return res.status(500).json({ error: "Not set up yet: add ADMIN_PASSWORD and SESSION_SECRET in Vercel, then redeploy." });
  const k = "rl:" + String(req.headers["x-forwarded-for"] || "x").split(",")[0].trim();
  let db = null, n = 0;
  try { db = getDb(); n = await db.incr(k); if (n === 1) await db.expire(k, 900); } catch (e) { db = null; n = 0; }
  if (n > 8) return res.status(429).json({ error: "Too many attempts. Try again in 15 minutes." });
  if (!safeEq(String((req.body || {}).password || ""), E.ADMIN_PASSWORD)) {
    await new Promise((r) => setTimeout(r, 800));
    return res.status(401).json({ error: "Wrong password." });
  }
  if (db) { try { await db.del(k); } catch (e) {} }
  const t = String(Date.now() + 7 * 864e5);
  res.setHeader("Set-Cookie", "pt_admin=" + t + "." + sign(t) + "; Max-Age=604800" + COOKIE);
  res.json({ ok: true });
};

H.upload = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  try {
    if (!isAdmin(req)) throw new Error("Please sign in again (session expired).");
    if (!E.BLOB_READ_WRITE_TOKEN) throw new Error("Blob storage isn’t connected. In Vercel open Storage, create a Blob store, connect it to this project (Production), then redeploy.");
    const { handleUpload } = require("@vercel/blob/client");
    const hdrs = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") hdrs.set(k, v);
    const request = new Request("https://" + req.headers.host + "/api/index?r=upload", { method: "POST", headers: hdrs });
    res.json(await handleUpload({
      body: req.body, request,
      onBeforeGenerateToken: async () => ({ allowedContentTypes: ["image/*", "video/*"], maximumSizeInBytes: 300 * 1024 * 1024, addRandomSuffix: true }),
    }));
  } catch (e) { console.error(e); res.status(400).json({ error: e.message }); }
};

H.media = async (req, res) => {
  const db = getDb();
  if (req.method === "GET") {
    const all = (await db.hgetall("media")) || {};
    res.setHeader("Cache-Control", "no-store");
    return res.json({ items: Object.values(all).sort((a, b) => b.created - a.created), currency: E.CURRENCY || "USD", deposit: +E.DEPOSIT || 50 });
  }
  if (!isAdmin(req)) return res.status(401).json({ error: "Unauthorized" });
  if (req.method === "POST") {
    const b = req.body || {}, url = String(b.url || "");
    if (!/^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(url)) return res.status(400).json({ error: "Bad file URL" });
    const id = uid(), m = { id, url, type: b.type === "video" ? "video" : "image", title: cl(b.title, 80), desc: cl(b.desc, 500), price: cl(b.price, 20), created: Date.now() };
    await db.hset("media", { [id]: m });
    return res.json(m);
  }
  if (req.method === "DELETE") {
    const id = cl(req.query.id, 40), m = await db.hget("media", id);
    if (m) { try { await require("@vercel/blob").del(m.url); } catch (e) {} await db.hdel("media", id); }
    return res.json({ ok: true });
  }
  res.status(405).end();
};

H.bookings = async (req, res) => {
  const db = getDb(), DEP = +E.DEPOSIT || 50, CUR = E.CURRENCY || "USD";
  if (req.method === "POST") {
    const b = req.body || {}, name = cl(b.name, 80), contact = cl(b.contact, 120);
    if (!name || !contact) return res.status(400).json({ error: "Please add your name and phone or email." });
    const today = new Date().toISOString().slice(0, 10);
    const dates = [...new Set((Array.isArray(b.dates) ? b.dates : []).map(String))].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d > today).slice(0, 10).sort();
    if (!dates.length) return res.status(400).json({ error: "Please choose at least one date." });
    const id = uid(), total = dates.length * DEP;
    const bk = { id, name, contact, placement: cl(b.placement, 60), style: cl(b.style, 40), time: cl(b.time, 10), notes: cl(b.notes, 400), dates, total, currency: CUR, status: "New", paid: false, created: Date.now() };
    await db.hset("bookings", { [id]: bk });
    const o = "https://" + req.headers.host;
    const skrill = E.SKRILL_EMAIL ? { url: "https://pay.skrill.com", fields: {
      pay_to_email: E.SKRILL_EMAIL, transaction_id: id, status_url: o + "/api/index?r=skrill", return_url: o + "/?paid=1", cancel_url: o + "/?cancelled=1",
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
};

H.skrill = async (req, res) => {
  const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");
  const p = req.body || {};
  if (!E.SKRILL_SECRET_WORD) return res.status(200).end();
  const sig = md5(String(p.merchant_id || "") + String(p.transaction_id || "") + md5(E.SKRILL_SECRET_WORD).toUpperCase() + String(p.mb_amount || "") + String(p.mb_currency || "") + String(p.status || "")).toUpperCase();
  if (sig !== String(p.md5sig || "").toUpperCase()) return res.status(400).end();
  if (String(p.status) === "2") {
    const db = getDb(), b = await db.hget("bookings", String(p.transaction_id));
    if (b && !b.paid && String(p.pay_to_email || "").toLowerCase() === String(E.SKRILL_EMAIL || "").toLowerCase() && Number(p.amount) >= b.total - 0.001 && p.currency === b.currency)
      await db.hset("bookings", { [b.id]: { ...b, paid: true, paidAmount: Number(p.amount), paidAt: Date.now(), paidVia: "skrill", status: "Confirmed" } });
  }
  res.status(200).end();
};

module.exports = async (req, res) => {
  const h = H[String((req.query || {}).r || "")];
  if (!h) return res.status(404).json({ error: "Unknown endpoint" });
  try { await h(req, res); }
  catch (e) { console.error(e); if (!res.headersSent) res.status(500).json({ error: "Server error: " + ((e && e.message) || "unknown") }); }
};
