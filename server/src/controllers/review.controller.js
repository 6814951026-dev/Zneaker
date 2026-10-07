const mongoose = require("mongoose");
const Review = require("../models/review.model");

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
    const review = await Review.create(req.body);
    res.status(201).json(await review.populate(["user", "product"]));
  } catch (error) {
    next(error);
  }
}

module.exports = { getReviews, createReview };
