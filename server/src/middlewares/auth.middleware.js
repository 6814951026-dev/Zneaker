const jwt = require("jsonwebtoken");
const secret = () => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET is not configured");
  return "zneaker-development-secret-change-before-deploying";
};
function requireAuth(req, res, next) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ message: "กรุณาเข้าสู่ระบบ" });
  try { req.auth = jwt.verify(token, secret()); next(); }
  catch { return res.status(401).json({ message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" }); }
}
function requireAdmin(req, res, next) { if (req.auth.role !== "admin") return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" }); next(); }
function createToken(user) { return jwt.sign({ id: String(user._id), role: user.role }, secret(), { expiresIn: "7d" }); }
module.exports = { requireAuth, requireAdmin, createToken };
