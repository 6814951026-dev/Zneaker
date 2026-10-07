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
    const search = String(req.query.q || "").trim();
    if (search) {
      const pattern = new RegExp(escapeRegex(search.slice(0, 100)), "i");
      filters.$or = ["name", "description", "category", "gender", "colors", "tags"].map((field) => ({ [field]: pattern }));
    }
    const minPrice = req.query.minPrice === undefined || req.query.minPrice === "" ? NaN : Number(req.query.minPrice);
    const maxPrice = req.query.maxPrice === undefined || req.query.maxPrice === "" ? NaN : Number(req.query.maxPrice);
    const priceExpression = [];
    if (Number.isFinite(minPrice)) priceExpression.push({ $gte: [{ $ifNull: ["$salePrice", "$price"] }, Math.max(0, minPrice)] });
    if (Number.isFinite(maxPrice)) priceExpression.push({ $lte: [{ $ifNull: ["$salePrice", "$price"] }, Math.max(0, maxPrice)] });
    if (priceExpression.length) filters.$expr = { $and: priceExpression };
    const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
    const limit = Math.min(48, Math.max(1, Math.floor(Number(req.query.limit) || 12)));
    const sortOptions = {
      newest: { createdAt: -1 },
      price_asc: { displayPrice: 1, _id: 1 },
      price_desc: { displayPrice: -1, _id: 1 },
      rating: { rating: -1, reviewCount: -1, _id: 1 },
      popular: { isBestSeller: -1, reviewCount: -1, createdAt: -1 }
    };
    const sort = sortOptions[req.query.sort] || sortOptions.newest;
    const [products, total] = await Promise.all([
      Product.aggregate([
        { $addFields: { displayPrice: { $ifNull: ["$salePrice", "$price"] } } },
        { $match: filters },
        { $sort: sort },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        { $project: { displayPrice: 0 } }
      ]),
      Product.countDocuments(filters)
    ]);
    res.json({ products, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
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
    const product = await Product.create(productInput(req.body));
    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
}

async function updateProduct(req, res, next) {
  try {
    if (invalidId(req.params.id)) return res.status(404).json({ message: "Product not found" });
    const product = await Product.findByIdAndUpdate(req.params.id, productInput(req.body), {
      new: true,
      runValidators: true
    });
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (error) {
    next(error);
  }
}

async function getProductFilters(req, res, next) {
  try {
    const [categories, genders, price] = await Promise.all([
      Product.distinct("category"),
      Product.distinct("gender"),
      Product.aggregate([
        { $project: { displayPrice: { $ifNull: ["$salePrice", "$price"] } } },
        { $group: { _id: null, min: { $min: "$displayPrice" }, max: { $max: "$displayPrice" } } }
      ])
    ]);
    res.json({ categories: categories.filter(Boolean).sort(), genders: genders.filter(Boolean).sort(), price: price[0] || { min: 0, max: 0 } });
  } catch (error) { next(error); }
}

function productInput(body = {}) {
  const allowed = ["name", "description", "price", "originalPrice", "salePrice", "category", "gender", "sizes", "colors", "tags", "variants", "image", "images", "rating", "reviewCount", "stock", "isNew", "isBestSeller", "isSale"];
  return Object.fromEntries(allowed.filter((key) => Object.hasOwn(body, key)).map((key) => [key, body[key]]));
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
  getProductFilters,
  searchProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};
