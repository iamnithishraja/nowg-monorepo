import { UserRole } from "@nowgai/shared/types";
import type { NextFunction, Request, Response } from "express";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "tech@nowg.ai";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const cookies = req.headers.cookie;

  if (cookies?.includes("admin-session=hardcoded-admin")) {
    // Set req.user with admin info for use in controllers
    (req as any).user = {
      id: "admin",
      email: ADMIN_EMAIL,
      firstName: "Admin",
      lastName: "User",
      name: "Admin",
      role: UserRole.ADMIN,
    };
    return next();
  }

  return res.status(401).json({ error: "Unauthorized" });
}
