const mongoose = require("mongoose");
const Review = require("../models/review.model");
const Product = require("../models/product.model");

async function getReviews(req, res, next) {
  try {
    const filter = mongoose.isValidObjectId(req.query.product) ? { product: req.query.product } : {};
    res.json(await Review.find(filter).populate("user", "name").populate("product", "name").sort({ createdAt: -1 }));
  } catch (error) {
    next(error);
  }
}

async function createReview(req, res, next) {
  try {
    const rating = Number(req.body.rating);
    const comment = String(req.body.comment || "").trim().slice(0, 2000);
    if (!mongoose.isValidObjectId(req.body.product) || !Number.isInteger(rating) || rating < 1 || rating > 5 || !comment) {
      return res.status(400).json({ message: "กรุณาระบุสินค้า คะแนน 1–5 และข้อความรีวิว" });
    }
    const review = await Review.create({ user: req.auth.id, product: req.body.product, rating, comment });
    const [summary] = await Review.aggregate([
      { $match: { product: new mongoose.Types.ObjectId(req.body.product) } },
      { $group: { _id: "$product", rating: { $avg: "$rating" }, reviewCount: { $sum: 1 } } }
    ]);
    if (summary) await Product.updateOne({ _id: summary._id }, { $set: { rating: summary.rating, reviewCount: summary.reviewCount } });
    res.status(201).json(await review.populate(["user", "product"]));
  } catch (error) {
    next(error);
  }
}

module.exports = { getReviews, createReview };
