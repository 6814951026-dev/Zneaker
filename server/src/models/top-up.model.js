const mongoose = require("mongoose");

const topUpSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  provider: { type: String, enum: ["opn"], default: "opn", required: true },
  chargeId: { type: String, unique: true, sparse: true },
  amountBaht: { type: Number, required: true, min: 20 },
  points: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ["pending", "successful", "failed", "expired"], default: "pending", index: true },
  qrImageUrl: { type: String, default: "" },
  expiresAt: { type: Date, default: null },
  paidAt: { type: Date, default: null }
}, { timestamps: true });

topUpSchema.index({ user: 1 }, { unique: true, partialFilterExpression: { status: "pending" } });

module.exports = mongoose.model("TopUp", topUpSchema);
