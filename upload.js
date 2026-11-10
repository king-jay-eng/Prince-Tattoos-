const { handleUpload } = require("@vercel/blob/client");
const { isAdmin } = require("../lib/auth");
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  try {
    const r = await handleUpload({
      body: req.body, request: req,
      onBeforeGenerateToken: async () => {
        if (!isAdmin(req)) throw new Error("Unauthorized");
        return { allowedContentTypes: ["image/*", "video/*"], maximumSizeInBytes: 300 * 1024 * 1024, addRandomSuffix: true };
      },
      onUploadCompleted: async () => {},
    });
    res.json(r);
  } catch (e) { res.status(400).json({ error: e.message }); }
};
