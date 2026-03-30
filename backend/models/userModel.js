import mongoose from "mongoose";

const { Schema } = mongoose;

const roleEnum = ["ADMIN", "USER"];
const statusEnum = ["PENDING", "APPROVED", "REJECTED"];

const userSchema = new Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, required: true, unique: true, index: true, trim: true, lowercase: true },
    googleId: { type: String, required: true, index: true, trim: true },
    role: { type: String, required: true, enum: roleEnum, default: "USER", index: true },
    status: { type: String, required: true, enum: statusEnum, default: "PENDING", index: true },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
);

export const User = mongoose.model("User", userSchema);
