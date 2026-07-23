import { Router } from "express";
import { ObjectId } from "mongodb";
import { verifyToken } from "../middleware/auth.js";
import { getCollections } from "../utils/getCollections.js";
import { AppError } from "../middleware/errorHandler.js";

const router = Router();

router.use(verifyToken);

router.get("/:email", async (req, res) => {
  const { notifications } = getCollections();

  if (req.user!.email !== req.params.email) {
    throw new AppError(403, "Not authorized");
  }

  const items = await notifications
    .find({ toEmail: req.params.email })
    .sort({ time: -1 })
    .toArray();

  res.json(items);
});

router.patch("/:id/read", async (req, res) => {
  const { notifications } = getCollections();

  const notification = await notifications.findOne({ _id: new ObjectId(req.params.id) });
  if (!notification) throw new AppError(404, "Notification not found");

  if (notification.toEmail !== req.user!.email) {
    throw new AppError(403, "Not authorized");
  }

  await notifications.updateOne({ _id: notification._id }, { $set: { read: true } });

  res.json({ message: "Notification marked as read" });
});

export default router;
