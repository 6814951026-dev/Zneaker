const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    size: {
      type: Number,
      required: true,
      min: 1
    },
    color: {
      type: String,
      required: true,
      trim: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    productName: { type: String, trim: true, required: true },
    image: { type: String, default: "" },
    hasVariant: { type: Boolean, default: false }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    items: {
      type: [orderItemSchema],
      validate: [(items) => items.length > 0, "Order must contain at least one item"]
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    shippingAddress: {
      type: String,
      required: true,
      trim: true
    },
    paymentMethod: {
      type: String,
      enum: ["cod", "promptpay"],
      required: true
    },
    paymentStatus: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending" },
    chargeId: { type: String, unique: true, sparse: true },
    qrImageUrl: { type: String, default: "" },
    paidAt: { type: Date, default: null },
    subtotal: { type: Number, required: true, min: 0 },
    shippingFee: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["pending_payment", "confirmed", "shipping", "delivered", "cancelled"],
      default: "pending"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
