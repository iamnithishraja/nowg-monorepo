import { EnvConfig } from "@nowgai/shared/models";

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
 * Get PayU configuration from database
 */
async function getPayUConfig(): Promise<PayUConfig> {
  if (!payuConfig) {
    const keyConfig = await EnvConfig.findOne({ key: "PAYU_KEY" });
    const saltConfig = await EnvConfig.findOne({ key: "PAYU_SALT" });
    const merchantIdConfig = await EnvConfig.findOne({ key: "PAYU_MERCHANT_ID" });
    const modeConfig = await EnvConfig.findOne({ key: "PAYU_MODE" }); // "production" or "sandbox"

    if (!keyConfig || !saltConfig || !merchantIdConfig) {
      throw new Error(
        "PAYU_KEY, PAYU_SALT, or PAYU_MERCHANT_ID not found in database. Please add them via admin panel."
      );
    }

    const mode = modeConfig?.value || "sandbox";
    const baseUrl =
      mode === "production"
        ? "https://secure.payu.in"
        : "https://test.payu.in";

    payuConfig = {
      key: keyConfig.value,
      salt: saltConfig.value,
      merchantId: merchantIdConfig.value,
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
  const crypto = require("crypto");
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
  const crypto = require("crypto");
  const hashString = `${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}`;
  const calculatedHash = crypto
    .createHash("sha512")
    .update(hashString)
    .digest("hex");
  return calculatedHash === hash;
}

export { generatePayUHash, getPayUConfig, verifyPayUHash };

