const express = require("express");
const controller = require("../controllers/review.controller");

const router = express.Router();
router.get("/", controller.getReviews);
router.post("/", controller.createReview);

module.exports = router;
