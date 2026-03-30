import { User } from "../models/userModel.js";
import mongoose from "mongoose";

function toPublicUser(u) {
  if (!u) return null;
  return {
    id: String(u._id),
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt,
  };
}

function validateUserIdParam(req, res) {
  const { userId } = req.params;
  if (!mongoose.isValidObjectId(userId)) {
    res.status(400).json({ message: "Invalid userId" });
    return null;
  }
  return userId;
}

export async function listUsers(req, res) {
  const users = await User.find({}).sort({ createdAt: -1 }).lean();
  return res.json({ users: users.map(toPublicUser) });
}

export async function listPendingUsers(req, res) {
  const users = await User.find({ status: "PENDING" }).sort({ createdAt: -1 }).lean();
  return res.json({ users: users.map(toPublicUser) });
}

export async function approveUser(req, res) {
  const userId = validateUserIdParam(req, res);
  if (!userId) return;

  await User.updateOne({ _id: userId }, { $set: { status: "APPROVED" } });
  const user = await User.findById(userId).lean();
  if (!user) return res.status(404).json({ message: "User not found" });
  return res.json({ user: toPublicUser(user) });
}

export async function rejectUser(req, res) {
  const userId = validateUserIdParam(req, res);
  if (!userId) return;
  if (String(req.user?.id) === String(userId)) {
    return res.status(400).json({ message: "You cannot reject yourself" });
  }

  await User.updateOne({ _id: userId }, { $set: { status: "REJECTED" } });
  const user = await User.findById(userId).lean();
  if (!user) return res.status(404).json({ message: "User not found" });
  return res.json({ user: toPublicUser(user) });
}

export async function makeAdmin(req, res) {
  const userId = validateUserIdParam(req, res);
  if (!userId) return;

  await User.updateOne({ _id: userId }, { $set: { role: "ADMIN", status: "APPROVED" } });
  const user = await User.findById(userId).lean();
  if (!user) return res.status(404).json({ message: "User not found" });
  return res.json({ user: toPublicUser(user) });
}

export async function removeUser(req, res) {
  const userId = validateUserIdParam(req, res);
  if (!userId) return;
  if (String(req.user?.id) === String(userId)) {
    return res.status(400).json({ message: "You cannot remove yourself" });
  }

  await User.deleteOne({ _id: userId });
  return res.json({ removed: true });
}
