import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { GOOGLE_CLIENT_ID, JWT_SECRET, ADMIN_EMAIL } from "../config/env.js";
import { User } from "../models/userModel.js";

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export async function googleAuth(req, res) {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const credential = body.credential || body.idToken;

  if (!credential || typeof credential !== "string") {
    return res.status(400).json({ message: "Missing Google credential" });
  }

  if (!GOOGLE_CLIENT_ID) {
    return res.status(500).json({ message: "Server auth not configured (missing GOOGLE_CLIENT_ID)" });
  }

  if (!JWT_SECRET) {
    return res.status(500).json({ message: "Server auth not configured (missing JWT_SECRET)" });
  }

  const client = new OAuth2Client(GOOGLE_CLIENT_ID);
  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  const googleId = payload?.sub;
  const email = normalizeEmail(payload?.email);
  const name = typeof payload?.name === "string" ? payload.name.trim() : "";

  if (!googleId || !email) {
    return res.status(400).json({ message: "Invalid Google credential" });
  }

  let user = await User.findOne({ email });

  if (!user) {
    const existingCount = await User.countDocuments({});
    const isDefaultAdmin = (ADMIN_EMAIL && email === normalizeEmail(ADMIN_EMAIL)) || existingCount === 0;

    user = await User.create({
      name,
      email,
      googleId,
      role: isDefaultAdmin ? "ADMIN" : "USER",
      status: isDefaultAdmin ? "APPROVED" : "PENDING",
    });
  } else {
    const updates = {};
    if (!user.googleId && googleId) updates.googleId = googleId;
    if (name && user.name !== name) updates.name = name;
    if (Object.keys(updates).length > 0) {
      await User.updateOne({ _id: user._id }, { $set: updates });
      user = await User.findById(user._id);
    }
  }

  const token = jwt.sign(
    { userId: String(user._id), role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" },
  );

  return res.json({
    token,
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    },
  });
}

export async function me(req, res) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = await User.findById(userId).lean();
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  return res.json({
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    },
  });
}
