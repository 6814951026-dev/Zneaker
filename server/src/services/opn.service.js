const API_BASE = "https://api.omise.co";

function secretKey() {
  const key = process.env.OPN_SECRET_KEY || process.env.OMISE_SECRET_KEY;
  if (!key) {
    const error = new Error("OPN_SECRET_KEY is not configured");
    error.statusCode = 503;
    throw error;
  }
  return key;
}

async function request(path, { method = "GET", form } = {}) {
  const headers = {
    Authorization: `Basic ${Buffer.from(`${secretKey()}:`).toString("base64")}`
  };
  const options = { method, headers };
  if (form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    options.body = new URLSearchParams(form).toString();
  }

  const response = await fetch(`${API_BASE}${path}`, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || "Payment provider request failed");
    error.statusCode = 502;
    throw error;
  }
  return payload;
}

function createPromptPayCharge(payment, metadata = {}) {
  return request("/charges", {
    method: "POST",
    form: {
      amount: String(topUp.amountBaht * 100),
      currency: "THB",
      "source[type]": "promptpay",
      description: payment.description || `Zneaker Club top-up ${payment.points} points`,
      ...Object.fromEntries(Object.entries(metadata).map(([key, value]) => [`metadata[${key}]`, String(value)])),
      ...(!Object.keys(metadata).length ? { "metadata[top_up_id]": String(payment._id) } : {})
    }
  });
}

function getCharge(chargeId) {
  return request(`/charges/${encodeURIComponent(chargeId)}`);
}

module.exports = { createPromptPayCharge, getCharge };
