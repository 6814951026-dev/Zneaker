const express = require("express");
const controller = require("../controllers/review.controller");
const { requireAuth } = require("../middlewares/auth.middleware");

const router = express.Router();
router.get("/", controller.getReviews);
router.post("/", requireAuth, controller.createReview);

module.exports = router;
