const app = require("../server/src/app");
const connectDB = require("../server/src/config/db");

module.exports = async (req, res) => {
  // Vercel invokes this catch-all for /api/*; Express routes are also mounted
  // under /api, so keep the original URL intact.
  if (!req.url.startsWith("/api")) req.url = `/api${req.url}`;
  try {
    await connectDB();
    return app(req, res);
  } catch (error) {
    console.error("Database connection failed:", error.message);
    return res.status(503).json({ message: "Database unavailable" });
  }
};
