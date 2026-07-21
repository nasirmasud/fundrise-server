import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { verifyToken, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { getCollections } from "../utils/getCollections.js";
import { AppError } from "../middleware/errorHandler.js";

const router = Router();

// Get current user profile
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

// Admin: list all users
router.get("/", verifyToken, requireRole("admin"), async (_req, res) => {
  const { users } = getCollections();
  const allUsers = await users
    .find({}, { projection: { password: 0 } })
    .sort({ createdAt: -1 })
    .toArray();
  res.json(allUsers);
});

// Admin: update user role
const updateRoleSchema = z.object({
  role: z.enum(["creator", "supporter", "admin"]),
});

router.patch(
  "/:id/role",
  verifyToken,
  requireRole("admin"),
  validate(updateRoleSchema),
  async (req, res) => {
    const { users } = getCollections();
    const oid = new ObjectId(req.params.id);
    const user = await users.findOne({ _id: oid });
    if (!user) throw new AppError(404, "User not found");

    await users.updateOne(
      { _id: oid },
      { $set: { role: req.body.role, updatedAt: new Date() } }
    );

    res.json({ message: "Role updated", role: req.body.role });
  }
);

// Admin: delete user
router.delete("/:id", verifyToken, requireRole("admin"), async (req, res) => {
  const { users } = getCollections();
  const oid = new ObjectId(req.params.id);
  const user = await users.findOne({ _id: oid });
  if (!user) throw new AppError(404, "User not found");

  await users.deleteOne({ _id: oid });
  res.json({ message: "User deleted" });
});

export default router;
