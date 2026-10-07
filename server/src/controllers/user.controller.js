const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/user.model");
const Product = require("../models/product.model");
const { createToken } = require("../middlewares/auth.middleware");
const SAFE_USER = "name email phone role points lastCheckinDate createdAt address addresses";
const PROFILE_FIELDS = `${SAFE_USER} transactions draws`;
const todayBangkok = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const publicUser = (user) => ({ id: String(user._id), name: user.name, email: user.email, phone: user.phone, role: user.role, points: user.points || 0, address: user.address || "", addresses: user.addresses || [] });
const session = (user) => ({ token: createToken(user), user: publicUser(user) });

async function getUsers(req, res, next) {
  try { res.json(await User.find().select(SAFE_USER).sort({ createdAt: -1 })); } catch (error) { next(error); }
}
async function createUser(req, res, next) {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const phone = String(req.body.phone || "").trim();
    const password = String(req.body.password || "");
    if (!name || !email || !phone || password.length < 6) return res.status(400).json({ message: "กรุณากรอกชื่อ อีเมล เบอร์โทร และรหัสผ่านอย่างน้อย 6 ตัว" });
    const user = await User.create({ name, email, phone, password: await bcrypt.hash(password, 12) });
    res.status(201).json(session(user));
  } catch (error) { next(error); }
}
async function login(req, res, next) {
  try {
    const identifier = String(req.body.identifier || req.body.email || "").trim();
    const password = String(req.body.password || "");
    if (!identifier || !password) return res.status(400).json({ message: "กรุณากรอกอีเมลหรือเบอร์โทร และรหัสผ่าน" });
    let lookup;
    if (identifier.includes("@")) {
      // Case-insensitive lookup also supports accounts created before email normalization was enforced.
      const escapedEmail = identifier.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      lookup = { email: new RegExp(`^${escapedEmail}$`, "i") };
    } else {
      lookup = { phone: identifier };
    }
    const user = await User.findOne(lookup).select("+password");
    if (!user) return res.status(401).json({ message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
    const isHash = /^\$2[aby]\$/.test(user.password);
    let valid = false;
    try { valid = isHash ? await bcrypt.compare(password, user.password) : user.password === password; }
    catch { valid = false; }
    if (!valid) return res.status(401).json({ message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
    if (!isHash) { user.password = await bcrypt.hash(password, 12); await user.save(); }
    res.json(session(user));
  } catch (error) { next(error); }
}
async function me(req, res, next) {
  try {
    const user = await User.findById(req.auth.id).select(PROFILE_FIELDS).lean();
    if (!user) return res.status(404).json({ message: "ไม่พบบัญชีสมาชิก" });
    const transactions = Array.isArray(user.transactions) ? user.transactions : [];
    const draws = Array.isArray(user.draws) ? user.draws : [];
    const productIds = [...new Set([...transactions, ...draws].map((entry) => entry.product).filter((id) => id && mongoose.isValidObjectId(id)).map(String))];
    const products = productIds.length
      ? await Product.find({ _id: { $in: productIds } }).select("name image price").lean()
      : [];
    const productById = new Map(products.map((product) => [String(product._id), product]));
    const today = todayBangkok();
    res.json({ user: publicUser(user), points: user.points || 0, checkedInToday: user.lastCheckinDate === today,
      transactions: transactions.slice().reverse().map((entry) => ({ ...entry, product: productById.get(String(entry.product)) || null })),
      draws: draws.slice().reverse().map((entry) => ({ ...entry, product: productById.get(String(entry.product)) || null })) });
  } catch (error) { next(error); }
}
async function updateProfile(req, res, next) {
  try {
    const update = {};
    if (req.body.name !== undefined) update.name = String(req.body.name).trim().slice(0, 100);
    if (req.body.phone !== undefined) update.phone = String(req.body.phone).trim().slice(0, 30);
    if (req.body.email !== undefined) update.email = String(req.body.email).trim().toLowerCase();
    if (req.body.address !== undefined) update.address = String(req.body.address).trim().slice(0, 1000);
    if (!Object.keys(update).length) return res.status(400).json({ message: "ไม่มีข้อมูลสำหรับแก้ไข" });
    if ((update.name !== undefined && !update.name) || (update.phone !== undefined && !update.phone)) {
      return res.status(400).json({ message: "ชื่อและเบอร์โทรต้องไม่เว้นว่าง" });
    }
    const user = await User.findByIdAndUpdate(req.auth.id, { $set: update }, { new: true, runValidators: true }).select(SAFE_USER);
    if (!user) return res.status(404).json({ message: "ไม่พบบัญชีสมาชิก" });
    res.json({ user: publicUser(user) });
  } catch (error) { next(error); }
}
async function addAddress(req, res, next) {
  try {
    const fields = ["label", "recipient", "phone", "line1", "line2", "subdistrict", "district", "province", "postalCode"];
    const address = Object.fromEntries(fields.filter((key) => req.body[key] !== undefined).map((key) => [key, String(req.body[key]).trim()]));
    if (!["recipient", "phone", "line1", "province", "postalCode"].every((key) => address[key])) {
      return res.status(400).json({ message: "กรุณากรอกชื่อผู้รับ เบอร์โทร ที่อยู่ จังหวัด และรหัสไปรษณีย์" });
    }
    const user = await User.findById(req.auth.id);
    if (!user) return res.status(404).json({ message: "ไม่พบบัญชีสมาชิก" });
    address.isDefault = user.addresses.length === 0 || req.body.isDefault === true || req.body.isDefault === "true" || req.body.isDefault === "on";
    if (address.isDefault) user.addresses.forEach((entry) => { entry.isDefault = false; });
    user.addresses.push(address);
    await user.save();
    res.status(201).json({ addresses: user.addresses });
  } catch (error) { next(error); }
}
async function deleteAddress(req, res, next) {
  try {
    const user = await User.findById(req.auth.id);
    if (!user) return res.status(404).json({ message: "ไม่พบบัญชีสมาชิก" });
    const address = user.addresses.id(req.params.addressId);
    if (!address) return res.status(404).json({ message: "ไม่พบที่อยู่" });
    const wasDefault = address.isDefault;
    address.deleteOne();
    if (wasDefault && user.addresses.length) user.addresses[0].isDefault = true;
    await user.save();
    res.json({ addresses: user.addresses });
  } catch (error) { next(error); }
}
async function setDefaultAddress(req, res, next) {
  try {
    const user = await User.findById(req.auth.id);
    if (!user) return res.status(404).json({ message: "ไม่พบบัญชีสมาชิก" });
    const selected = user.addresses.id(req.params.addressId);
    if (!selected) return res.status(404).json({ message: "ไม่พบที่อยู่" });
    user.addresses.forEach((entry) => { entry.isDefault = entry._id.equals(selected._id); });
    await user.save();
    res.json({ addresses: user.addresses });
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
    const session = await User.startSession();
    let product;
    try {
      await session.withTransaction(async () => {
        [product] = await Product.aggregate([{ $match: { stock: { $gt: 0 } } }, { $sample: { size: 1 } }]).session(session);
        if (!product) return;
        const user = await User.findOneAndUpdate(
          { _id: req.auth.id, points: { $gte: 1000 } },
          { $inc: { points: -1000 }, $push: {
            draws: { product: product._id, pointsSpent: 1000 },
            transactions: { type: "draw", points: -1000, description: `สุ่มรับรองเท้า · ${product.name}`, product: product._id }
          } }, { new: true, session }
        );
        if (!user) throw Object.assign(new Error("แต้มไม่พอสำหรับการสุ่ม (ต้องมี 1,000 แต้ม)"), { statusCode: 409 });
        const reserved = await Product.updateOne({ _id: product._id, stock: { $gt: 0 } }, { $inc: { stock: -1 } }, { session });
        if (reserved.modifiedCount !== 1) throw Object.assign(new Error("สินค้าเพิ่งหมด กรุณาลองใหม่อีกครั้ง"), { statusCode: 409 });
        product.stock -= 1;
      });
    } finally { await session.endSession(); }
    if (!product) return res.status(503).json({ message: "ขณะนี้ยังไม่มีสินค้าให้สุ่ม" });
    const user = await User.findById(req.auth.id).select("points");
    res.json({ points: user.points, draw: { product, pointsSpent: 1000 } });
  } catch (error) { next(error); }
}
module.exports = { getUsers, createUser, login, me, updateProfile, addAddress, deleteAddress, setDefaultAddress, checkIn, draw };
