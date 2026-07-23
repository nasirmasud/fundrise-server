import { Router } from "express";
import { ObjectId } from "mongodb";
import { verifyToken, requireRole } from "../middleware/auth.js";
import { getCollections } from "../utils/getCollections.js";
import { AppError } from "../middleware/errorHandler.js";

const router = Router();

router.use(verifyToken, requireRole("admin"));

router.get("/stats", async (_req, res) => {
  const { users, campaigns, transactions, contributions } = getCollections();

  const [totalUsers, totalCreators, totalSupporters, totalCampaigns, pendingCampaigns] = await Promise.all([
    users.countDocuments(),
    users.countDocuments({ role: "creator" }),
    users.countDocuments({ role: "supporter" }),
    campaigns.countDocuments(),
    campaigns.countDocuments({ status: "pending" }),
  ]);

  const creditsAgg = await users
    .aggregate([
      { $group: { _id: null, totalCredits: { $sum: "$credits" } } },
    ])
    .toArray();

  const totalCredits = creditsAgg[0]?.totalCredits ?? 0;

  const paymentsAgg = await transactions
    .aggregate([
      { $match: { type: "purchase" } },
      { $group: { _id: null, totalPayments: { $sum: "$amount" } } },
    ])
    .toArray();

  const totalPayments = paymentsAgg[0]?.totalPayments ?? 0;

  const contributionsAgg = await contributions
    .aggregate([
      { $match: { status: "approved" } },
      { $group: { _id: null, totalContributions: { $sum: "$amount" } } },
    ])
    .toArray();

  const totalContributions = contributionsAgg[0]?.totalContributions ?? 0;

  res.json({
    totalUsers,
    totalCreators,
    totalSupporters,
    totalCampaigns,
    pendingCampaigns,
    totalCredits,
    totalPayments,
    totalContributions,
  });
});

router.get("/reports", async (_req, res) => {
  const { reports } = getCollections();
  const items = await reports.find().sort({ date: -1 }).toArray();
  res.json(items);
});

router.patch("/reports/:id", async (req, res) => {
  const { reports } = getCollections();
  const { status } = req.body;

  if (!["resolved", "dismissed"].includes(status)) {
    throw new AppError(400, "Status must be 'resolved' or 'dismissed'");
  }

  const report = await reports.findOne({ _id: new ObjectId(req.params.id) });
  if (!report) throw new AppError(404, "Report not found");

  await reports.updateOne({ _id: report._id }, { $set: { status } });

  res.json({ message: `Report ${status}` });
});

export default router;
