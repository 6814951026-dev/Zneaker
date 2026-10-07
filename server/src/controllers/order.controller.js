const mongoose = require("mongoose");
const Order = require("../models/order.model");
const Product = require("../models/product.model");
const User = require("../models/user.model");
const { createPromptPayCharge, getCharge } = require("../services/opn.service");
const { notifyOrder } = require("../services/email.service");

const SHIPPING_FEE = 60;
const FREE_SHIPPING_THRESHOLD = 2000;

function validId(id) { return mongoose.isValidObjectId(id); }

async function getOrders(req, res, next) {
  try {
    const filter = req.auth.role === "admin" && validId(req.query.user)
      ? { user: req.query.user }
      : req.auth.role === "admin" ? {} : { user: req.auth.id };
    const orders = await Order.find(filter).populate("items.product", "name image").sort({ createdAt: -1 }).limit(100);
    res.json(orders);
  } catch (error) { next(error); }
}

async function getOrderById(req, res, next) {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ message: "ไม่พบคำสั่งซื้อ" });
    const filter = req.auth.role === "admin"
      ? { _id: req.params.id }
      : { _id: req.params.id, user: req.auth.id };
    const order = await Order.findOne(filter).populate("items.product", "name image");
    if (!order) return res.status(404).json({ message: "ไม่พบคำสั่งซื้อ" });
    res.json(order);
  } catch (error) { next(error); }
}

async function reserveItems(items, session) {
  const normalized = new Map();
  for (const raw of items) {
    const productId = String(raw.product || "");
    const size = Number(raw.size);
    const color = String(raw.color || "").trim();
    const quantity = Number(raw.quantity);
    if (!validId(productId) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 20 || !Number.isFinite(size) || size < 1 || !color) {
      throw Object.assign(new Error("ข้อมูลสินค้าในตะกร้าไม่ถูกต้อง"), { statusCode: 400 });
    }
    const key = `${productId}:${size}:${color}`;
    normalized.set(key, { productId, size, color, quantity: (normalized.get(key)?.quantity || 0) + quantity });
  }
  if (!normalized.size || normalized.size > 30) throw Object.assign(new Error("คำสั่งซื้อต้องมีสินค้า 1–30 รายการ"), { statusCode: 400 });

  const orderItems = [];
  for (const item of normalized.values()) {
    const product = await Product.findById(item.productId).session(session);
    if (!product) throw Object.assign(new Error("มีสินค้าบางรายการที่ไม่มีอยู่แล้ว"), { statusCode: 409 });
    if (product.sizes.length && !product.sizes.includes(item.size)) throw Object.assign(new Error(`${product.name}: ไม่มีไซซ์ที่เลือก`), { statusCode: 409 });
    if (product.colors.length && !product.colors.includes(item.color)) throw Object.assign(new Error(`${product.name}: ไม่มีสีที่เลือก`), { statusCode: 409 });

    const variant = product.variants.find((entry) => entry.size === item.size && entry.color === item.color);
    if (product.variants.length && !variant) throw Object.assign(new Error(`${product.name}: ไม่มีตัวเลือกสินค้าที่เลือก`), { statusCode: 409 });
    const available = variant ? variant.stock : product.stock;
    if (available < item.quantity || product.stock < item.quantity) throw Object.assign(new Error(`${product.name}: สินค้าไม่พอในสต็อก`), { statusCode: 409 });

    const stockFilter = variant
      ? { _id: product._id, stock: { $gte: item.quantity }, variants: { $elemMatch: { size: item.size, color: item.color, stock: { $gte: item.quantity } } } }
      : { _id: product._id, stock: { $gte: item.quantity } };
    const stockUpdate = variant
      ? { $inc: { stock: -item.quantity, "variants.$[variant].stock": -item.quantity } }
      : { $inc: { stock: -item.quantity } };
    const options = variant ? { session, arrayFilters: [{ "variant.size": item.size, "variant.color": item.color, "variant.stock": { $gte: item.quantity } }] } : { session };
    const reserved = await Product.updateOne(stockFilter, stockUpdate, options);
    if (reserved.modifiedCount !== 1) throw Object.assign(new Error(`${product.name}: สต็อกเปลี่ยน กรุณาตรวจตะกร้าอีกครั้ง`), { statusCode: 409 });

    orderItems.push({
      product: product._id,
      productName: product.name,
      image: product.image,
      quantity: item.quantity,
      size: item.size,
      color: item.color,
      price: Number(product.salePrice ?? product.price),
      hasVariant: product.variants.length > 0
    });
  }
  return orderItems;
}

async function releaseOrderStock(order, session) {
  for (const item of order.items) {
    const update = { $inc: { stock: item.quantity } };
    if (item.hasVariant) {
      update.$inc["variants.$[variant].stock"] = item.quantity;
      await Product.updateOne({ _id: item.product }, update, {
        session,
        arrayFilters: [{ "variant.size": item.size, "variant.color": item.color }]
      });
    } else {
      await Product.updateOne({ _id: item.product }, update, { session });
    }
  }
}

