const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/user.model");
const Product = require("../models/product.model");
const { createToken } = require("../middlewares/auth.middleware");
const SAFE_USER = "name email phone role points lastCheckinDate createdAt";
const todayBangkok = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const publicUser = (user) => ({ id: String(user._id), name: user.name, email: user.email, phone: user.phone, role: user.role, points: user.points || 0 });
const session = (user) => ({ token: createToken(user), user: publicUser(user) });

async function getUsers(req, res, next) {
  try { res.json(await User.find().select(SAFE_USER).sort({ createdAt: -1 })); } catch (error) { next(error); }
}
async function createUser(req, res, next) {
  try {
    const { name, email, phone, password } = req.body;
    const user = await User.create({ name, email, phone, password: await bcrypt.hash(String(password || ""), 12) });
    res.status(201).json(session(user));
  } catch (error) { next(error); }
}
async function login(req, res, next) {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const user = await User.findOne({ email }).select("+password");
    if (!user) return res.status(401).json({ message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
    const isHash = /^\$2[aby]\$/.test(user.password);
    const valid = isHash ? await bcrypt.compare(password, user.password) : user.password === password;
    if (!valid) return res.status(401).json({ message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
    if (!isHash) { user.password = await bcrypt.hash(password, 12); await user.save(); }
    res.json(session(user));
  } catch (error) { next(error); }
}
async function me(req, res, next) {
  try {
    const user = await User.findById(req.auth.id).select(SAFE_USER)
      .populate({ path: "draws.product", select: "name image price" })
      .populate({ path: "transactions.product", select: "name image" });
    if (!user) return res.status(404).json({ message: "ไม่พบบัญชีสมาชิก" });
    const today = todayBangkok();
    res.json({ user: publicUser(user), points: user.points || 0, checkedInToday: user.lastCheckinDate === today,
      transactions: [...user.transactions].reverse(), draws: [...user.draws].reverse() });
  } catch (error) { next(error); }
}
async function checkIn(req, res, next) {
  try {
    const today = todayBangkok();
    const user = await User.findOneAndUpdate(
      { _id: req.auth.id, lastCheckinDate: { $ne: today } },
      { $set: { lastCheckinDate: today }, $inc: { points: 10 }, $push: { transactions: { type: "checkin", points: 10, description: "เช็คอินประจำวัน" } } },
      { new: true }
    );
    if (!user) {
      const exists = await User.exists({ _id: req.auth.id });
      return res.status(exists ? 409 : 404).json({ message: exists ? "วันนี้เช็คอินรับแต้มไปแล้ว" : "ไม่พบบัญชีสมาชิก" });
    }
    res.json({ points: user.points, checkedInToday: true });
  } catch (error) { next(error); }
}
async function draw(req, res, next) {
  try {
    const [product] = await Product.aggregate([{ $sample: { size: 1 } }]);
    if (!product) return res.status(503).json({ message: "ขณะนี้ยังไม่มีสินค้าให้สุ่ม" });
    const user = await User.findOneAndUpdate(
      { _id: req.auth.id, points: { $gte: 1000 } },
      { $inc: { points: -1000 }, $push: {
        draws: { product: product._id, pointsSpent: 1000 },
        transactions: { type: "draw", points: -1000, description: `สุ่มรับรองเท้า · ${product.name}`, product: product._id }
      } }, { new: true }
    );
    if (!user) return res.status(409).json({ message: "แต้มไม่พอสำหรับการสุ่ม (ต้องมี 1,000 แต้ม)" });
    res.json({ points: user.points, draw: { product, pointsSpent: 1000 } });
  } catch (error) { next(error); }
}
async function topUp(req, res, next) {
  try {
    const points = Number(req.body.points);
    if (!Number.isSafeInteger(points) || points < 1 || points > 100000)
      return res.status(400).json({ message: "จำนวนแต้มต้องเป็นจำนวนเต็มระหว่าง 1 ถึง 100,000" });
    const amountBaht = points * 50;
    const user = await User.findByIdAndUpdate(req.auth.id, {
      $inc: { points },
      $push: { transactions: { type: "topup", points, amountBaht, description: `เติมแต้มโหมดทดลอง · ฿${amountBaht.toLocaleString("th-TH")}` } }
    }, { new: true });
    if (!user) return res.status(404).json({ message: "ไม่พบบัญชีสมาชิก" });
    res.json({ points: user.points, creditedPoints: points, amountBaht, demo: true });
  } catch (error) { next(error); }
}
module.exports = { getUsers, createUser, login, me, checkIn, draw, topUp };
