import cors from "cors";
import dotenv from "dotenv";
import express, { type Request, type Response } from "express";
import mongoose from "mongoose";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI as string)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.log(err));

app.get("/", (req: Request, res: Response) => {
  res.send("Crowdfunding Server is Running");
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
