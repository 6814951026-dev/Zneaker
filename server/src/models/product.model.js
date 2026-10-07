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
    tags: [{ type: String, trim: true, lowercase: true }],
    variants: [{
      size: { type: Number, min: 1, required: true },
      color: { type: String, trim: true, required: true },
      stock: { type: Number, min: 0, default: 0 },
      sku: { type: String, trim: true, default: "" }
    }],
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

productSchema.index({ category: 1, price: 1, createdAt: -1 });
productSchema.index({ isNew: 1, isBestSeller: 1, isSale: 1 });

module.exports = mongoose.model("Product", productSchema);
