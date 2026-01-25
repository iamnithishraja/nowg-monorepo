import { EnvConfig } from "@nowgai/shared/models";
import Razorpay from "razorpay";

let razorpayInstance: Razorpay | null = null;

/**
 * Initialize Razorpay client lazily after env is loaded
 */
async function getRazorpay(): Promise<Razorpay> {
  if (!razorpayInstance) {
    // Get API keys from database
    const keyIdConfig = await EnvConfig.findOne({ key: "RAZORPAY_KEY_ID" });
    const keySecretConfig = await EnvConfig.findOne({ key: "RAZORPAY_KEY_SECRET" });

    if (!keyIdConfig || !keySecretConfig) {
      throw new Error(
        "RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not found in database. Please add them via admin panel."
      );
    }

    razorpayInstance = new Razorpay({
      key_id: keyIdConfig.value,
      key_secret: keySecretConfig.value,
    });
  }
  return razorpayInstance;
}

export { getRazorpay };

