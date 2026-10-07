const mongoose = require("mongoose");
const Product = require("../models/product.model");

function invalidId(id) {
  return !mongoose.isValidObjectId(id);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getProducts(req, res, next) {
  try {
    const filters = {};
    ["category", "gender"].forEach((field) => {
      if (req.query[field]) filters[field] = req.query[field];
    });
    ["isNew", "isBestSeller", "isSale"].forEach((field) => {
      if (req.query[field] !== undefined) filters[field] = req.query[field] === "true";
    });
    const products = await Product.find(filters).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    next(error);
  }
}

async function searchProducts(req, res, next) {
  try {
    const query = String(req.query.q || "").trim();
    if (!query) return res.json([]);
    const pattern = new RegExp(escapeRegex(query), "i");
    const products = await Product.find({
      $or: [{ name: pattern }, { description: pattern }, { category: pattern }, { gender: pattern }, { colors: pattern }]
    }).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    next(error);
  }
}

async function getProductById(req, res, next) {
  try {
    if (invalidId(req.params.id)) return res.status(404).json({ message: "Product not found" });
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (error) {
    next(error);
  }
}

async function createProduct(req, res, next) {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
}

async function updateProduct(req, res, next) {
  try {
    if (invalidId(req.params.id)) return res.status(404).json({ message: "Product not found" });
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (error) {
    next(error);
  }
}

async function deleteProduct(req, res, next) {
  try {
    if (invalidId(req.params.id)) return res.status(404).json({ message: "Product not found" });
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product deleted" });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getProducts,
  searchProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};
