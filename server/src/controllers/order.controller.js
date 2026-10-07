const mongoose = require("mongoose");
const Order = require("../models/order.model");

function validId(id) {
  return mongoose.isValidObjectId(id);
}

async function getOrders(req, res, next) {
  try {
    const filter = validId(req.query.user) ? { user: req.query.user } : {};
    res.json(await Order.find(filter).populate("user", "name email").populate("items.product").sort({ createdAt: -1 }));
  } catch (error) {
    next(error);
  }
}

async function getOrderById(req, res, next) {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ message: "Order not found" });
    const order = await Order.findById(req.params.id).populate("user", "name email").populate("items.product");
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (error) {
    next(error);
  }
}

async function createOrder(req, res, next) {
  try {
    const order = await Order.create(req.body);
    res.status(201).json(await order.populate("items.product"));
  } catch (error) {
    next(error);
  }
}

async function updateOrder(req, res, next) {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ message: "Order not found" });
    const order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (error) {
    next(error);
  }
}

module.exports = { getOrders, getOrderById, createOrder, updateOrder };
