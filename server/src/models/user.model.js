const mongoose = require("mongoose");
const transactionSchema = new mongoose.Schema({
  type: { type: String, enum: ["checkin", "draw", "topup"], required: true },
  points: { type: Number, required: true },
  amountBaht: { type: Number, default: 0 },
  description: { type: String, required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null }
}, { timestamps: true });
const drawSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  pointsSpent: { type: Number, default: 1000 }
}, { timestamps: true });
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true, match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please provide a valid email"] },
  phone: { type: String, required: true, trim: true },
  password: { type: String, required: true, minlength: 6, select: false },
  role: { type: String, enum: ["customer", "admin"], default: "customer" },
  address: { type: String, default: "" },
  points: { type: Number, default: 0, min: 0 },
  lastCheckinDate: { type: String, default: "" },
  transactions: { type: [transactionSchema], default: [] },
  draws: { type: [drawSchema], default: [] }
}, { timestamps: true });
module.exports = mongoose.model("User", userSchema);
