module.exports = (req, res) => {
  const e = process.env;
  res.setHeader("Cache-Control", "no-store");
  res.json({
    site: "ok",
    adminPassword: !!e.ADMIN_PASSWORD,
    sessionSecret: !!e.SESSION_SECRET,
    redis: !!((e.UPSTASH_REDIS_REST_URL || e.KV_REST_API_URL) && (e.UPSTASH_REDIS_REST_TOKEN || e.KV_REST_API_TOKEN)),
    blob: !!e.BLOB_READ_WRITE_TOKEN,
    skrillEmail: !!e.SKRILL_EMAIL,
    skrillSecret: !!e.SKRILL_SECRET_WORD,
  });
};
