import Razorpay from "razorpay";
import { getEnv } from "~/lib/env";

let razorpayInstance: Razorpay | null = null;

/**
 * Initialize Razorpay client
 */
function getRazorpay(): Razorpay {
  if (!razorpayInstance) {
    const keyId = getEnv("RAZORPAY_KEY_ID");
    const keySecret = getEnv("RAZORPAY_KEY_SECRET");

    if (!keyId || !keySecret) {
      throw new Error(
        "RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not defined in environment variables"
      );
    }

    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }
  return razorpayInstance;
}

// Lazy initialization - only create instance when accessed
export const razorpay = new Proxy({} as Razorpay, {
  get(_target, prop) {
    return getRazorpay()[prop as keyof Razorpay];
  },
});
