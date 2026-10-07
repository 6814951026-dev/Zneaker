const express = require("express");
const controller = require("../controllers/product.controller");

const router = express.Router();

router.get("/search", controller.searchProducts);
router.get("/", controller.getProducts);
router.get("/:id", controller.getProductById);
router.post("/", controller.createProduct);
router.put("/:id", controller.updateProduct);
router.delete("/:id", controller.deleteProduct);

module.exports = router;
