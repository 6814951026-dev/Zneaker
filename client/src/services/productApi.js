const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:5000/api" : "/api");

async function request(path, { token, ...options } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || "Request failed");
  return payload;
}

export const getProducts = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/products${query ? `?${query}` : ""}`);
};
export const getProductById = (id) => request(`/products/${id}`);
export const searchProducts = (query) => request(`/products/search?q=${encodeURIComponent(query)}`);
export const createProduct = (product, token) => request("/products", { token, method: "POST", body: JSON.stringify(product) });
export const updateProduct = (id, product, token) => request(`/products/${id}`, { token, method: "PUT", body: JSON.stringify(product) });
export const deleteProduct = (id, token) => request(`/products/${id}`, { token, method: "DELETE" });
export const getReviews = (productId) => request(`/reviews?product=${encodeURIComponent(productId)}`);
export const createReview = (review, token) => request("/reviews", { token, method: "POST", body: JSON.stringify(review) });
export const createOrder = (order, token) => request("/orders", { token, method: "POST", body: JSON.stringify(order) });
export const getOrders = (userId, token) => request(`/orders${userId ? `?user=${encodeURIComponent(userId)}` : ""}`, { token });
export async function uploadImage(file, token) {
  const { upload } = await import("@vercel/blob/client");
  return upload(file.name, file, {
    access: "public",
    handleUploadUrl: `${API_URL}/uploads`,
    clientPayload: JSON.stringify({ token })
  });
}
export const register = (user) => request("/users", { method: "POST", body: JSON.stringify(user) });
export const login = (credentials) => request("/users/login", { method: "POST", body: JSON.stringify(credentials) });
