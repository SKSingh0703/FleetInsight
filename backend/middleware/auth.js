import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";
import { User } from "../models/userModel.js";

function getBearerToken(req) {
  const header = req.headers?.authorization;
  if (typeof header !== "string") return "";
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return "";
  return token.trim();
}

export async function verifyToken(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ message: "Missing Authorization token" });
    }

    if (!JWT_SECRET) {
      return res.status(500).json({ message: "Server auth not configured (missing JWT_SECRET)" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded?.userId;

    if (!userId) {
      return res.status(401).json({ message: "Invalid token" });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = {
      id: String(user._id),
      role: user.role,
      status: user.status,
      email: user.email,
      name: user.name,
    };

    return next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireApproved(req, res, next) {
  const status = req.user?.status;
  if (status !== "APPROVED") {
    return res.status(403).json({
      message: status === "PENDING" ? "Access pending approval" : "Access denied",
      status: status || "UNKNOWN",
    });
  }
  return next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ message: "Admin access required" });
  }
  return next();
}