async function createOrder(req, res, next) {
  let order;
  try {
    const shippingAddress = String(req.body.shippingAddress || "").trim().slice(0, 1000);
    const paymentMethod = req.body.paymentMethod === "promptpay" ? "promptpay" : req.body.paymentMethod === "cod" ? "cod" : "";
    if (!shippingAddress || shippingAddress.length < 10 || !paymentMethod) {
      return res.status(400).json({ message: "กรุณาระบุที่อยู่จัดส่งและช่องทางชำระเงิน" });
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const items = await reserveItems(req.body.items, session);
        const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
        [order] = await Order.create([{
          user: req.auth.id,
          items,
          subtotal,
          shippingFee,
          totalAmount: subtotal + shippingFee,
          shippingAddress,
          paymentMethod,
          paymentStatus: "pending",
          status: paymentMethod === "cod" ? "confirmed" : "pending_payment"
        }], { session });
      });
    } finally { await session.endSession(); }

    if (paymentMethod === "promptpay") {
      const charge = await createPromptPayCharge({ amountBaht: order.totalAmount, description: `Zneaker order ${order._id}` }, { payment_type: "order", order_id: order._id });
      const qrImageUrl = charge.source?.scannable_code?.image?.download_uri;
      const qrUrl = qrImageUrl ? new URL(qrImageUrl) : null;
      if (!charge.id || charge.status !== "pending" || charge.source?.type !== "promptpay" || !qrUrl || qrUrl.protocol !== "https:" || qrUrl.hostname !== "api.omise.co" || charge.currency?.toLowerCase() !== "thb" || charge.amount !== order.totalAmount * 100) {
        throw Object.assign(new Error("ระบบชำระเงินไม่สามารถสร้าง QR ได้"), { statusCode: 502 });
      }
      order.chargeId = charge.id;
      order.qrImageUrl = qrImageUrl;
      await order.save();
    }
    const customer = await User.findById(req.auth.id).select("name email");
    if (customer) await notifyOrder(order, customer, "created");
    res.status(201).json(order);
  } catch (error) {
    if (order?._id && order.paymentMethod === "promptpay" && !order.chargeId) {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const current = await Order.findOne({ _id: order._id, status: "pending_payment" }).session(session);
          if (!current) return;
          current.status = "cancelled";
          current.paymentStatus = "failed";
          await current.save({ session });
          await releaseOrderStock(current, session);
        });
      } catch (restoreError) { console.error("Unable to restore stock after payment setup failure", restoreError); }
      finally { await session.endSession(); }
    }
    next(error);
  }
}

async function applyOrderCharge(charge, shouldExpire = false) {
  if (charge.currency?.toLowerCase() !== "thb" || charge.source?.type !== "promptpay") return false;
  const orderId = charge.metadata?.order_id;
  if (!validId(orderId)) return false;
  const session = await mongoose.startSession();
  let changed = false;
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({ _id: orderId, status: "pending_payment", $or: [{ chargeId: charge.id }, { chargeId: null }] }).session(session);
      if (!order) return;
      if (charge.amount !== order.totalAmount * 100) throw new Error("Payment amount mismatch");
      order.chargeId = charge.id;
      if (shouldExpire && charge.status === "expired") {
        order.status = "cancelled";
        order.paymentStatus = "failed";
        await order.save({ session });
        await releaseOrderStock(order, session);
        changed = true;
      } else if (!shouldExpire && charge.status === "successful") {
        order.status = "confirmed";
        order.paymentStatus = "paid";
        order.paidAt = charge.paid_at ? new Date(charge.paid_at) : new Date();
        await order.save({ session });
        changed = true;
      }
    });
    if (changed && !shouldExpire) {
      const order = await Order.findById(orderId);
      const user = order ? await User.findById(order.user).select("name email") : null;
      if (order && user) await notifyOrder(order, user, "paid");
    }
    return changed;
  } finally { await session.endSession(); }
}

async function reconcileOrder(req, res, next) {
  try {
    const filter = req.auth.role === "admin" ? { _id: req.params.id } : { _id: req.params.id, user: req.auth.id };
    let order = await Order.findOne(filter);
    if (!order) return res.status(404).json({ message: "ไม่พบคำสั่งซื้อ" });
    if (order.status === "pending_payment" && order.chargeId) {
      const charge = await getCharge(order.chargeId);
      await applyOrderCharge(charge, charge.status === "expired");
      order = await Order.findById(order._id);
    }
    res.json(order);
  } catch (error) { next(error); }
}

async function updateOrder(req, res, next) {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ message: "ไม่พบคำสั่งซื้อ" });
    const allowed = ["confirmed", "shipping", "delivered", "cancelled"];
    if (!allowed.includes(req.body.status)) return res.status(400).json({ message: "สถานะคำสั่งซื้อไม่ถูกต้อง" });
    let order;
    if (req.body.status === "cancelled") {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          order = await Order.findOne({ _id: req.params.id, paymentMethod: "cod", paymentStatus: "pending", status: "confirmed" }).session(session);
          if (!order) return;
          order.status = "cancelled";
          order.paymentStatus = "failed";
          await order.save({ session });
          await releaseOrderStock(order, session);
        });
      } finally { await session.endSession(); }
      if (!order) return res.status(409).json({ message: "ยกเลิกได้เฉพาะคำสั่งซื้อ COD ที่ยังไม่ชำระ" });
      return res.json(order);
    }
    order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "ไม่พบคำสั่งซื้อ" });
    if (order.status === "pending_payment" || (order.paymentMethod === "promptpay" && order.paymentStatus !== "paid")) {
      return res.status(409).json({ message: "ยังเปลี่ยนสถานะไม่ได้จนกว่าจะชำระเงิน" });
    }
    const transitions = { confirmed: ["confirmed", "shipping"], shipping: ["shipping", "delivered"], delivered: ["delivered"] };
    if (!transitions[order.status]?.includes(req.body.status)) return res.status(409).json({ message: "เปลี่ยนสถานะคำสั่งซื้อตามลำดับไม่ได้" });
    order.status = req.body.status;
    await order.save();
    res.json(order);
  } catch (error) { next(error); }
}

module.exports = { getOrders, getOrderById, createOrder, updateOrder, applyOrderCharge, reconcileOrder };
