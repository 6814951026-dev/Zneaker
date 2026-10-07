const path = require("path");
const envPath = path.resolve(__dirname, "../.env");
require("dotenv").config({ path: envPath });
const dns = require("node:dns");
const dnsServers = String(process.env.MONGODB_DNS_SERVERS || "").split(",").map((server) => server.trim()).filter(Boolean);
if (dnsServers.length) dns.setServers(dnsServers);
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const Product = require("./models/product.model");
const { productSeed } = require("./seed");

async function seedProducts() {
  if (!process.env.MONGO_URI) throw new Error(`MONGO_URI is missing. Add it to ${envPath}`);
  await connectDB();
  let inserted = 0;
  let imagesUpdated = 0;
  let unchanged = 0;

  for (const product of productSeed) {
    const existing = await Product.findOne({ name: product.name }).select("image");
    if (!existing) {
      await Product.create(product);
      inserted += 1;
    } else if (!existing.image) {
      await Product.updateOne({ _id: existing._id }, { $set: { image: product.image, images: product.images } });
      imagesUpdated += 1;
    } else {
      unchanged += 1;
    }
  }

  console.log(`Product catalog ready: ${inserted} inserted, ${imagesUpdated} image records updated, ${unchanged} already present.`);
}

seedProducts()
  .catch((error) => {
    console.error("Product catalog seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.connection.close();
  });
