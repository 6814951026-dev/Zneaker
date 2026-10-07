const express = require("express");
const controller = require("../controllers/order.controller");
const { requireAuth, requireAdmin } = require("../middlewares/auth.middleware");

const router = express.Router();
router.get("/", requireAuth, controller.getOrders);
router.get("/:id", requireAuth, controller.getOrderById);
router.post("/", requireAuth, controller.createOrder);
router.get("/:id/status", requireAuth, controller.reconcileOrder);
router.put("/:id", requireAuth, requireAdmin, controller.updateOrder);

module.exports = router;
