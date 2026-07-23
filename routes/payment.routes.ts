import { Router } from "express";
import Stripe from "stripe";
import { z } from "zod";
import { verifyToken, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { getCollections } from "../utils/getCollections.js";
import { AppError } from "../middleware/errorHandler.js";

const router = Router();

router.use(verifyToken);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const CREDIT_PACKAGES = [
  { credits: 100, amount: 1000 },
  { credits: 300, amount: 2500 },
  { credits: 800, amount: 6000 },
  { credits: 1500, amount: 11000 },
] as const;

const createPaymentIntentSchema = z.object({
  packageIndex: z.number().min(0).max(CREDIT_PACKAGES.length - 1),
});

router.post("/create-payment-intent", requireRole("supporter"), validate(createPaymentIntentSchema), async (req, res) => {
  const { packageIndex } = req.body;
  const pkg = CREDIT_PACKAGES[packageIndex];
  if (!pkg) throw new AppError(400, "Invalid package");

  const paymentIntent = await stripe.paymentIntents.create({
    amount: pkg.amount,
    currency: "usd",
    metadata: {
      email: req.user!.email,
      credits: String(pkg.credits),
    },
  });

  res.json({ clientSecret: paymentIntent.client_secret });
});

const savePaymentSchema = z.object({
  transactionId: z.string().min(1),
  credits: z.number().positive(),
  amount: z.number().positive(),
});

router.post("/", requireRole("supporter"), validate(savePaymentSchema), async (req, res) => {
  const { transactionId, credits, amount } = req.body;
  const { users, transactions } = getCollections();

  const payment = {
    email: req.user!.email,
    type: "purchase" as const,
    credits,
    amount: amount / 100,
    transactionId,
    description: `Purchased ${credits} credits`,
    createdAt: new Date(),
  };

  await transactions.insertOne(payment);
  await users.updateOne({ email: req.user!.email }, { $inc: { credits } });

  res.status(201).json({ message: "Payment recorded, credits added" });
});

router.get("/supporter/:email", requireRole("supporter"), async (req, res) => {
  const { transactions } = getCollections();

  if (req.user!.email !== req.params.email) {
    throw new AppError(403, "Not authorized");
  }

  const payments = await transactions
    .find({ email: req.params.email, type: "purchase" })
    .sort({ createdAt: -1 })
    .toArray();

  res.json(payments);
});

export default router;
