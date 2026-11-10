const db = require("../lib/db"), { isAdmin } = require("../lib/auth"), { del } = require("@vercel/blob");
const cl = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
module.exports = async (req, res) => {
  if (req.method === "GET") {
    const all = (await db.hgetall("media")) || {};
    res.setHeader("Cache-Control", "no-store");
    return res.json({ items: Object.values(all).sort((a, b) => b.created - a.created), currency: process.env.CURRENCY || "USD", deposit: +process.env.DEPOSIT || 50 });
  }
  if (!isAdmin(req)) return res.status(401).json({ error: "Unauthorized" });
  if (req.method === "POST") {
    const b = req.body || {}, url = String(b.url || "");
    if (!/^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(url)) return res.status(400).json({ error: "Bad file URL" });
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const m = { id, url, type: b.type === "video" ? "video" : "image", title: cl(b.title, 80), desc: cl(b.desc, 500), price: cl(b.price, 20), created: Date.now() };
    await db.hset("media", { [id]: m });
    return res.json(m);
  }
  if (req.method === "DELETE") {
    const id = cl(req.query.id, 40), m = await db.hget("media", id);
    if (m) { try { await del(m.url); } catch (e) {} await db.hdel("media", id); }
    return res.json({ ok: true });
  }
  res.status(405).end();
};
