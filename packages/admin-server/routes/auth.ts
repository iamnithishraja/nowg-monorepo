import { Router } from "express";
import { auth } from "../lib/auth";

const router = Router();

// BetterAuth handles all auth routes through a single handler
// This includes: /sign-up, /sign-in, /sign-out, /session, /callback/google, /callback/github, etc.
router.all("*", (req, res) => auth.handler(req as any, res as any));

export default router;
