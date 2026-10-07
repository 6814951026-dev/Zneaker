import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

const API = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:5000/api" : "/api");
const money = (value) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(value || 0);
const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; } };
const formatAddress = (address) => [address?.recipient, address?.phone, address?.line1, address?.line2, address?.subdistrict, address?.district, address?.province, address?.postalCode].filter(Boolean).join(" ");

async function api(path, { token, ...options } = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.message || "เกิดข้อผิดพลาด"); error.status = response.status; throw error; }
  return data;
}

function ProductCard({ product, onAdd }) {
  const sizes = product.sizes?.length ? product.sizes : [38, 39, 40, 41, 42, 43, 44];
  const colors = product.colors?.length ? product.colors : ["มาตรฐาน"];
  const [size, setSize] = useState(sizes[0]);
  const [color, setColor] = useState(colors[0]);
  const price = product.salePrice ?? product.price;
  const selectedVariant = product.variants?.find((variant) => variant.size === Number(size) && variant.color === color);
  const available = product.variants?.length ? (selectedVariant?.stock || 0) : product.stock;
  return <article className="group overflow-hidden border border-stone-200 bg-white transition hover:-translate-y-1 hover:shadow-[6px_6px_0_#f15a24]">
    <div className="relative aspect-[4/3] overflow-hidden bg-[#e9e5dc]"><img loading="lazy" src={product.image} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105"/>
      {product.isNew && <span className="absolute left-3 top-3 bg-black px-2 py-1 text-[10px] font-bold text-white">NEW DROP</span>}
      {product.isSale && <span className="absolute right-3 top-3 bg-orange-500 px-2 py-1 text-[10px] font-bold">SALE</span>}
    </div>
    <div className="p-4"><div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-widest text-stone-500"><span>{product.category}</span><span>★ {Number(product.rating || 0).toFixed(1)} · {product.reviewCount || 0}</span></div>
      <h3 className="mt-2 truncate font-extrabold">{product.name}</h3><div className="mt-1 flex items-center gap-2"><b>{money(price)}</b>{product.originalPrice > price && <del className="text-xs text-stone-400">{money(product.originalPrice)}</del>}</div>
      <p className="mt-1 text-[11px] text-stone-500">{product.stock > 0 ? `มีสินค้า ${product.stock} ชิ้น` : "สินค้าหมด"}</p>
      <div className="mt-4 grid grid-cols-2 gap-2"><select aria-label="ไซซ์" value={size} onChange={(event) => setSize(Number(event.target.value))} className="border border-stone-300 bg-white p-2 text-xs">{sizes.map((item) => <option key={item} value={item}>ไซซ์ {item}</option>)}</select>
        <select aria-label="สี" value={color} onChange={(event) => setColor(event.target.value)} className="border border-stone-300 bg-white p-2 text-xs">{colors.map((item) => <option key={item}>{item}</option>)}</select></div>
      <button disabled={!available} onClick={() => onAdd(product, size, color)} className="mt-3 w-full bg-black p-3 text-xs font-bold text-white hover:bg-orange-500 hover:text-black disabled:bg-stone-300">{available ? "เพิ่มลงตะกร้า +" : "สินค้าหมด"}</button>
    </div>
  </article>;
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem("zt") || "");
  const [profile, setProfile] = useState(() => readJson("zu", null));
  const [member, setMember] = useState(null);
  const [products, setProducts] = useState([]);
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [catalog, setCatalog] = useState({ categories: [], genders: [], price: { min: 0, max: 10000 } });
  const [filters, setFilters] = useState({ q: "", category: "", gender: "", minPrice: "", maxPrice: "", sort: "newest" });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ pages: 1, total: 0 });
  const [cart, setCart] = useState(() => readJson("zneaker-cart", []));
  const [orders, setOrders] = useState([]);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [profileOpen, setProfileOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState(null);
  const [topUp, setTopUp] = useState(1);
  const [payment, setPayment] = useState(null);

  const query = useMemo(() => new URLSearchParams(Object.entries({ ...filters, page, limit: 12 }).filter(([, value]) => value !== "")), [filters, page]);
  const cartQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = cartSubtotal >= 2000 ? 0 : 60;

  useEffect(() => { document.title = "Zneaker — Find your next favorite pair"; }, []);
  useEffect(() => { localStorage.setItem("zneaker-cart", JSON.stringify(cart)); }, [cart]);
  useEffect(() => { api("/products/filters").then(setCatalog).catch(() => {}); }, []);
  useEffect(() => {
    let active = true;
    api(`/products?${query}`).then((result) => { if (active) { setProducts(result.products || []); setPagination(result.pagination || { pages: 1, total: (result.products || []).length }); } }).catch((cause) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [query, catalogVersion]);
  useEffect(() => {
    if (!token) { setMember(null); setOrders([]); return; }
    api("/users/me", { token }).then((data) => { setMember(data); setProfile(data.user); localStorage.setItem("zu", JSON.stringify(data.user)); }).catch((cause) => { if (cause.status === 401) logout(); });
    api("/users/top-up", { token }).then(setPayment).catch(() => {});
    api("/orders", { token }).then(setOrders).catch(() => {});
  }, [token]);
  useEffect(() => {
    if (!payment || payment.status !== "pending" || !token) return undefined;
    let active = true;
    const check = () => api(`/users/top-up/${payment.id}`, { token }).then((next) => { if (active) { setPayment(next); if (next.status === "successful") refreshMember(); } }).catch(() => {});
    const timer = setInterval(check, 10000);
    return () => { active = false; clearInterval(timer); };
  }, [payment?.id, payment?.status, token]);
  useEffect(() => {
    if (!order || order.status !== "pending_payment" || !token) return undefined;
    let active = true;
    const check = () => api(`/orders/${order._id}/status`, { token }).then((next) => { if (active) { setOrder(next); if (next.paymentStatus === "paid" || next.status === "cancelled") refreshOrders(); } }).catch(() => {});
    const timer = setInterval(check, 10000);
    return () => { active = false; clearInterval(timer); };
  }, [order?._id, order?.status, token]);

  async function refreshMember() {
    if (!token) return;
    try { const data = await api("/users/me", { token }); setMember(data); setProfile(data.user); localStorage.setItem("zu", JSON.stringify(data.user)); } catch {}
  }
  async function refreshOrders() { if (token) try { setOrders(await api("/orders", { token })); } catch {} }
  function logout() { localStorage.removeItem("zt"); localStorage.removeItem("zu"); setToken(""); setProfile(null); setMember(null); setPayment(null); setOrders([]); }
  async function submitAuth(event) {
    event.preventDefault(); setBusy(true); setError("");
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await api(authMode === "login" ? "/users/login" : "/users", { method: "POST", body: JSON.stringify(body) });
      localStorage.setItem("zt", result.token); localStorage.setItem("zu", JSON.stringify(result.user)); setToken(result.token); setProfile(result.user); setAuthOpen(false); setMessage("เข้าสู่ระบบสำเร็จ");
    } catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  function addToCart(product, size, color) {
    setCart((current) => {
      const stock = product.variants?.length ? (product.variants.find((variant) => variant.size === Number(size) && variant.color === color)?.stock || 0) : product.stock;
      const found = current.find((item) => item.product === product._id && item.size === size && item.color === color);
      if (found) return current.map((item) => item === found ? { ...item, quantity: Math.min(item.quantity + 1, stock), stock } : item);
      return [...current, { product: product._id, productName: product.name, image: product.image, price: product.salePrice ?? product.price, size, color, quantity: 1, stock }];
    });
    setMessage("เพิ่มสินค้าในตะกร้าแล้ว");
  }
  function updateCart(index, quantity) { setCart((current) => current.map((item, i) => i === index ? { ...item, quantity: Math.max(1, Math.min(item.stock, quantity)) } : item)); }
  async function checkout(event) {
    event.preventDefault();
    if (!token) { setCartOpen(false); setAuthOpen(true); return; }
    const body = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const created = await api("/orders", { token, method: "POST", body: JSON.stringify({ items: cart.map(({ product, quantity, size, color }) => ({ product, quantity, size, color })), shippingAddress: body.get("shippingAddress"), paymentMethod: body.get("paymentMethod") }) });
      setOrder(created); setCart([]); setCartOpen(false); setMessage("สร้างคำสั่งซื้อแล้ว"); await refreshOrders();
    } catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  async function createTopUp(event) {
    event.preventDefault(); setBusy(true); setError("");
    try { const result = await api("/users/top-up", { token, method: "POST", body: JSON.stringify({ points: Number(topUp) }) }); setPayment(result); }
    catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  async function saveProfile(event) {
    event.preventDefault(); setBusy(true); setError("");
    try { const result = await api("/users/me", { token, method: "PATCH", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); setProfile(result.user); setMember((current) => ({ ...current, user: result.user })); localStorage.setItem("zu", JSON.stringify(result.user)); setMessage("บันทึกข้อมูลแล้ว"); }
    catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  async function addAddress(event) {
    event.preventDefault(); const form = event.currentTarget; setBusy(true); setError("");
    try { const result = await api("/users/me/addresses", { token, method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form))) }); const nextProfile = { ...profile, addresses: result.addresses }; setProfile(nextProfile); setMember((current) => ({ ...current, user: nextProfile })); form.reset(); }
    catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  async function mutateAddress(id, method, suffix = "") {
    try { const result = await api(`/users/me/addresses/${id}${suffix}`, { token, method }); const nextProfile = { ...profile, addresses: result.addresses }; setProfile(nextProfile); setMember((current) => ({ ...current, user: nextProfile })); }
    catch (cause) { setError(cause.message); }
  }
  async function createCatalogProduct(event) {
    event.preventDefault(); const form = event.currentTarget; setBusy(true); setError("");
    const data = new FormData(form);
    const sizes = String(data.get("sizes") || "").split(",").map(Number).filter((value) => Number.isInteger(value) && value >= 1);
    const colors = String(data.get("colors") || "").split(",").map((value) => value.trim()).filter(Boolean);
    try {
      await api("/products", { token, method: "POST", body: JSON.stringify({ name: data.get("name"), description: data.get("description"), category: data.get("category"), gender: data.get("gender"), price: Number(data.get("price")), stock: Number(data.get("stock")), image: data.get("image"), images: [data.get("image")], sizes, colors }) });
      form.reset(); setPage(1); setCatalogVersion((version) => version + 1); api("/products/filters").then(setCatalog).catch(() => {}); setMessage("เพิ่มสินค้าในแคตตาล็อกแล้ว");
    } catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  async function setOrderStatus(id, status) {
    try { await api(`/orders/${id}`, { token, method: "PUT", body: JSON.stringify({ status }) }); await refreshOrders(); }
    catch (cause) { setError(cause.message); }
  }

  return <div className="min-h-screen bg-[#f5f2eb] text-[#171817]">
    <div className="bg-orange-500 px-3 py-2 text-center text-[10px] font-black tracking-[.2em]">FREE SHIPPING OVER ฿2,000 · STEP INTO SOMETHING NEW</div>
    <header className="sticky top-0 z-30 border-b border-black/10 bg-[#f5f2eb]/95 backdrop-blur"><div className="mx-auto flex h-[70px] max-w-7xl items-center justify-between px-4 sm:px-6">
      <a href="#home" className="text-2xl font-black tracking-tighter"><b className="mr-2 bg-black px-2 text-orange-500">Z</b>Zneaker</a>
      <nav className="hidden items-center gap-7 text-xs font-bold uppercase tracking-widest md:flex"><a href="#shop">Shop</a><a href="#club">Z Club</a><a href="#about">Our story</a></nav>
      <div className="flex items-center gap-2"><button onClick={() => setCartOpen(true)} className="relative border border-black px-3 py-2 text-xs font-bold">BAG <span className="ml-1 text-orange-600">{cartQuantity}</span></button>
        {profile ? <button onClick={() => setProfileOpen(true)} className="bg-black px-3 py-2 text-xs font-bold text-white">{profile.name?.split(" ")[0]} · {member?.points || 0} PTS</button> : <button onClick={() => setAuthOpen(true)} className="bg-black px-4 py-3 text-xs font-bold text-white">SIGN IN</button>}</div>
    </div></header>

    <main id="home"><section className="mx-auto grid min-h-[500px] max-w-7xl items-center gap-8 px-5 py-10 md:grid-cols-2 md:py-16"><div><p className="text-[10px] font-black tracking-[.25em] text-orange-600">THE EVERYDAY ICONS / VOL. 06</p><h1 className="mt-5 text-6xl font-black leading-[.92] tracking-[-.08em] sm:text-8xl">MADE TO<br/><span className="text-orange-600">MOVE</span> YOUR<br/>OWN WAY.</h1><p className="mt-6 max-w-md text-sm leading-7 text-stone-600">รองเท้าคู่ที่ใช่ เปลี่ยนทุกวันธรรมดาให้มีจังหวะของคุณ ค้นหาคู่โปรดจากคอลเลกชันที่เราคัดมาแล้ว</p><a href="#shop" className="mt-7 inline-block bg-black px-6 py-4 text-xs font-bold text-white shadow-[5px_5px_0_#f15a24]">เลือกคู่โปรด ↗</a></div>
      <div className="relative mx-auto aspect-[.95] w-full max-w-xl overflow-hidden rounded-t-[48%] border border-black bg-stone-200 md:rotate-2"><img fetchPriority="high" src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1000&q=85" alt="สนีกเกอร์สีแดง" className="h-full w-full object-cover"/><span className="absolute right-4 top-4 bg-[#f5f2eb] p-3 text-[10px] font-bold">ZN / 01<br/>MOVE FORWARD</span></div>
    </section>

    <section id="shop" className="scroll-mt-20 border-y border-black/10 bg-[#eae5da] px-4 py-14 sm:px-6 sm:py-16"><div className="mx-auto max-w-7xl"><div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><small className="font-black tracking-[.2em] text-orange-600">THE ROTATION</small><h2 className="mt-1 text-3xl font-black sm:text-4xl">คู่ที่กำลังมาแรง</h2><p className="mt-2 text-xs text-stone-500">{pagination.total} รุ่นที่พร้อมออกไปกับคุณ</p></div><label className="w-full sm:w-72"><span className="sr-only">ค้นหาสินค้า</span><input value={filters.q} onChange={(event) => { setPage(1); setFilters({ ...filters, q: event.target.value }); }} placeholder="ค้นหารองเท้า รุ่น หรือสี..." className="w-full border-b border-stone-500 bg-transparent p-2 text-sm outline-none focus:border-orange-600"/></label></div>
      <div className="mb-7 grid grid-cols-2 gap-2 md:grid-cols-5"><select value={filters.category} onChange={(event) => { setPage(1); setFilters({ ...filters, category: event.target.value }); }} className="border border-stone-300 bg-white p-3 text-xs"><option value="">ทุกหมวดหมู่</option>{catalog.categories.map((category) => <option key={category}>{category}</option>)}</select>
        <select value={filters.gender} onChange={(event) => { setPage(1); setFilters({ ...filters, gender: event.target.value }); }} className="border border-stone-300 bg-white p-3 text-xs"><option value="">ทุกเพศ</option>{catalog.genders.map((gender) => <option key={gender}>{gender}</option>)}</select>
        <input type="number" min="0" value={filters.minPrice} onChange={(event) => { setPage(1); setFilters({ ...filters, minPrice: event.target.value }); }} placeholder="ราคาต่ำสุด" className="border border-stone-300 bg-white p-3 text-xs"/>
        <input type="number" min="0" value={filters.maxPrice} onChange={(event) => { setPage(1); setFilters({ ...filters, maxPrice: event.target.value }); }} placeholder="ราคาสูงสุด" className="border border-stone-300 bg-white p-3 text-xs"/>
        <select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })} className="col-span-2 border border-stone-300 bg-white p-3 text-xs md:col-span-1"><option value="newest">มาใหม่</option><option value="popular">ขายดี</option><option value="rating">คะแนนสูง</option><option value="price_asc">ราคาต่ำไปสูง</option><option value="price_desc">ราคาสูงไปต่ำ</option></select></div>
      {products.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">{products.map((product) => <ProductCard key={product._id} product={product} onAdd={addToCart}/>)}</div> : <div className="border border-stone-300 bg-white py-16 text-center text-sm text-stone-500">{error || "ไม่พบสินค้าที่ตรงกับการค้นหา"}</div>}
      {pagination.pages > 1 && <div className="mt-9 flex items-center justify-center gap-4"><button disabled={page <= 1} onClick={() => { setPage(page - 1); document.querySelector("#shop")?.scrollIntoView({ behavior: "smooth" }); }} className="border border-black px-4 py-2 text-xs disabled:opacity-30">ก่อนหน้า</button><span className="text-xs">หน้า {page} / {pagination.pages}</span><button disabled={page >= pagination.pages} onClick={() => { setPage(page + 1); document.querySelector("#shop")?.scrollIntoView({ behavior: "smooth" }); }} className="border border-black px-4 py-2 text-xs disabled:opacity-30">ถัดไป</button></div>}
    </div></section>

    <section id="club" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-16 sm:py-20"><small className="font-black tracking-[.2em] text-orange-600">MEMBERS ONLY</small><h2 className="mb-8 mt-2 text-3xl font-black">ทุกก้าวมีแต้มสะสม</h2>{!profile ? <div className="flex flex-col justify-between gap-8 border border-black bg-white p-8 sm:flex-row sm:items-center"><div><h3 className="text-2xl font-black">เข้าร่วม Zneaker Club</h3><p className="mt-2 text-sm text-stone-600">เช็คอิน +10 แต้ม · สุ่มรองเท้า 1,000 แต้ม · เติมแต้ม 1 แต้ม = 50 บาท</p></div><button onClick={() => setAuthOpen(true)} className="bg-black px-6 py-4 text-sm font-bold text-white">เข้าสู่ระบบ / สมัครสมาชิก ↗</button></div> : <div className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]"><div className="bg-black p-7 text-white"><small className="tracking-widest text-orange-500">YOUR BALANCE</small><p className="mt-2 text-5xl font-black">{(member?.points || 0).toLocaleString()} <small className="text-sm text-stone-400">PTS</small></p><p className="text-xs text-stone-400">{profile.name}</p><button disabled={busy || member?.checkedInToday} onClick={async () => { setBusy(true); try { await api("/users/check-in", { token, method: "POST", body: "{}" }); await refreshMember(); setMessage("เช็คอินสำเร็จ รับ 10 แต้ม!"); } catch (cause) { setError(cause.message); } finally { setBusy(false); } }} className="mt-6 w-full bg-orange-500 p-4 text-left text-sm font-bold text-black disabled:bg-stone-700 disabled:text-stone-300">{member?.checkedInToday ? "เช็คอินวันนี้แล้ว ✓" : "เช็คอินวันนี้ รับ 10 แต้ม ↗"}</button><button onClick={logout} className="mt-4 text-xs underline">ออกจากระบบ</button></div>
      <div className="grid gap-4 sm:grid-cols-2"><article className="border border-black bg-white p-6"><small className="font-bold tracking-widest text-orange-600">SNEAKER DRAW</small><h3 className="mt-2 text-xl font-black">สุ่มลุ้นรองเท้า</h3><p className="mt-2 text-xs text-stone-600">ใช้ 1,000 แต้มต่อครั้ง สุ่มรับรองเท้าจากร้าน</p><button disabled={busy || (member?.points || 0) < 1000} onClick={async () => { setBusy(true); try { const result = await api("/users/draw", { token, method: "POST", body: "{}" }); await refreshMember(); setMessage(`ยินดีด้วย! ${result.draw.product.name}`); } catch (cause) { setError(cause.message); } finally { setBusy(false); } }} className="mt-5 w-full bg-black p-3 text-xs font-bold text-white disabled:bg-stone-300">สุ่มเลย · 1,000 แต้ม</button>{member?.draws?.[0] && <p className="mt-4 border-l-2 border-orange-500 pl-3 text-sm font-bold">ผลล่าสุด: {member.draws[0].product?.name}</p>}</article>
        <form onSubmit={createTopUp} className="border border-black bg-white p-6"><small className="font-bold tracking-widest text-orange-600">PROMPTPAY TOP UP</small><h3 className="mt-2 text-xl font-black">เติมแต้มเข้าคลับ</h3><p className="mt-2 text-xs text-stone-600">1 แต้ม = 50 บาท</p><input type="number" min="1" max="3000" value={topUp} onChange={(event) => setTopUp(event.target.value)} className="mt-4 w-full border border-stone-300 p-3 text-sm"/><p className="mt-3 flex justify-between text-xs"><span>ยอดชำระ</span><b>{money(Number(topUp) * 50)}</b></p><button disabled={busy || payment?.status === "pending"} className="mt-4 w-full border border-black p-3 text-xs font-bold hover:bg-orange-500 disabled:opacity-50">สร้าง QR PromptPay</button>
          {payment && <div className="mt-4 border border-stone-300 p-4 text-center"><p className="text-xs font-bold">{money(payment.amountBaht)} · {payment.points} แต้ม</p>{payment.status === "pending" && payment.qrImageUrl && <img src={payment.qrImageUrl} alt="PromptPay QR" className="mx-auto mt-3 w-48 bg-white"/>}<p className="mt-3 text-xs">{payment.status === "pending" ? "รอชำระเงินผ่าน QR" : payment.status === "successful" ? "ชำระสำเร็จ แต้มถูกเพิ่มแล้ว" : payment.status === "expired" ? "QR หมดอายุ กรุณาสร้างรายการใหม่" : "รายการชำระไม่สำเร็จ"}</p>{payment.status !== "pending" && <button type="button" onClick={() => setPayment(null)} className="mt-2 text-xs underline">ปิด</button>}</div>}</form>
        <div className="border border-stone-300 bg-[#eae5da] p-5 sm:col-span-2"><h3 className="font-black">ประวัติแต้ม</h3>{member?.transactions?.slice(0, 5).map((item, index) => <div key={index} className="flex justify-between border-b border-stone-300 py-3 text-xs"><span>{item.description}</span><b>{item.points > 0 ? "+" : ""}{item.points} PTS</b></div>)}</div></div></div>}<p className="mt-4 text-[10px] text-stone-500">แต้มจะเข้าบัญชีเมื่อ Opn ยืนยันการชำระเงินผ่าน PromptPay</p></section>

    <section id="about" className="bg-black px-5 py-14 text-white"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 sm:flex-row"><h2 className="text-3xl font-black">Find your next favorite pair.</h2><p className="max-w-md text-sm leading-6 text-stone-400">คัดสรรสนีกเกอร์ที่ใส่ได้จริงในทุกวัน พร้อมส่งต่อสไตล์ในทุกก้าว</p></div></section>
    </main><footer className="flex flex-col justify-between gap-3 p-6 text-xs text-stone-500 sm:flex-row"><span>© 2026 Zneaker. All steps, your style.</span><span>Secure checkout · PromptPay · Cash on delivery</span></footer>

    {message && <div role="status" className="fixed bottom-5 left-1/2 z-[70] w-[min(90%,440px)] -translate-x-1/2 bg-orange-500 p-4 text-sm font-bold shadow-lg">{message}<button className="float-right" onClick={() => setMessage("")}>×</button></div>}
    {error && !authOpen && <div role="alert" className="fixed bottom-5 left-1/2 z-[70] w-[min(90%,440px)] -translate-x-1/2 border border-red-300 bg-white p-4 text-sm font-bold text-red-700 shadow-lg">{error}<button className="float-right" onClick={() => setError("")}>×</button></div>}

    {authOpen && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthOpen(false); }}><div className="modal-card"><button className="modal-close" onClick={() => setAuthOpen(false)}>×</button><small className="font-black tracking-widest text-orange-600">ZNEAKER CLUB</small><h2 className="mt-3 text-3xl font-black">{authMode === "login" ? "ยินดีต้อนรับกลับ" : "สร้างบัญชีสมาชิก"}</h2><div className="mt-5 grid grid-cols-2 border-b">{["login", "register"].map((mode) => <button key={mode} onClick={() => { setAuthMode(mode); setError(""); }} className={`border-b-2 p-3 text-sm font-bold ${authMode === mode ? "border-orange-600" : "border-transparent"}`}>{mode === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}</button>)}</div><form onSubmit={submitAuth} className="mt-5 space-y-4">{authMode === "register" && <><label className="label">ชื่อ<input name="name" required className="field"/></label><label className="label">เบอร์โทร<input name="phone" required className="field"/></label></>}<label className="label">อีเมล<input type="email" name="email" required className="field"/></label><label className="label">รหัสผ่าน<input type="password" name="password" minLength="6" required className="field"/></label>{error && <p className="text-xs text-red-700">{error}</p>}<button disabled={busy} className="w-full bg-black p-4 text-sm font-bold text-white">{busy ? "กำลังดำเนินการ..." : authMode === "login" ? "เข้าสู่ระบบ →" : "สมัครสมาชิก →"}</button></form></div></div>}

    {cartOpen && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false); }}><div className="modal-card max-w-2xl"><button className="modal-close" onClick={() => setCartOpen(false)}>×</button><small className="font-black tracking-widest text-orange-600">YOUR ROTATION</small><h2 className="mt-2 text-3xl font-black">ตะกร้าสินค้า ({cartQuantity})</h2>{cart.length ? <><div className="mt-5 max-h-[38vh] space-y-3 overflow-auto">{cart.map((item, index) => <div key={`${item.product}-${item.size}-${item.color}`} className="flex gap-3 border-b border-stone-200 pb-3"><img src={item.image} alt="" className="h-20 w-24 object-cover"/><div className="min-w-0 flex-1"><b className="block truncate text-sm">{item.productName}</b><small className="text-stone-500">ไซซ์ {item.size} · {item.color}</small><div className="mt-2 flex items-center justify-between"><div className="flex items-center gap-2"><button onClick={() => updateCart(index, item.quantity - 1)} className="border px-2">−</button><span className="text-xs">{item.quantity}</span><button onClick={() => updateCart(index, item.quantity + 1)} className="border px-2">+</button></div><b className="text-sm">{money(item.price * item.quantity)}</b></div></div><button onClick={() => setCart((current) => current.filter((_, i) => i !== index))} className="text-xs text-stone-400">ลบ</button></div>)}</div>
      <form onSubmit={checkout} className="mt-5"><label className="label">ที่อยู่จัดส่ง<textarea name="shippingAddress" required minLength="10" defaultValue={formatAddress(profile?.addresses?.find((address) => address.isDefault)) || profile?.address || ""} placeholder="ชื่อผู้รับ เบอร์โทร บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์" className="field min-h-24"/></label><div className="mt-4 space-y-2 text-sm"><p className="flex justify-between"><span>ยอดสินค้า</span><span>{money(cartSubtotal)}</span></p><p className="flex justify-between"><span>ค่าจัดส่ง {cartSubtotal >= 2000 && "(ฟรี)"}</span><span>{money(shipping)}</span></p><p className="flex justify-between border-t border-black pt-3 text-base font-black"><span>ยอดรวม</span><span>{money(cartSubtotal + shipping)}</span></p></div>
        <fieldset className="mt-4 grid gap-2 sm:grid-cols-2"><label className="flex cursor-pointer gap-2 border p-3 text-xs"><input type="radio" name="paymentMethod" value="promptpay" defaultChecked/>PromptPay QR (ชำระออนไลน์)</label><label className="flex cursor-pointer gap-2 border p-3 text-xs"><input type="radio" name="paymentMethod" value="cod"/>เก็บเงินปลายทาง</label></fieldset><button disabled={busy} className="mt-4 w-full bg-orange-500 p-4 text-sm font-black disabled:opacity-50">{busy ? "กำลังสร้างคำสั่งซื้อ..." : "ยืนยันและสั่งซื้อ"}</button>{!token && <p className="mt-2 text-center text-xs text-stone-500">เข้าสู่ระบบก่อนยืนยันคำสั่งซื้อ</p>}</form></> : <div className="py-12 text-center text-sm text-stone-500">ตะกร้ายังว่างอยู่ ไปเลือกคู่โปรดกันเลย</div>}</div></div>}

    {order && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && order.status !== "pending_payment") setOrder(null); }}><div className="modal-card max-w-lg"><button className="modal-close" onClick={() => setOrder(null)}>×</button><small className="font-black tracking-widest text-orange-600">ORDER #{String(order._id).slice(-7).toUpperCase()}</small><h2 className="mt-2 text-3xl font-black">{order.status === "pending_payment" ? "สแกนเพื่อชำระเงิน" : order.paymentStatus === "paid" ? "ชำระเงินสำเร็จ" : order.status === "cancelled" ? "คำสั่งซื้อหมดอายุ" : "รับคำสั่งซื้อแล้ว"}</h2>{order.paymentMethod === "promptpay" && order.status === "pending_payment" && <div className="py-4 text-center"><p className="text-sm">ยอดชำระ {money(order.totalAmount)}</p>{order.qrImageUrl && <img src={order.qrImageUrl} alt="PromptPay QR" className="mx-auto mt-4 w-56 border bg-white p-2"/>}<p className="mt-3 text-xs text-stone-500">ระบบกำลังตรวจสอบการชำระเงินโดยอัตโนมัติ</p></div>}<div className="mt-4 space-y-2 border-t pt-4">{order.items?.map((item, index) => <div key={index} className="flex justify-between text-sm"><span>{item.productName} · {item.size} · {item.quantity} ชิ้น</span><b>{money(item.price * item.quantity)}</b></div>)}<div className="flex justify-between border-t pt-3 font-black"><span>รวมทั้งสิ้น</span><b>{money(order.totalAmount)}</b></div></div><p className="mt-4 text-xs text-stone-500">สถานะ: {order.status === "pending_payment" ? "รอชำระ" : order.status === "shipping" ? "กำลังจัดส่ง" : order.status === "delivered" ? "จัดส่งแล้ว" : order.status === "cancelled" ? "ยกเลิก" : "ยืนยันคำสั่งซื้อ"}</p><button onClick={() => setOrder(null)} className="mt-5 w-full border border-black p-3 text-sm font-bold">ปิด</button></div></div>}

    {profileOpen && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setProfileOpen(false); }}><div className="modal-card max-w-3xl"><button className="modal-close" onClick={() => setProfileOpen(false)}>×</button><small className="font-black tracking-widest text-orange-600">MY ACCOUNT</small><h2 className="mt-2 text-3xl font-black">บัญชีของฉัน</h2><form onSubmit={saveProfile} className="mt-5 grid gap-3 sm:grid-cols-2"><label className="label">ชื่อ<input name="name" defaultValue={profile?.name} required className="field"/></label><label className="label">เบอร์โทร<input name="phone" defaultValue={profile?.phone} required className="field"/></label><label className="label sm:col-span-2">อีเมล<input type="email" name="email" defaultValue={profile?.email} required className="field"/></label><button disabled={busy} className="bg-black p-3 text-sm font-bold text-white sm:col-span-2">บันทึกโปรไฟล์</button></form>
      <h3 className="mt-7 border-t pt-5 font-black">ที่อยู่จัดส่ง</h3><div className="mt-2 space-y-2">{profile?.addresses?.map((address) => <div key={address._id} className="flex items-start justify-between gap-3 border p-3 text-xs"><div><b>{address.label} · {address.recipient} ({address.phone})</b><p className="mt-1 text-stone-600">{[address.line1, address.line2, address.subdistrict, address.district, address.province, address.postalCode].filter(Boolean).join(" ")}</p>{address.isDefault && <small className="text-orange-600">ที่อยู่หลัก</small>}</div><div className="flex shrink-0 gap-2">{!address.isDefault && <button onClick={() => mutateAddress(address._id, "PUT", "/default")} className="underline">ตั้งเป็นหลัก</button>}<button onClick={() => mutateAddress(address._id, "DELETE")} className="text-red-600 underline">ลบ</button></div></div>)}</div>
      <details className="mt-3 border p-3"><summary className="cursor-pointer text-sm font-bold">+ เพิ่มที่อยู่ใหม่</summary><form onSubmit={addAddress} className="mt-3 grid gap-2 sm:grid-cols-2">{[["label", "ชื่อที่อยู่"], ["recipient", "ชื่อผู้รับ"], ["phone", "เบอร์โทร"], ["line1", "บ้านเลขที่ / ถนน"], ["line2", "ข้อมูลเพิ่มเติม"], ["subdistrict", "ตำบล / แขวง"], ["district", "อำเภอ / เขต"], ["province", "จังหวัด"], ["postalCode", "รหัสไปรษณีย์"]].map(([name, title]) => <label key={name} className="label">{title}<input name={name} required={["recipient", "phone", "line1", "province", "postalCode"].includes(name)} className="field"/></label>)}<label className="flex items-center gap-2 text-xs"><input type="checkbox" name="isDefault" value="true"/>ตั้งเป็นที่อยู่หลัก</label><button className="bg-orange-500 p-3 text-sm font-bold sm:col-span-2">บันทึกที่อยู่</button></form></details>
      {profile?.role === "admin" && <details className="mt-6 border border-orange-300 bg-orange-50 p-4"><summary className="cursor-pointer text-sm font-black">เครื่องมือแอดมิน · เพิ่มสินค้า</summary><form onSubmit={createCatalogProduct} className="mt-4 grid gap-2 sm:grid-cols-2"><label className="label">ชื่อสินค้า<input name="name" required className="field"/></label><label className="label">หมวดหมู่<input name="category" required className="field"/></label><label className="label">ราคา (บาท)<input name="price" type="number" min="0" required className="field"/></label><label className="label">สต็อก<input name="stock" type="number" min="0" required className="field"/></label><label className="label">เพศ / กลุ่ม<input name="gender" defaultValue="Unisex" className="field"/></label><label className="label">ไซซ์ คั่นด้วยจุลภาค<input name="sizes" defaultValue="38,39,40,41,42,43" className="field"/></label><label className="label">สี คั่นด้วยจุลภาค<input name="colors" defaultValue="ดำ,ขาว" className="field"/></label><label className="label">ลิงก์รูปสินค้า<input name="image" type="url" required className="field"/></label><label className="label sm:col-span-2">รายละเอียด<textarea name="description" className="field min-h-20"/></label><button disabled={busy} className="bg-black p-3 text-sm font-bold text-white sm:col-span-2">เพิ่มสินค้า</button></form></details>}
      <h3 className="mt-7 border-t pt-5 font-black">{profile?.role === "admin" ? "จัดการคำสั่งซื้อ" : "ประวัติคำสั่งซื้อ"}</h3><div className="mt-2 max-h-52 space-y-2 overflow-auto">{orders.length ? orders.map((item) => <div key={item._id} className="flex items-center justify-between gap-2 border p-3 text-xs"><button onClick={() => setOrder(item)} className="min-w-0 flex-1 text-left"><span className="block truncate">#{String(item._id).slice(-7).toUpperCase()} · {new Date(item.createdAt).toLocaleDateString("th-TH")} · {item.items?.length || 0} รายการ</span><b>{money(item.totalAmount)} · {item.status}</b></button>{profile?.role === "admin" && <select aria-label="สถานะคำสั่งซื้อ" value={item.status} onChange={(event) => setOrderStatus(item._id, event.target.value)} className="max-w-32 border p-2"><option value="pending_payment">รอชำระ</option><option value="confirmed">ยืนยันแล้ว</option><option value="shipping">กำลังจัดส่ง</option><option value="delivered">จัดส่งแล้ว</option><option value="cancelled">ยกเลิก</option></select>}</div>) : <p className="py-5 text-xs text-stone-500">ยังไม่มีคำสั่งซื้อ</p>}</div><button onClick={logout} className="mt-6 text-xs text-red-600 underline">ออกจากระบบ</button></div></div>}
  </div>;
}

createRoot(document.getElementById("root")).render(<App/>);
