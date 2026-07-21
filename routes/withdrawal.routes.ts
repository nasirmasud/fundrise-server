import { Router } from "express";
import { z } from "zod";
import { verifyToken, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { getCollections } from "../utils/getCollections.js";
import { AppError } from "../middleware/errorHandler.js";

const router = Router();

router.use(verifyToken);

const createWithdrawalSchema = z.object({
  amount: z.number().min(200, "Minimum withdrawal is 200 credits"),
  paymentSystem: z.string().min(1, "Payment system is required"),
  accountNumber: z.string().min(1, "Account number is required"),
});

// Creator: create withdrawal request
router.post("/", requireRole("creator"), validate(createWithdrawalSchema), async (req, res) => {
  const { amount, paymentSystem, accountNumber } = req.body;
  const { users, campaigns, withdrawalRequests } = getCollections();

  // Get total raised across all creator's campaigns
  const creatorCampaigns = await campaigns
    .find({ creatorEmail: req.user!.email })
    .toArray();
  const totalRaised = creatorCampaigns.reduce((sum, c) => sum + (c.raisedAmount || 0), 0);

  // Get existing pending withdrawals
  const pendingWithdrawals = await withdrawalRequests
    .find({ creatorEmail: req.user!.email, status: "pending" })
    .toArray();
  const pendingAmount = pendingWithdrawals.reduce((sum, w) => sum + w.amount, 0);

  const available = totalRaised - pendingAmount;

  if (amount > available) {
    throw new AppError(400, `Insufficient credits. Available: ${available} credits`);
  }

  const withdrawal = {
    creatorEmail: req.user!.email,
    amount,
    withdrawalAmount: amount / 20, // 20 credits = $1
    paymentSystem,
    accountNumber,
    status: "pending" as const,
    createdAt: new Date(),
  };

  const result = await withdrawalRequests.insertOne(withdrawal);
  res.status(201).json({ ...withdrawal, _id: result.insertedId });
});

// Creator: get own withdrawal history
router.get("/creator/:email", requireRole("creator"), async (req, res) => {
  const { withdrawalRequests } = getCollections();

  if (req.user!.email !== req.params.email) {
    throw new AppError(403, "Not authorized");
  }

  const withdrawals = await withdrawalRequests
    .find({ creatorEmail: req.params.email })
    .sort({ createdAt: -1 })
    .toArray();

  res.json(withdrawals);
});

// Admin: get all pending withdrawals
router.get("/pending", requireRole("admin"), async (_req, res) => {
  const { withdrawalRequests } = getCollections();
  const withdrawals = await withdrawalRequests
    .find({ status: "pending" })
    .sort({ createdAt: -1 })
    .toArray();
  res.json(withdrawals);
});

// Admin: approve withdrawal
router.patch("/:id/approve", requireRole("admin"), async (req, res) => {
  const { withdrawalRequests, users, notifications } = getCollections();
  const withdrawal = await withdrawalRequests.findOne({ _id: req.params.id as any });

  if (!withdrawal) throw new AppError(404, "Withdrawal not found");
  if (withdrawal.status !== "pending") throw new AppError(400, "Withdrawal is not pending");

  await withdrawalRequests.updateOne(
    { _id: withdrawal._id },
    { $set: { status: "paid", updatedAt: new Date() } }
  );

  // Decrement creator's raised credits
  await users.updateOne(
    { email: withdrawal.creatorEmail },
    { $inc: { raisedCredits: -withdrawal.amount } }
  );

  await notifications.insertOne({
    message: `Your withdrawal of ${withdrawal.amount} credits ($${withdrawal.withdrawalAmount}) has been approved`,
    toEmail: withdrawal.creatorEmail,
    actionRoute: "/dashboard/creator-payment-history",
    time: new Date(),
    read: false,
  });

  res.json({ message: "Withdrawal approved" });
});

export default router;
