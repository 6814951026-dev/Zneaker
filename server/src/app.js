const express = require("express");
const cors = require("cors");
const productRoutes = require("./routes/product.routes");
const userRoutes = require("./routes/user.routes");
const orderRoutes = require("./routes/order.routes");
const reviewRoutes = require("./routes/review.routes");
const uploadRoutes = require("./routes/upload.routes");
const paymentController = require("./controllers/payment.controller");
const { notFound, errorHandler } = require("./middlewares/error.middleware");

const app = express();
const vercelOrigins = [
  process.env.VERCEL_URL,
  process.env.VERCEL_BRANCH_URL,
  process.env.VERCEL_PROJECT_PRODUCTION_URL
].filter(Boolean).map((host) => {
  try {
    return new URL(host.includes("://") ? host : `https://${host}`).origin;
  } catch {
    return null;
  }
}).filter(Boolean);

app.use(cors((req, callback) => {
  const origin = req.get("Origin");
  if (!origin) return callback(null, { origin: false });

  let sameHost = false;
  try {
    const parsedOrigin = new URL(origin);
    sameHost = ["http:", "https:"].includes(parsedOrigin.protocol)
      && parsedOrigin.host.toLowerCase() === String(req.get("host") || "").toLowerCase();
  } catch {}

  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  const allowed = sameHost || isLocalhost
    || origin === process.env.CLIENT_ORIGIN
    || vercelOrigins.includes(origin);
  callback(null, { origin: allowed ? origin : false });
}));
app.use(express.json());
app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/products", productRoutes);
app.use("/api/users", userRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/uploads", uploadRoutes);
app.post("/api/payments/opn/webhook", paymentController.webhook);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
