import mongoose from "mongoose";
import { MONGO_URI } from "./env.js";

export async function connectDB() {
  // Mongoose defaults are fine for MVP; keep this as a single place to tweak later.
  mongoose.set("strictQuery", true);
  await mongoose.connect(MONGO_URI);
  return mongoose.connection;
}

