import type { Request, Response, NextFunction } from "express";

const ADMIN_FRONTEND_URL =
  process.env.ADMIN_FRONTEND_URL || "http://localhost:5173";

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "https://nowgai-admin.vercel.app",
  "https://admin.nowg.ai",
  ADMIN_FRONTEND_URL,
].filter((origin, index, self) => self.indexOf(origin) === index); // Remove duplicates

export function corsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const origin = req.headers.origin;

  // In development, allow any localhost origin
  const isDevelopment = process.env.NODE_ENV !== "production";
  
  if (isDevelopment && origin && origin.includes("localhost")) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (origin) {
    // If origin is provided but not in allowed list, use it anyway in dev
    if (isDevelopment) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    } else {
      res.setHeader("Access-Control-Allow-Origin", ADMIN_FRONTEND_URL);
    }
  } else {
    // No origin header (e.g., same-origin request)
    res.setHeader("Access-Control-Allow-Origin", ADMIN_FRONTEND_URL);
  }

  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Cookie, Authorization"
  );

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Max-Age", "86400");
    return res.status(204).send();
  }

  next();
}
