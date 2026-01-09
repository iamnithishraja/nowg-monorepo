import { getEnv, getEnvWithDefault } from "~/lib/env";
import crypto from "crypto";

/**
 * PayU integration helper
 * PayU doesn't have an official Node.js SDK, so we'll use their REST API
 */

interface PayUConfig {
  key: string;
  salt: string;
  merchantId: string;
  baseUrl: string; // "https://secure.payu.in" for production or "https://test.payu.in" for sandbox
}

let payuConfig: PayUConfig | null = null;

/**
 * Get PayU configuration from environment
 */
function getPayUConfig(): PayUConfig {
  if (!payuConfig) {
    const key = getEnv("PAYU_KEY");
    const salt = getEnv("PAYU_SALT");
    const merchantId = getEnv("PAYU_MERCHANT_ID");
    const mode = getEnvWithDefault("PAYU_MODE", "sandbox"); // "production" or "sandbox"

    if (!key || !salt || !merchantId) {
      throw new Error(
        "PAYU_KEY, PAYU_SALT, or PAYU_MERCHANT_ID is not defined in environment variables"
      );
    }

    const baseUrl =
      mode === "production" ? "https://secure.payu.in" : "https://test.payu.in";

    payuConfig = {
      key,
      salt,
      merchantId,
      baseUrl,
    };
  }
  return payuConfig;
}

/**
 * Generate hash for PayU payment
 */
function generatePayUHash(
  key: string,
  salt: string,
  txnid: string,
  amount: string,
  productinfo: string,
  firstname: string,
  email: string
): string {
  const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${salt}`;
  return crypto.createHash("sha512").update(hashString).digest("hex");
}

/**
 * Verify PayU hash
 */
function verifyPayUHash(
  salt: string,
  status: string,
  hash: string,
  txnid: string,
  amount: string,
  productinfo: string,
  firstname: string,
  email: string
): boolean {
  const hashString = `${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}`;
  const calculatedHash = crypto
    .createHash("sha512")
    .update(hashString)
    .digest("hex");
  return calculatedHash === hash;
}

export { getPayUConfig, generatePayUHash, verifyPayUHash };
