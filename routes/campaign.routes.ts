import { Router } from "express";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { validate } from "../middleware/validate.js";
import { verifyToken, requireRole } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";
import { getCollections } from "../utils/getCollections.js";

const router = Router();

const createCampaignSchema = z.object({
  title: z.string().min(1, "Title is required"),
  story: z.string().min(1, "Story is required"),
  category: z.string().min(1, "Category is required"),
  fundingGoal: z.number().positive("Funding goal must be positive"),
  minContribution: z.number().positive("Minimum contribution must be positive"),
  deadline: z.coerce.date({ message: "Invalid deadline date" }),
  rewardInfo: z.string().optional(),
  imageURL: z.string().optional(),
});

const updateCampaignSchema = z.object({
  title: z.string().min(1).optional(),
  story: z.string().min(1).optional(),
  rewardInfo: z.string().optional(),
});

router.post("/", verifyToken, requireRole("creator"), validate(createCampaignSchema), async (req, res) => {
  const { title, story, category, fundingGoal, minContribution, deadline, rewardInfo, imageURL } = req.body;

  const { campaigns, users } = getCollections();
  const creator = await users.findOne({ email: req.user!.email });
  const campaign = {
    creatorEmail: req.user!.email,
    creatorName: creator?.name ?? req.user!.email,
    title,
    story,
    category,
    fundingGoal,
    minContribution,
    deadline: new Date(deadline),
    rewardInfo: rewardInfo ?? "",
    imageURL: imageURL ?? "",
    raisedAmount: 0,
    status: "pending" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await campaigns.insertOne(campaign);
  res.status(201).json({ ...campaign, _id: result.insertedId });
});

router.get("/", async (req, res) => {
  const { campaigns } = getCollections();
  const { category, search } = req.query;

  const filter: Record<string, unknown> = {
    status: "approved",
    deadline: { $gte: new Date() },
  };

  if (category) filter.category = category;
  if (search) filter.title = { $regex: search, $options: "i" };

  const results = await campaigns.find(filter).sort({ createdAt: -1 }).toArray();
  res.json(results);
});

router.get("/my", verifyToken, requireRole("creator"), async (req, res) => {
  const { campaigns } = getCollections();
  const results = await campaigns.find({ creatorEmail: req.user!.email }).sort({ createdAt: -1 }).toArray();
  res.json(results);
});

function toObjectId(id: unknown) {
  return new ObjectId(String(id));
}

router.get("/:id", async (req, res) => {
  const { campaigns } = getCollections();
  const campaign = await campaigns.findOne({ _id: toObjectId(req.params.id) });
  if (!campaign) throw new AppError(404, "Campaign not found");
  res.json(campaign);
});

router.patch("/:id", verifyToken, requireRole("creator"), validate(updateCampaignSchema), async (req, res) => {
  const { campaigns } = getCollections();
  const oid = toObjectId(req.params.id);
  const campaign = await campaigns.findOne({ _id: oid });

  if (!campaign) throw new AppError(404, "Campaign not found");
  if (campaign.creatorEmail !== req.user!.email) throw new AppError(403, "Not your campaign");

  const updates = { ...req.body, updatedAt: new Date() };
  await campaigns.updateOne({ _id: oid }, { $set: updates });

  const updated = await campaigns.findOne({ _id: oid });
  res.json(updated);
});

router.delete("/:id", verifyToken, requireRole("creator"), async (req, res) => {
  const { campaigns, contributions, users } = getCollections();
  const oid = toObjectId(req.params.id);
  const campaign = await campaigns.findOne({ _id: oid });

  if (!campaign) throw new AppError(404, "Campaign not found");
  if (campaign.creatorEmail !== req.user!.email) throw new AppError(403, "Not your campaign");

  const approvedContributions = await contributions
    .find({ campaignId: req.params.id, status: "approved" })
    .toArray();

  for (const c of approvedContributions) {
    await users.updateOne({ email: c.supporterEmail }, { $inc: { credits: c.amount } });
  }

  await campaigns.deleteOne({ _id: oid });
  res.json({ message: "Campaign deleted", refunded: approvedContributions.length });
});

export default router;
