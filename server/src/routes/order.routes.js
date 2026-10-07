const express = require("express");
const controller = require("../controllers/order.controller");

const router = express.Router();
router.get("/", controller.getOrders);
router.get("/:id", controller.getOrderById);
router.post("/", controller.createOrder);
router.put("/:id", controller.updateOrder);

module.exports = router;
