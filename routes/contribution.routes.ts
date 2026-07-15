import { Router } from "express";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { verifyToken, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { AppError } from "../middleware/errorHandler.js";
import { getCollections } from "../utils/getCollections.js";

const router = Router();

router.use(verifyToken);

const createSchema = z.object({
  campaignId: z.string().min(1),
  amount: z.number().positive("Amount must be positive"),
});

router.post("/", requireRole("supporter"), validate(createSchema), async (req, res) => {
  const { campaignId, amount } = req.body;
  const { campaigns, users, contributions, notifications } = getCollections();

  const campaign = await campaigns.findOne({ _id: new ObjectId(campaignId) });
  if (!campaign) throw new AppError(404, "Campaign not found");
  if (campaign.status !== "approved") throw new AppError(400, "Campaign is not approved");
  if (campaign.deadline < new Date()) throw new AppError(400, "Campaign deadline has passed");

  const supporter = await users.findOne({ email: req.user!.email });
  if (!supporter) throw new AppError(404, "Supporter not found");
  if ((supporter.credits ?? 0) < amount) throw new AppError(400, "Insufficient credits");

  await users.updateOne({ email: req.user!.email }, { $inc: { credits: -amount } });

  const contribution = {
    campaignId,
    campaignTitle: campaign.title,
    amount,
    supporterEmail: req.user!.email,
    supporterName: supporter.name,
    creatorEmail: campaign.creatorEmail,
    creatorName: campaign.creatorName ?? "Unknown",
    status: "pending" as const,
    date: new Date(),
  };

  const result = await contributions.insertOne(contribution);

  await notifications.insertOne({
    message: `New contribution of ${amount} credits to "${campaign.title}" by ${supporter.name}`,
    toEmail: campaign.creatorEmail,
    actionRoute: "/dashboard/creator-home",
    time: new Date(),
    read: false,
  });

  res.status(201).json({ ...contribution, _id: result.insertedId });
});

router.get("/my", requireRole("supporter"), async (req, res) => {
  const { contributions } = getCollections();
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  const skip = (page - 1) * limit;

  const filter = { supporterEmail: req.user!.email };
  const [items, total] = await Promise.all([
    contributions.find(filter).sort({ date: -1 }).skip(skip).limit(limit).toArray(),
    contributions.countDocuments(filter),
  ]);

  res.json({ items, total, page, totalPages: Math.ceil(total / limit) });
});

router.get("/my-campaigns", requireRole("creator"), async (req, res) => {
  const { contributions } = getCollections();
  const items = await contributions
    .find({ creatorEmail: req.user!.email, status: "pending" })
    .sort({ date: -1 })
    .toArray();
  res.json(items);
});

async function getContributionOrThrow(id: string) {
  const { contributions } = getCollections();
  const contribution = await contributions.findOne({ _id: new ObjectId(id) });
  if (!contribution) throw new AppError(404, "Contribution not found");
  return contribution;
}

router.patch("/:id/approve", requireRole("creator"), async (req, res) => {
  const { campaigns, contributions, notifications, users } = getCollections();
  const contribution = await getContributionOrThrow(req.params.id);

  if (contribution.creatorEmail !== req.user!.email) throw new AppError(403, "Not your campaign's contribution");
  if (contribution.status !== "pending") throw new AppError(400, "Contribution is not pending");

  await contributions.updateOne({ _id: contribution._id }, { $set: { status: "approved" } });
  await campaigns.updateOne({ _id: new ObjectId(contribution.campaignId) }, { $inc: { raisedAmount: contribution.amount } });

  const creator = await users.findOne({ email: req.user!.email });

  await notifications.insertOne({
    message: `Your contribution of ${contribution.amount} credits to "${contribution.campaignTitle}" was approved by ${creator?.name ?? req.user!.email}`,
    toEmail: contribution.supporterEmail,
    actionRoute: "/dashboard/my-contributions",
    time: new Date(),
    read: false,
  });

  const updated = await contributions.findOne({ _id: contribution._id });
  res.json(updated);
});

router.patch("/:id/reject", requireRole("creator"), async (req, res) => {
  const { users, contributions, notifications } = getCollections();
  const contribution = await getContributionOrThrow(req.params.id);

  if (contribution.creatorEmail !== req.user!.email) throw new AppError(403, "Not your campaign's contribution");
  if (contribution.status !== "pending") throw new AppError(400, "Contribution is not pending");

  await contributions.updateOne({ _id: contribution._id }, { $set: { status: "rejected" } });
  await users.updateOne({ email: contribution.supporterEmail }, { $inc: { credits: contribution.amount } });

  const creator = await users.findOne({ email: req.user!.email });

  await notifications.insertOne({
    message: `Your contribution of ${contribution.amount} credits to "${contribution.campaignTitle}" was rejected by ${creator?.name ?? req.user!.email}`,
    toEmail: contribution.supporterEmail,
    actionRoute: "/dashboard/my-contributions",
    time: new Date(),
    read: false,
  });

  const updated = await contributions.findOne({ _id: contribution._id });
  res.json(updated);
});

export default router;
