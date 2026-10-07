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
const addressSchema = new mongoose.Schema({
  label: { type: String, trim: true, maxlength: 40, default: "บ้าน" },
  recipient: { type: String, trim: true, required: true, maxlength: 100 },
  phone: { type: String, trim: true, required: true, maxlength: 30 },
  line1: { type: String, trim: true, required: true, maxlength: 200 },
  line2: { type: String, trim: true, maxlength: 200, default: "" },
  subdistrict: { type: String, trim: true, maxlength: 100, default: "" },
  district: { type: String, trim: true, maxlength: 100, default: "" },
  province: { type: String, trim: true, required: true, maxlength: 100 },
  postalCode: { type: String, trim: true, required: true, maxlength: 10 },
  isDefault: { type: Boolean, default: false }
}, { timestamps: true });
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true, match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please provide a valid email"] },
  phone: { type: String, required: true, trim: true },
  password: { type: String, required: true, minlength: 6, select: false },
  role: { type: String, enum: ["customer", "admin"], default: "customer" },
  address: { type: String, default: "" },
  addresses: { type: [addressSchema], default: [] },
  points: { type: Number, default: 0, min: 0 },
  lastCheckinDate: { type: String, default: "" },
  transactions: { type: [transactionSchema], default: [] },
  draws: { type: [drawSchema], default: [] }
}, { timestamps: true });
module.exports = mongoose.model("User", userSchema);
