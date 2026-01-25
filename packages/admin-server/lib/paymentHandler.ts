import { convertUSDToINR } from "@nowgai/shared/utils";
import {
    getPaymentProviderForOrganization
} from "./paymentProvider";
import { generatePayUHash, getPayUConfig } from "./payu";
import { getRazorpay } from "./razorpay";
import { getStripe } from "./stripe";

export type PaymentProvider = "stripe" | "razorpay" | "payu";

interface PaymentCheckoutParams {
  amount: number; // in USD
  currency?: string; // defaults to USD for Stripe, INR for Razorpay/PayU
  userId: string;
  userEmail: string;
  metadata: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
  description?: string;
  productName?: string;
}

interface PaymentCheckoutResult {
  provider: PaymentProvider;
  sessionId: string;
  url?: string; // For Stripe and Razorpay
  formData?: Record<string, string>; // For PayU
  formAction?: string; // For PayU
  keyId?: string; // For Razorpay frontend integration
}

/**
 * Create payment checkout session based on provider
 */
export async function createPaymentCheckout(
  countryCode: string | null,
  params: PaymentCheckoutParams,
  organizationId?: string | null
): Promise<PaymentCheckoutResult> {
  // Get payment provider - check organization first, then country, then default
  const resolvedCountryCode = countryCode || "US";
  console.log("🌍 Payment checkout - Country code:", resolvedCountryCode);
  console.log("🏢 Payment checkout - Organization ID:", organizationId);
  const provider = await getPaymentProviderForOrganization(
    organizationId,
    resolvedCountryCode
  );
  console.log("💳 Payment checkout - Selected provider:", provider);

  // Convert amount based on provider
  // For India providers, convert USD to INR using real-time exchange rate
  const amountInINR =
    provider !== "stripe" ? await convertUSDToINR(params.amount) : params.amount;

  switch (provider) {
    case "stripe":
      return await createStripeCheckout(params);

    case "razorpay":
      return await createRazorpayCheckout({
        ...params,
        amount: amountInINR,
        currency: "INR",
      });

    case "payu":
      return await createPayUCheckout({
        ...params,
        amount: amountInINR,
        currency: "INR",
      });

    default:
      // Fallback to Stripe
      return await createStripeCheckout(params);
  }
}

/**
 * Create Stripe checkout session
 */
async function createStripeCheckout(
  params: PaymentCheckoutParams
): Promise<PaymentCheckoutResult> {
  const stripe = await getStripe();
  const chargeAmount = Math.ceil(params.amount * 100); // Convert to cents

  const checkoutSession = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: params.currency || "usd",
          product_data: {
            name: params.productName || "Nowgai Credits",
            description: params.description || `$${params.amount.toFixed(2)} payment`,
          },
          unit_amount: chargeAmount,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    customer_email: params.userEmail,
    metadata: params.metadata,
  });

  return {
    provider: "stripe",
    sessionId: checkoutSession.id,
    url: checkoutSession.url || undefined,
  };
}

/**
 * Create Razorpay order
 */
async function createRazorpayCheckout(
  params: PaymentCheckoutParams
): Promise<PaymentCheckoutResult> {
  const razorpayInstance = await getRazorpay();
  const amountInPaise = Math.ceil(params.amount * 100); // Convert to paise

  const order = await razorpayInstance.orders.create({
    amount: amountInPaise,
    currency: params.currency || "INR",
    receipt: `receipt_${Date.now()}`,
    notes: params.metadata,
  });

  // Get key ID from env for frontend integration
  const EnvConfig = (await import("../models/envConfigModel")).default;
  const keyIdConfig = await EnvConfig.findOne({ key: "RAZORPAY_KEY_ID" });
  const keyId = keyIdConfig?.value || "";

  return {
    provider: "razorpay",
    sessionId: order.id,
    keyId,
    // Razorpay requires frontend integration, so we return order details
    // Frontend will need to use Razorpay SDK
  };
}

/**
 * Create PayU payment form data
 */
async function createPayUCheckout(
  params: PaymentCheckoutParams
): Promise<PaymentCheckoutResult> {
  const config = await getPayUConfig();
  const txnid = `TXN${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
  const amount = params.amount.toFixed(2);
  const productinfo = params.productName || "Nowgai Credits";
  const firstname = params.userEmail.split("@")[0]; // Extract name from email
  const email = params.userEmail;

  const hash = generatePayUHash(
    config.key,
    config.salt,
    txnid,
    amount,
    productinfo,
    firstname,
    email
  );

  const formData = {
    key: config.key,
    txnid,
    amount,
    productinfo,
    firstname,
    email,
    phone: "", // Optional
    surl: params.successUrl,
    furl: params.cancelUrl,
    hash,
    service_provider: "payu_paisa",
  };

  return {
    provider: "payu",
    sessionId: txnid,
    formData,
    formAction: `${config.baseUrl}/_payment`,
  };
}

