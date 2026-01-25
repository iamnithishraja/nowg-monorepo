import { EnvConfig } from "@nowgai/shared/models";
import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

// Initialize Stripe client lazily after env is loaded
async function getStripe(): Promise<Stripe> {
  if (!stripeInstance) {
    // Get API key from database
    const envConfig = await EnvConfig.findOne({ key: "STRIPE_SECRET_KEY" });
    if (!envConfig) {
      throw new Error(
        "STRIPE_SECRET_KEY not found in database. Please add it via admin panel."
      );
    }
    stripeInstance = new Stripe(envConfig.value, {
      apiVersion: "2025-02-24.acacia",
      typescript: true,
    });
  }
  return stripeInstance;
}

// Get BETTER_AUTH_URL from database
async function getBetterAuthUrl(): Promise<string> {
  // const envConfig = await EnvConfig.findOne({ key: "BETTER_AUTH_URL" });
  const url = process.env.BETTER_AUTH_URL || "http://localhost:5174";

  // Normalize URL - remove trailing slash
  const normalizedUrl = url.trim().replace(/\/+$/, "");

  console.log("🔗 Using BETTER_AUTH_URL:", normalizedUrl);
  return normalizedUrl;
}

export { getBetterAuthUrl, getStripe };

