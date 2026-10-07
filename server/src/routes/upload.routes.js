const express = require("express");
const { handleUpload } = require("@vercel/blob/client");
const jwt = require("jsonwebtoken");
const secret = () => process.env.JWT_SECRET || "zneaker-development-secret-change-before-deploying";

const router = express.Router();

router.post("/", async (req, res, next) => {
  try {
    const response = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const { token } = JSON.parse(clientPayload || "{}");
        const user = jwt.verify(token || "", secret());
        if (user.role !== "admin") throw new Error("Admin access is required");
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
          maximumSizeInBytes: 5 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: user.id })
        };
      },
      onUploadCompleted: async () => {}
    });
    res.json(response);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
