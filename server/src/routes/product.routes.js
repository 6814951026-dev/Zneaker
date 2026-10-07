const express = require("express");
const controller = require("../controllers/product.controller");
const { requireAuth, requireAdmin } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/search", controller.searchProducts);
router.get("/filters", controller.getProductFilters);
router.get("/", controller.getProducts);
router.get("/:id", controller.getProductById);
router.post("/", requireAuth, requireAdmin, controller.createProduct);
router.put("/:id", requireAuth, requireAdmin, controller.updateProduct);
router.delete("/:id", requireAuth, requireAdmin, controller.deleteProduct);

module.exports = router;
