import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import rateLimit from "express-rate-limit";
import { validate } from "../middleware/validate.js";
import { AppError } from "../middleware/errorHandler.js";
import { getCollections } from "../utils/getCollections.js";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "Too many requests, please try again later" },
});

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["creator", "supporter"]),
  photoURL: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

const googleSchema = z.object({
  token: z.string().min(1, "Google token is required"),
});

router.post("/register", authLimiter, validate(registerSchema), async (req, res) => {
  const { name, email, password, role, photoURL } = req.body;

  const { users } = getCollections();
  const existing = await users.findOne({ email });
  if (existing) {
    throw new AppError(409, "Email already registered");
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = {
    name,
    email,
    password: hashedPassword,
    role,
    photoURL: photoURL ?? "",
    credits: role === "creator" ? 20 : 50,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await users.insertOne(user);
  const token = jwt.sign({ email: user.email, role: user.role }, process.env.JWT_SECRET!, { expiresIn: "7d" });

  res.status(201).json({
    token,
    user: { name: user.name, email: user.email, role: user.role, photoURL: user.photoURL, credits: user.credits },
  });
});

router.post("/login", authLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;

  const { users } = getCollections();
  const user = await users.findOne({ email });
  if (!user || !user.password) {
    throw new AppError(401, "Invalid email or password");
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    throw new AppError(401, "Invalid email or password");
  }

  const token = jwt.sign({ email: user.email, role: user.role }, process.env.JWT_SECRET!, { expiresIn: "7d" });

  res.json({
    token,
    user: { name: user.name, email: user.email, role: user.role, photoURL: user.photoURL, credits: user.credits },
  });
});

router.post("/google", authLimiter, validate(googleSchema), async (req, res) => {
  const { token } = req.body;

  const ticket = await googleClient.verifyIdToken({
    idToken: token,
    audience: process.env.FIREBASE_PROJECT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload?.email) {
    throw new AppError(400, "Invalid Google token");
  }

  const { users } = getCollections();

  const existingUser = await users.findOne({ email: payload.email });

  if (existingUser) {
    const jwtToken = jwt.sign({ email: existingUser.email, role: existingUser.role }, process.env.JWT_SECRET!, { expiresIn: "7d" });
    res.json({
      token: jwtToken,
      user: { name: existingUser.name, email: existingUser.email, role: existingUser.role, photoURL: existingUser.photoURL, credits: existingUser.credits },
    });
    return;
  }

  const newUser = {
    name: payload.name ?? "User",
    email: payload.email,
    photoURL: payload.picture ?? "",
    role: "supporter" as const,
    credits: 50,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await users.insertOne(newUser);

  const jwtToken = jwt.sign({ email: newUser.email, role: newUser.role }, process.env.JWT_SECRET!, { expiresIn: "7d" });

  res.status(201).json({
    token: jwtToken,
    user: { name: newUser.name, email: newUser.email, role: newUser.role, photoURL: newUser.photoURL, credits: newUser.credits },
  });
});

router.post("/jwt", validate(z.object({ email: z.string().email() })), async (req, res) => {
  const { email } = req.body;

  const { users } = getCollections();
  const user = await users.findOne({ email });
  if (!user) {
    throw new AppError(404, "User not found");
  }

  const token = jwt.sign({ email: user.email, role: user.role }, process.env.JWT_SECRET!, { expiresIn: "7d" });
  res.json({ token });
});

export default router;
