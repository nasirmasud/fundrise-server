import { Router } from "express";
import { verifyToken } from "../middleware/auth.js";
import { getCollections } from "../utils/getCollections.js";
import { AppError } from "../middleware/errorHandler.js";

const router = Router();

router.get("/me", verifyToken, async (req, res) => {
  const { users } = getCollections();
  const user = await users.findOne({ email: req.user!.email });
  if (!user) throw new AppError(404, "User not found");

  res.json({
    name: user.name,
    email: user.email,
    role: user.role,
    photoURL: user.photoURL,
    credits: user.credits,
  });
});

export default router;
