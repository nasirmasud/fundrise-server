import "dotenv/config";
import cors from "cors";
import express from "express";
import morgan from "morgan";
import { connectDb, closeDb } from "./config/db.js";
import { errorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/auth.routes.js";
import campaignRoutes from "./routes/campaign.routes.js";
import userRoutes from "./routes/user.routes.js";
import contributionRoutes from "./routes/contribution.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import withdrawalRoutes from "./routes/withdrawal.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import adminRoutes from "./routes/admin.routes.js";

const app = express();
const PORT = process.env.PORT ?? 5000;

const allowedOrigins = process.env.CORS_ORIGINS?.split(",") ?? ["http://localhost:3000"];
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(morgan("dev"));

app.get("/", (_req, res) => {
  res.send("Crowdfunding Server is Running");
});

app.use("/api/auth", authRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/users", userRoutes);
app.use("/api/contributions", contributionRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/withdrawals", withdrawalRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);

app.use(errorHandler);

async function start() {
  await connectDb();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start();

process.on("SIGINT", async () => {
  console.log("Shutting down gracefully...");
  await closeDb();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Shutting down gracefully...");
  await closeDb();
  process.exit(0);
});
