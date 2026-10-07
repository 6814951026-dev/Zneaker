const mongoose = require("mongoose");

async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is not configured");
  }

  await mongoose.connect(mongoUri);
  console.log("MongoDB connected");
  return mongoose.connection;
}

module.exports = connectDB;
