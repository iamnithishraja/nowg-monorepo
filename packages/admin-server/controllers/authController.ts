import type { Request, Response } from "express";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "tech@nowg.ai";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "urHwazDjvS";

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    // Check for hardcoded admin credentials
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      // Set admin session cookie
      // For localhost development, use 'lax' instead of 'none'
      const isProduction = process.env.NODE_ENV === "production";
      res.cookie("admin-session", "hardcoded-admin", {
        httpOnly: true,
        sameSite: isProduction ? "none" : "lax",
        secure: isProduction, // Must be true when sameSite is 'none'
        maxAge: 86400000, // 24 hours
        path: "/",
      });

      return res.json({
        success: true,
        user: {
          id: "admin",
          email: ADMIN_EMAIL,
          firstName: "Admin",
          lastName: "User",
          name: "Admin",
          role: "admin",
        },
        token: "admin-token", // For compatibility with frontend localStorage
      });
    }

    return res.status(401).json({
      error: "Invalid credentials",
      message: "Invalid email or password",
    });
  } catch (error: any) {
    console.error("Login error:", error);
    return res.status(500).json({
      error: "Login failed",
      message: error.message || "An error occurred during login",
    });
  }
}

export async function register(req: Request, res: Response) {
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    // For admin panel, we can allow registration but it will create a regular user
    // In a real scenario, you'd want to integrate with Better Auth or your auth system
    // For now, return an error suggesting to use login
    return res.status(403).json({
      error: "Registration not available",
      message: "Please use the login endpoint with admin credentials",
    });
  } catch (error: any) {
    console.error("Registration error:", error);
    return res.status(500).json({
      error: "Registration failed",
      message: error.message || "An error occurred during registration",
    });
  }
}

export async function getUser(req: Request, res: Response) {
  try {
    // Check for admin session cookie
    const cookies = req.headers.cookie;
    if (cookies?.includes("admin-session=hardcoded-admin")) {
      return res.json({
        id: "admin",
        email: ADMIN_EMAIL,
        firstName: "Admin",
        lastName: "User",
        name: "Admin",
        role: "admin",
      });
    }

    return res.status(401).json({ error: "Unauthorized" });
  } catch (error: any) {
    console.error("Get user error:", error);
    return res.status(500).json({
      error: "Failed to get user",
      message: error.message || "An error occurred",
    });
  }
}

export async function logout(req: Request, res: Response) {
  try {
    // Clear the admin session cookie
    const isProduction = process.env.NODE_ENV === "production";
    res.clearCookie("admin-session", {
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
      path: "/",
    });

    return res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error: any) {
    console.error("Logout error:", error);
    return res.status(500).json({
      error: "Logout failed",
      message: error.message || "An error occurred",
    });
  }
}

