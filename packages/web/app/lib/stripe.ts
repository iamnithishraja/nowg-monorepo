import Stripe from "stripe";
import { getEnv, getEnvWithDefault } from "~/lib/env";

let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    const secretKey = getEnv("STRIPE_SECRET_KEY");
    if (!secretKey) {
      throw new Error(
        "STRIPE_SECRET_KEY is not defined in environment variables"
      );
}
    stripeInstance = new Stripe(secretKey, {
      apiVersion: "2025-02-24.acacia",
  typescript: true,
});
  }
  return stripeInstance;
}

export const stripe = getStripe();

// Get whitelisted developer emails
export function getWhitelistedEmails(): string[] {
  const emails = getEnvWithDefault("WHITELISTED_EMAILS", "");
  return emails
    .split(",")
    .map((email) => email.trim())
    .filter((email) => email.length > 0);
}

// Check if user email is whitelisted
export function isWhitelistedEmail(email: string): boolean {
  const whitelist = getWhitelistedEmails();
  return whitelist.includes(email.toLowerCase());
}
