import { Router } from "express";
import { verifyToken } from "../middleware/auth.js";
import { getCollections } from "../utils/getCollections.js";

const router = Router();

router.use(verifyToken);

export default router;
