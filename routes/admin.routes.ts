import { Router } from "express";
import { verifyToken, requireRole } from "../middleware/auth.js";
import { getCollections } from "../utils/getCollections.js";

const router = Router();

router.use(verifyToken, requireRole("admin"));

export default router;
