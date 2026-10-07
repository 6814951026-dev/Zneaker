const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, min: 0 },
    salePrice: { type: Number, min: 0 },
    category: { type: String, required: true, trim: true },
    gender: { type: String, default: "Unisex", trim: true },
    sizes: [{ type: Number, min: 1 }],
    colors: [{ type: String, trim: true }],
    image: { type: String, default: "" },
    images: [{ type: String }],
    rating: { type: Number, min: 0, max: 5, default: 0 },
    reviewCount: { type: Number, min: 0, default: 0 },
    stock: { type: Number, required: true, min: 0 },
    isNew: { type: Boolean, default: false },
    isBestSeller: { type: Boolean, default: false },
    isSale: { type: Boolean, default: false }
  },
  { timestamps: true, suppressReservedKeysWarning: true }
);

module.exports = mongoose.model("Product", productSchema);
