const crypto = require("crypto");
const sign = (v) => crypto.createHmac("sha256", process.env.SESSION_SECRET || "").update(v).digest("hex");
const h = (s) => crypto.createHash("sha256").update(String(s)).digest();
exports.safeEq = (a, b) => crypto.timingSafeEqual(h(a), h(b));
exports.makeToken = () => { const t = String(Date.now() + 7 * 864e5); return t + "." + sign(t); };
exports.isAdmin = (req) => {
  if (!process.env.SESSION_SECRET) return false;
  const m = (req.headers.cookie || "").match(/(?:^|; )pt_admin=([^;]+)/);
  if (!m) return false;
  const [t, s] = m[1].split(".");
  if (!t || !s || +t < Date.now()) return false;
  const a = Buffer.from(s), b = Buffer.from(sign(t));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
