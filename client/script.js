const API_URL=window.ZNEAKER_API_URL||"http://localhost:5000/api";
let authMode="login", member=JSON.parse(localStorage.getItem("zneaker-member")||"null");
const memberKey=()=>`zneaker-club-${member?.email||"guest"}`;
function memberData(){return JSON.parse(localStorage.getItem(memberKey())||'{"points":0,"checkinDate":"","draws":[]}')}
function saveMemberData(data){localStorage.setItem(memberKey(),JSON.stringify(data));renderMember()}
function renderMember(){if(!member)return;const data=memberData(),today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());$("#memberAuth").hidden=true;$("#memberDashboard").hidden=false;$("#memberName").textContent=member.name||member.email.split("@")[0];$("#pointsBalance").textContent=(data.points||0).toLocaleString("th-TH");const checked=data.checkinDate===today;$("#checkinButton").disabled=checked;$("#checkinButton").innerHTML=checked?"เช็คอินแล้ว ✓":"เช็คอินวันนี้ <span>→</span>";$("#checkinStatus").textContent=checked?"วันนี้คุณรับ 10 แต้มแล้ว กลับมาเช็คอินใหม่พรุ่งนี้":"เช็คอินวันนี้เพื่อรับ 10 แต้ม"}
function openMember(){const modal=$("#memberModal");modal.classList.add("open");modal.setAttribute("aria-hidden","false");if(member)renderMember();else{$("#memberAuth").hidden=false;$("#memberDashboard").hidden=true}}
function setAuthMode(mode){authMode=mode;$$('.auth-tab').forEach(button=>button.classList.toggle("active",button.dataset.authTab===mode));$$('.register-only').forEach(label=>{label.hidden=mode!=="register";label.querySelector("input").required=mode==="register"});$("#memberForm button[type=submit]").innerHTML=mode==="register"?'สร้างบัญชี <span>→</span>':'เข้าสู่ระบบ <span>→</span>';$("#authMessage").textContent=""}
let products=[];
let activeFilter="ทั้งหมด", cart=JSON.parse(localStorage.getItem("zneaker-cart")||"[]"), wishlist=JSON.parse(localStorage.getItem("zneaker-wishlist")||"[]");
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const money=n=>`฿${n.toLocaleString("th-TH")}`;
function mapProduct(product){
  return {...product,id:String(product._id),category:product.gender==="Men"?"ผู้ชาย":product.gender==="Women"?"ผู้หญิง":product.category==="Performance"?"วิ่ง":"ทั้งหมด",type:product.category,color:(product.colors||[]).join(" / "),new:product.isNew};
}
async function loadProducts(){
  try{
    const response=await fetch(`${API_URL}/products`);
    if(!response.ok)throw new Error("Product request failed");
    products=(await response.json()).map(mapProduct);
    renderProducts();
  }catch(error){
    console.error(error);
    $("#productGrid").innerHTML='<p class="empty-state">ไม่สามารถโหลดข้อมูลสินค้าได้</p>';
  }
}
function renderProducts(){
  let list=products.filter(p=>activeFilter==="ทั้งหมด"||p.category===activeFilter);
  const term=$("#searchInput").value.trim().toLowerCase(); if(term) list=list.filter(p=>(p.name+p.category+p.type).toLowerCase().includes(term));
  const sort=$("#sortSelect").value; if(sort==="low")list.sort((a,b)=>a.price-b.price); if(sort==="high")list.sort((a,b)=>b.price-a.price); if(sort==="rating")list.sort((a,b)=>b.rating-a.rating); if(sort==="newest")list.sort((a,b)=>(b.new?1:0)-(a.new?1:0));
  $("#productGrid").innerHTML=list.map(p=>`<article class="product-card"><div class="product-image"><img src="${p.image}" alt="${p.name}"><button class="wishlist ${wishlist.includes(p.id)?"active":""}" data-wish="${p.id}" aria-label="เพิ่ม ${p.name} ในรายการโปรด">${wishlist.includes(p.id)?"♥":"♡"}</button>${p.new?'<span class="product-badge">NEW</span>':""}</div><div class="product-info"><span class="category">${p.type}</span><h3>${p.name}</h3><div class="rating">★★★★★ <span>${p.rating}</span></div><div class="price-row"><strong class="price">${money(p.price)}</strong><button class="add-button" data-add="${p.id}" aria-label="เพิ่ม ${p.name} ลงตะกร้า">+</button></div></div></article>`).join("");
  $("#emptyState").hidden=list.length>0;
}
function save(){localStorage.setItem("zneaker-cart",JSON.stringify(cart));localStorage.setItem("zneaker-wishlist",JSON.stringify(wishlist));}
function updateCounts(){$("#cartCount").textContent=cart.reduce((n,i)=>n+i.qty,0);$("#wishlistCount").textContent=wishlist.length;$("#drawerCount").textContent=cart.reduce((n,i)=>n+i.qty,0)}
function renderCart(){const items=$("#cartItems");$("#cartEmpty").style.display=cart.length?"none":"block";$("#cartSummary").style.display=cart.length?"block":"none";items.innerHTML=cart.map(i=>`<div class="cart-row"><img src="${i.image}" alt="${i.name}"><div><h4>${i.name}</h4><small>${i.color}</small><strong>${money(i.price)}</strong><div class="qty-control"><button data-minus="${i.id}">−</button><span>${i.qty}</span><button data-plus="${i.id}">+</button></div></div><button class="remove-item" data-remove="${i.id}" aria-label="ลบสินค้า">×</button></div>`).join("");$("#cartTotal").textContent=money(cart.reduce((n,i)=>n+i.price*i.qty,0));updateCounts()}
function toast(message){const el=$(".toast");el.textContent=message;el.classList.add("show");clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>el.classList.remove("show"),2500)}
function openCart(){renderCart();$(".cart-drawer").classList.add("open");$(".overlay").classList.add("show");$(".cart-drawer").setAttribute("aria-hidden","false")}
function closeCart(){$(".cart-drawer").classList.remove("open");$(".overlay").classList.remove("show");$(".cart-drawer").setAttribute("aria-hidden","true")}
function addToCart(id){const p=products.find(x=>x.id===id), existing=cart.find(x=>x.id===id); if(!p)return; if(existing)existing.qty++;else cart.push({...p,qty:1});save();renderCart();toast("เพิ่มสินค้าในตะกร้าเรียบร้อยแล้ว")}
async function openProductDetail(id){
  const modal=$("#quickView"), content=$("#quickViewContent");
  content.innerHTML='<p class="empty-state">กำลังโหลดรายละเอียดสินค้า...</p>';
  modal.classList.add("open");
  modal.setAttribute("aria-hidden","false");
  try{
    const response=await fetch(`${API_URL}/products/${encodeURIComponent(id)}`);
    if(!response.ok)throw new Error("Product detail request failed");
    const product=mapProduct(await response.json());
    content.innerHTML=`<div class="quick-view"><img src="${product.image}" alt="${product.name}"><div><span class="category">${product.type}</span><h2>${product.name}</h2><div class="rating">★★★★★ ${product.rating}</div><p>${product.description||"สนีกเกอร์ดีไซน์โมเดิร์นที่ผสานความโดดเด่นและความสบาย เหมาะสำหรับการใช้งานในชีวิตประจำวัน"}</p><strong class="price">${money(product.price)}</strong><br><button class="button primary" data-add="${product.id}" style="margin-top:22px">เพิ่มลงตะกร้า <span>→</span></button></div></div>`;
  }catch(error){
    console.error(error);
    content.innerHTML='<p class="empty-state">ไม่สามารถโหลดรายละเอียดสินค้าได้</p>';
  }
}
document.addEventListener("click",e=>{
  const add=e.target.closest("[data-add]"); if(add){addToCart(add.dataset.add);return}
  const wish=e.target.closest("[data-wish]"); if(wish){const id=wish.dataset.wish;wishlist=wishlist.includes(id)?wishlist.filter(x=>x!==id):[...wishlist,id];save();renderProducts();updateCounts();toast(wishlist.includes(id)?"เพิ่มในรายการโปรดแล้ว":"นำออกจากรายการโปรดแล้ว");return}
  const plus=e.target.closest("[data-plus]");if(plus){const i=cart.find(x=>x.id===plus.dataset.plus);if(i)i.qty++;save();renderCart();return}
  const minus=e.target.closest("[data-minus]");if(minus){const i=cart.find(x=>x.id===minus.dataset.minus);if(i){i.qty--;if(i.qty<1)cart=cart.filter(x=>x.id!==i.id)}save();renderCart();return}
  const remove=e.target.closest("[data-remove]");if(remove){cart=cart.filter(x=>x.id!==remove.dataset.remove);save();renderCart();return}
  if(e.target.closest("#cartButton"))openCart(); if(e.target.closest(".close-drawer")||e.target.closest(".close-drawer-link")||e.target.classList.contains("overlay"))closeCart();
  if(e.target.closest(".checkout-button")){closeCart();toast("ฟังก์ชันชำระเงินพร้อมใช้งานในขั้นตอนถัดไป")}
  if(e.target.closest(".search-toggle")){$(".search-panel").classList.add("open");$(".search-panel").setAttribute("aria-hidden","false");$("#searchInput").focus()}
  if(e.target.closest(".close-search")){$(".search-panel").classList.remove("open");$("#searchInput").value="";renderProducts()}
  const pill=e.target.closest(".filter-pill");if(pill){$$(".filter-pill").forEach(x=>x.classList.remove("active"));pill.classList.add("active");activeFilter=pill.dataset.filter;renderProducts()}
  const card=e.target.closest(".product-card");if(card&&!e.target.closest("button"))openProductDetail(card.querySelector("[data-add]").dataset.add);
  if(e.target.closest(".modal-close")||e.target.id==="quickView"){$("#quickView").classList.remove("open");$("#quickView").setAttribute("aria-hidden","true")}
  if(e.target.closest(".menu-toggle")){const nav=$(".main-nav"),open=nav.classList.toggle("open");e.target.setAttribute("aria-expanded",open)}
  if(e.target.closest(".account-button"))openMember();
  if(e.target.closest(".member-close")||e.target===$("#memberModal")){$("#memberModal").classList.remove("open");$("#memberModal").setAttribute("aria-hidden","true")}
  const authTab=e.target.closest("[data-auth-tab]");if(authTab)setAuthMode(authTab.dataset.authTab);
  if(e.target.closest("#checkinButton")){const data=memberData(),today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());if(data.checkinDate!==today){data.points=(data.points||0)+10;data.checkinDate=today;saveMemberData(data);toast("เช็คอินสำเร็จ รับ 10 แต้มแล้ว")}return}
  if(e.target.closest("#drawButton")){const data=memberData(),result=$("#drawResult");result.textContent="";if(data.points<1000){result.textContent="แต้มไม่พอ เติมแต้มเพื่อร่วมลุ้นได้เลย";return}if(!products.length){result.textContent="ยังโหลดรายการรองเท้าไม่สำเร็จ ลองใหม่อีกครั้ง";return}data.points-=1000;const prize=products[Math.floor(Math.random()*products.length)];data.draws=data.draws||[];data.draws.unshift({name:prize.name,date:new Date().toISOString()});saveMemberData(data);result.innerHTML=`คุณได้สิทธิ์ลุ้น <strong>${prize.name}</strong>!`;toast("ใช้ 1,000 แต้มสำหรับการสุ่มแล้ว");return}
  if(e.target.closest("#logoutButton")){member=null;localStorage.removeItem("zneaker-member");$("#memberDashboard").hidden=true;$("#memberAuth").hidden=false;setAuthMode("login");return}
});
$("#searchInput").addEventListener("input",renderProducts);$("#sortSelect").addEventListener("change",renderProducts);
$("#newsletterForm").addEventListener("submit",e=>{e.preventDefault();e.target.reset();toast("ขอบคุณที่ติดตามข่าวสารจาก Zneaker")});
$("#memberForm").addEventListener("submit",async e=>{e.preventDefault();const form=e.currentTarget,values=Object.fromEntries(new FormData(form)),message=$("#authMessage"),submit=form.querySelector("button[type=submit]");message.textContent="กำลังดำเนินการ...";submit.disabled=true;try{const response=await fetch(`${API_URL}/users${authMode==="login"?"/login":""}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(values)}),payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.message||"ไม่สามารถเข้าสู่ระบบได้");member=payload.user||payload;localStorage.setItem("zneaker-member",JSON.stringify(member));if(!localStorage.getItem(memberKey()))localStorage.setItem(memberKey(),JSON.stringify({points:0,checkinDate:"",draws:[]}));renderMember()}catch(error){message.textContent=error.message==="Failed to fetch"?"เชื่อมต่อระบบสมาชิกไม่ได้ กรุณาตรวจสอบเซิร์ฟเวอร์":error.message}finally{submit.disabled=false}});
$("#topupPoints").addEventListener("input",e=>{$("#topupAmount").textContent=`฿${((Number(e.target.value)||0)*50).toLocaleString("th-TH")}`});
$("#topupForm").addEventListener("submit",e=>{e.preventDefault();const amount=Math.floor(Number($("#topupPoints").value));if(!Number.isFinite(amount)||amount<1)return;const data=memberData();data.points=(data.points||0)+amount;saveMemberData(data);toast(`เติม ${amount.toLocaleString("th-TH")} แต้มแล้ว · ต้นแบบไม่มีการชำระเงินจริง`)});
renderCart();loadProducts();
