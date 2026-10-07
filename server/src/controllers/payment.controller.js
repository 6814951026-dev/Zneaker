const mongoose = require("mongoose");
const TopUp = require("../models/top-up.model");
const User = require("../models/user.model");
const { createPromptPayCharge, getCharge } = require("../services/opn.service");
const { applyOrderCharge } = require("./order.controller");

const BAHT_PER_POINT = 50;
const MAX_POINTS_PER_CHARGE = 3000;

function publicTopUp(topUp) {
  return {
    id: String(topUp._id),
    points: topUp.points,
    amountBaht: topUp.amountBaht,
    status: topUp.status,
    qrImageUrl: topUp.qrImageUrl,
    expiresAt: topUp.expiresAt,
    createdAt: topUp.createdAt
  };
}

async function createTopUp(req, res, next) {
  let topUp;
  try {
    await TopUp.updateMany(
      { user: req.auth.id, status: "pending", expiresAt: { $lte: new Date() } },
      { $set: { status: "expired" } }
    );
    const existing = await TopUp.findOne({ user: req.auth.id, status: "pending" }).sort({ createdAt: -1 });
    if (existing) return res.json(publicTopUp(existing));

    const points = Number(req.body?.points);
    if (!Number.isSafeInteger(points) || points < 1 || points > MAX_POINTS_PER_CHARGE) {
      return res.status(400).json({ message: "เติมได้ครั้งละ 1 ถึง 3,000 แต้ม (50 ถึง 150,000 บาท)" });
    }

    topUp = await TopUp.create({
      user: req.auth.id,
      points,
      amountBaht: points * BAHT_PER_POINT
    });

    const charge = await createPromptPayCharge(topUp);
    const qrImageUrl = charge.source?.scannable_code?.image?.download_uri;
    if (!charge.id || charge.status !== "pending" || charge.source?.type !== "promptpay" || !qrImageUrl || charge.currency?.toLowerCase() !== "thb" || charge.amount !== topUp.amountBaht * 100) {
      throw Object.assign(new Error("Payment provider did not return a valid PromptPay QR"), { statusCode: 502 });
    }

    const qrUrl = new URL(qrImageUrl);
    if (qrUrl.protocol !== "https:" || qrUrl.hostname !== "api.omise.co") {
      throw Object.assign(new Error("Payment provider returned an invalid QR URL"), { statusCode: 502 });
    }

    topUp.chargeId = charge.id;
    topUp.qrImageUrl = qrImageUrl;
    topUp.expiresAt = charge.expires_at ? new Date(charge.expires_at) : null;
    await topUp.save();
    return res.status(201).json(publicTopUp(topUp));
  } catch (error) {
    if (topUp?._id) {
      await TopUp.updateOne({ _id: topUp._id, status: "pending" }, { $set: { status: "failed" } }).catch(() => {});
    }
    if (error.code === 11000) {
      const existing = await TopUp.findOne({ user: req.auth.id, status: "pending" }).sort({ createdAt: -1 });
      if (existing) return res.json(publicTopUp(existing));
    }
    return next(error);
  }
}

async function getCurrentTopUp(req, res, next) {
  try {
    await TopUp.updateMany(
      { user: req.auth.id, status: "pending", expiresAt: { $lte: new Date() } },
      { $set: { status: "expired" } }
    );
    const topUp = await TopUp.findOne({ user: req.auth.id, status: "pending" }).sort({ createdAt: -1 });
    return res.json(topUp ? publicTopUp(topUp) : null);
  } catch (error) {
    return next(error);
  }
}

async function getTopUpStatus(req, res, next) {
  try {
    let topUp = await TopUp.findOne({ _id: req.params.id, user: req.auth.id });
    if (!topUp) return res.status(404).json({ message: "ไม่พบรายการเติมแต้ม" });

    // Reconcile directly with Opn while the member is viewing a pending QR.
    // This also recovers from a delayed or misconfigured webhook.
    if (topUp.status === "pending" && topUp.chargeId) {
      const charge = await getCharge(topUp.chargeId);
      if (charge.status === "successful") {
        await applySuccessfulCharge(charge);
        topUp = await TopUp.findById(topUp._id);
      } else if (charge.status === "expired") {
        await TopUp.updateOne({ _id: topUp._id, status: "pending" }, { $set: { status: "expired" } });
        topUp = await TopUp.findById(topUp._id);
      }
    }
    return res.json(publicTopUp(topUp));
  } catch (error) {
    if (error.name === "CastError") return res.status(404).json({ message: "ไม่พบรายการเติมแต้ม" });
    return next(error);
  }
}

async function applySuccessfulCharge(charge) {
  if (charge.status !== "successful" || charge.currency?.toLowerCase() !== "thb" || charge.source?.type !== "promptpay") return false;

  const topUpId = charge.metadata?.top_up_id;
  const session = await mongoose.startSession();
  let applied = false;
  try {
    await session.withTransaction(async () => {
      const filter = topUpId
        ? { _id: topUpId }
        : { chargeId: charge.id };
      const topUp = await TopUp.findOne(filter).session(session);
      if (!topUp || topUp.status !== "pending") return;
      if (topUp.chargeId && topUp.chargeId !== charge.id) throw new Error("Payment reference mismatch");
      if (charge.amount !== topUp.amountBaht * 100) throw new Error("Payment amount mismatch");

      const updated = await TopUp.updateOne(
        { _id: topUp._id, status: "pending" },
        { $set: { status: "successful", chargeId: charge.id, paidAt: charge.paid_at ? new Date(charge.paid_at) : new Date() } },
        { session }
      );
      if (updated.modifiedCount !== 1) return;

      const user = await User.findByIdAndUpdate(topUp.user, {
        $inc: { points: topUp.points },
        $push: {
          transactions: {
            type: "topup",
            points: topUp.points,
            amountBaht: topUp.amountBaht,
            description: `เติมแต้มผ่าน PromptPay · ${topUp.points.toLocaleString("th-TH")} แต้ม`
          }
        }
      }, { new: true, session });
      if (!user) throw new Error("Top-up customer no longer exists");
      applied = true;
    });
    return applied;
  } finally {
    await session.endSession();
  }
}

async function webhook(req, res, next) {
  try {
    const event = req.body;
    const chargeId = event?.data?.object === "charge" ? event.data.id : null;
    if (!chargeId || !["charge.complete", "charge.expire"].includes(event.key)) {
      return res.status(200).json({ received: true });
    }

    // Confirm event data against the provider before changing a user's point balance.
    const charge = await getCharge(chargeId);
    if (charge.metadata?.payment_type === "order") {
      await applyOrderCharge(charge, event.key === "charge.expire");
      return res.status(200).json({ received: true });
    }
    if (event.key === "charge.complete" && charge.status === "successful") {
      await applySuccessfulCharge(charge);
    } else if (event.key === "charge.expire" && charge.status === "expired") {
      const topUpId = charge.metadata?.top_up_id;
      if (topUpId) await TopUp.updateOne({ _id: topUpId, status: "pending" }, { $set: { status: "expired" } });
      else await TopUp.updateOne({ chargeId: charge.id, status: "pending" }, { $set: { status: "expired" } });
    }
    return res.status(200).json({ received: true });
  } catch (error) {
    return next(error);
  }
}

module.exports = { createTopUp, getCurrentTopUp, getTopUpStatus, webhook };
