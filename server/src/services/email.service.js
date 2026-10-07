const API_URL = "https://api.resend.com/emails";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

async function sendEmail(to, subject, html, idempotencyKey) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ORDER_EMAIL_FROM;
  if (!apiKey || !from || !to) return;
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ from, to: [to], subject, html })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Order email delivery failed (${response.status}): ${detail.slice(0, 300)}`);
  }
}

function orderEmailHtml(order, userName, paid) {
  const rows = order.items.map((item) => `<tr><td style="padding:10px;border-bottom:1px solid #eee">${escapeHtml(item.productName)} · ${escapeHtml(item.size)} · ${escapeHtml(item.color)} × ${item.quantity}</td><td style="padding:10px;border-bottom:1px solid #eee;text-align:right">฿${(item.price * item.quantity).toLocaleString("th-TH")}</td></tr>`).join("");
  const state = paid ? "ชำระเงินสำเร็จ" : order.paymentMethod === "promptpay" ? "รอชำระผ่าน PromptPay" : "เก็บเงินปลายทาง";
  return `<div style="font-family:Arial,sans-serif;color:#171817;max-width:620px;margin:auto"><h1>Zneaker</h1><p>สวัสดี ${escapeHtml(userName)}, ${paid ? "เราได้รับการชำระเงินแล้ว" : "เราได้รับคำสั่งซื้อของคุณแล้ว"}</p><p>คำสั่งซื้อ #${escapeHtml(String(order._id))} · ${state}</p><table style="width:100%;border-collapse:collapse">${rows}<tr><td style="padding:10px">ค่าจัดส่ง</td><td style="padding:10px;text-align:right">฿${order.shippingFee.toLocaleString("th-TH")}</td></tr><tr><td style="padding:10px;font-weight:bold">ยอดรวม</td><td style="padding:10px;text-align:right;font-weight:bold">฿${order.totalAmount.toLocaleString("th-TH")}</td></tr></table><p>จัดส่งไปที่: ${escapeHtml(order.shippingAddress)}</p><p>ตรวจสอบสถานะคำสั่งซื้อได้ในบัญชี Zneaker ของคุณ</p></div>`;
}

async function notifyOrder(order, user, phase) {
  if (!process.env.RESEND_API_KEY || !process.env.ORDER_EMAIL_FROM) return;
  const paid = phase === "paid";
  const subject = `${paid ? "ชำระเงินสำเร็จ" : "ยืนยันคำสั่งซื้อ"} Zneaker #${String(order._id).slice(-7).toUpperCase()}`;
  const html = orderEmailHtml(order, user.name, paid);
  const messages = [];
  if (user.email) messages.push(sendEmail(user.email, subject, html, `zneaker-${order._id}-${phase}-customer`));
  if (process.env.ADMIN_ORDER_EMAIL) messages.push(sendEmail(process.env.ADMIN_ORDER_EMAIL, `[Admin] ${subject}`, html, `zneaker-${order._id}-${phase}-admin`));
  const results = await Promise.allSettled(messages);
  for (const result of results) if (result.status === "rejected") console.error(result.reason.message);
}

module.exports = { notifyOrder };
