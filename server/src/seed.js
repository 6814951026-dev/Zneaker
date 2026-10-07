require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const User = require("./models/user.model");
const Product = require("./models/product.model");
const Review = require("./models/review.model");
const Order = require("./models/order.model");

const imageUrls = [
  "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=800&q=80"
];

const users = [
  {
    name: "สมชาย ใจดี",
    email: "customer@zneaker.com",
    phone: "0812345678",
    password: "123456",
    role: "customer",
    address: "123/45 ถนนเจริญนคร กรุงเทพฯ"
  },
  {
    name: "Zneaker Admin",
    email: "admin@zneaker.com",
    phone: "0800000000",
    password: "admin123",
    role: "admin",
    address: "99/1 ถนนสุขุมวิท กรุงเทพฯ"
  }
];

const productSeed = [
  {
    name: "Zneaker Air Nova",
    description: "สนีกเกอร์ดีไซน์โมเดิร์นที่ผสานความโดดเด่นและความสบาย เหมาะสำหรับการใช้งานในชีวิตประจำวัน",
    price: 3290,
    originalPrice: 3590,
    category: "Sneaker",
    gender: "Unisex",
    sizes: [38, 39, 40, 41, 42, 43, 44],
    colors: ["ดำ", "น้ำเงิน", "ขาว"],
    image: imageUrls[0],
    images: [imageUrls[0]],
    rating: 4.8,
    reviewCount: 124,
    stock: 25,
    isNew: true,
    isBestSeller: true,
    isSale: true
  },
  {
    name: "Zneaker Street X",
    description: "รองเท้ารุ่นไลฟ์สไตล์ที่ให้ความสบายและลุคลูกรูปทรงทันสมัยสำหรับทุกวัน",
    price: 2890,
    originalPrice: 3190,
    category: "Lifestyle",
    gender: "Women",
    sizes: [35, 36, 37, 38, 39, 40],
    colors: ["ขาว", "ชมพู", "เทา"],
    image: imageUrls[1],
    images: [imageUrls[1]],
    rating: 4.7,
    reviewCount: 98,
    stock: 30,
    isNew: false,
    isBestSeller: true,
    isSale: true
  },
  {
    name: "Zneaker Runner Pro",
    description: "รองเท้าสำหรับวิ่งที่ผสานเทคโนโลยีกันชนและความนุ่มสบายแบบยาวนาน",
    price: 3590,
    originalPrice: 3990,
    category: "Performance",
    gender: "Unisex",
    sizes: [39, 40, 41, 42, 43, 44],
    colors: ["ดำ", "เขียว", "ขาว"],
    image: imageUrls[2],
    images: [imageUrls[2]],
    rating: 4.9,
    reviewCount: 156,
    stock: 18,
    isNew: true,
    isBestSeller: true,
    isSale: true
  },
  {
    name: "Zneaker Urban One",
    description: "ดีไซน์เมืองสไตล์เรียบหรู เหมาะทั้งการเดินในเมืองและกิจกรรมประจำวัน",
    price: 2490,
    originalPrice: 2790,
    category: "Lifestyle",
    gender: "Men",
    sizes: [38, 39, 40, 41, 42, 43],
    colors: ["ดำ", "เทา", "น้ำเงิน"],
    image: imageUrls[3],
    images: [imageUrls[3]],
    rating: 4.6,
    reviewCount: 72,
    stock: 40,
    isNew: false,
    isBestSeller: false,
    isSale: true
  },
  {
    name: "Zneaker Velocity",
    description: "รองเท้าประสิทธิภาพสูงพร้อมซัพพอร์ตที่ดีเยี่ยมสำหรับการเคลื่อนไหวทุกวัน",
    price: 3990,
    originalPrice: 4390,
    category: "Performance",
    gender: "Unisex",
    sizes: [37, 38, 39, 40, 41, 42, 43],
    colors: ["แดง", "ดำ", "ขาว"],
    image: imageUrls[4],
    images: [imageUrls[4]],
    rating: 4.8,
    reviewCount: 88,
    stock: 22,
    isNew: true,
    isBestSeller: false,
    isSale: true
  },
  {
    name: "Zneaker Classic 01",
    description: "สไตล์คลาสสิกที่ยังคงความทันสมัยและความสบายอย่างเหนือระดับ",
    price: 2190,
    originalPrice: 2490,
    category: "Classic",
    gender: "Women",
    sizes: [35, 36, 37, 38, 39, 40],
    colors: ["ครีม", "ดำ", "น้ำตาล"],
    image: imageUrls[5],
    images: [imageUrls[5]],
    rating: 4.5,
    reviewCount: 63,
    stock: 28,
    isNew: false,
    isBestSeller: false,
    isSale: false
  }
];

async function seedDatabase() {
  await connectDB();

  await User.deleteMany({});
  await Product.deleteMany({});
  await Review.deleteMany({});
  await Order.deleteMany({});

  const createdUsers = await User.insertMany(users);
  const createdProducts = await Product.insertMany(productSeed);

  const reviews = [
    {
      user: createdUsers[0]._id,
      product: createdProducts[0]._id,
      rating: 5,
      comment: "รองเท้าสวยมาก ใส่สบายและจัดส่งเร็ว"
    },
    {
      user: createdUsers[0]._id,
      product: createdProducts[2]._id,
      rating: 4,
      comment: "ดีไซน์โหดมาก ใช้งานสบายสำหรับการวิ่ง"
    }
  ];

  const createdReviews = await Review.insertMany(reviews);

  const orders = [
    {
      user: createdUsers[0]._id,
      items: [
        {
          product: createdProducts[0]._id,
          quantity: 1,
          size: 41,
          color: "ดำ",
          price: createdProducts[0].price
        },
        {
          product: createdProducts[3]._id,
          quantity: 1,
          size: 40,
          color: "เทา",
          price: createdProducts[3].price
        }
      ],
      totalAmount: 5780,
      shippingAddress: "123/45 ถนนเจริญนคร กรุงเทพฯ 10110",
      paymentMethod: "Credit Card",
      status: "confirmed"
    },
    {
      user: createdUsers[0]._id,
      items: [
        {
          product: createdProducts[2]._id,
          quantity: 1,
          size: 42,
          color: "ขาว",
          price: createdProducts[2].price
        }
      ],
      totalAmount: 3590,
      shippingAddress: "88/9 เขตคลองเตย กรุงเทพฯ 10110",
      paymentMethod: "Bank Transfer",
      status: "pending"
    }
  ];

  const createdOrders = await Order.insertMany(orders);

  console.log("MongoDB connected");
  console.log("Zneaker database seeded successfully");
  console.log(`Users: ${createdUsers.length}`);
  console.log(`Products: ${createdProducts.length}`);
  console.log(`Reviews: ${createdReviews.length}`);
  console.log(`Orders: ${createdOrders.length}`);

  await mongoose.connection.close();
  process.exit(0);
}

seedDatabase().catch((error) => {
  console.error("Seeding failed:", error);
  process.exit(1);
});
