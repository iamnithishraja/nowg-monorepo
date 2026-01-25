import { Profile } from "@nowgai/shared/models";
import { convertINRToUSD } from "@nowgai/shared/utils";
import type { ActionFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { getEnv } from "~/lib/env";
import { connectToDatabase } from "~/lib/mongo";
import { getPayUConfig, verifyPayUHash } from "~/lib/payu";
import { razorpay } from "~/lib/razorpay";
import { stripe } from "~/lib/stripe";

export async function action({ request }: ActionFunctionArgs) {
  try {
    // Get authenticated user session
    const authInstance = await auth;
    const session = await authInstance.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { sessionId, provider, ...paymentData } = await request.json();

    if (!sessionId || !provider) {
      return new Response(
        JSON.stringify({ error: "Session ID and provider are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Connect to database
    await connectToDatabase();

    const userId = session.user.id;

    // Verify payment based on provider
    let verificationResult;
    switch (provider) {
      case "stripe":
        verificationResult = await verifyStripePayment(sessionId, userId);
        break;
      case "razorpay":
        verificationResult = await verifyRazorpayPayment(
          sessionId,
          paymentData,
          userId
        );
        break;
      case "payu":
        verificationResult = await verifyPayUPayment(
          sessionId,
          paymentData,
          userId
        );
        break;
      default:
        return new Response(
          JSON.stringify({ error: "Invalid payment provider" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
    }

    if (!verificationResult.success) {
      return new Response(
        JSON.stringify({ error: verificationResult.error }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get or create profile
    let profile = await Profile.findOne({ userId });
    if (!profile) {
      profile = new Profile({ userId });
    }

    // Check if this payment has already been processed
    const paymentId = verificationResult.paymentId;
    const existingTransaction = profile.transactions.find(
      (tx: any) =>
        (tx.stripePaymentId === paymentId) ||
        (tx.razorpayPaymentId === paymentId) ||
        (tx.payuPaymentId === paymentId)
    );

    if (existingTransaction) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Payment already processed",
          balance: profile.balance,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Add amount to balance
    const balanceBefore = profile.balance || 0;
    const balanceAfter = balanceBefore + verificationResult.amount;

    // Create transaction record
    const transaction: any = {
      type: "recharge",
      amount: verificationResult.amount,
      balanceBefore,
      balanceAfter,
      description: `Recharged $${verificationResult.amount.toFixed(2)} via ${provider}`,
      createdAt: new Date(),
    };

    // Add provider-specific payment ID
    if (provider === "stripe") {
      transaction.stripePaymentId = paymentId;
    } else if (provider === "razorpay") {
      transaction.razorpayPaymentId = paymentId;
    } else if (provider === "payu") {
      transaction.payuPaymentId = paymentId;
    }

    profile.balance = balanceAfter;
    profile.transactions.push(transaction);
    await profile.save();

    console.log(`✅ ${provider.toUpperCase()} PAYMENT VERIFIED:`, {
      userId,
      amount: verificationResult.amount,
      finalBalance: profile.balance,
    });

    return new Response(
      JSON.stringify({
        success: true,
        balance: balanceAfter,
        amountAdded: verificationResult.amount,
        message: "Payment verified and balance updated successfully",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Payment verification error:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Payment verification failed",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * Verify Stripe payment
 */
async function verifyStripePayment(
  sessionId: string,
  userId: string
): Promise<{ success: boolean; amount?: number; paymentId?: string; error?: string }> {
  try {
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });

    if (checkoutSession.payment_status !== "paid") {
      return {
        success: false,
        error: "Payment not completed",
      };
    }

    // Verify user matches
    const metadataUserId = checkoutSession.metadata?.userId;
    if (metadataUserId !== userId) {
      return {
        success: false,
        error: "User mismatch",
      };
    }

    const paymentIntentId =
      typeof checkoutSession.payment_intent === "string"
        ? checkoutSession.payment_intent
        : checkoutSession.payment_intent?.id || "";

    const originalAmount = parseFloat(
      checkoutSession.metadata?.originalAmount || "0"
    );

    return {
      success: true,
      amount: originalAmount,
      paymentId: paymentIntentId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Stripe verification failed",
    };
  }
}

/**
 * Verify Razorpay payment
 */
async function verifyRazorpayPayment(
  orderId: string,
  paymentData: any,
  userId: string
): Promise<{ success: boolean; amount?: number; paymentId?: string; error?: string }> {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = paymentData;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return {
        success: false,
        error: "Missing Razorpay payment data",
      };
    }

    // Verify signature
    const crypto = require("crypto");
    const keySecret = getEnv("RAZORPAY_KEY_SECRET");
    if (!keySecret) {
      return {
        success: false,
        error: "Razorpay key secret not configured",
      };
    }
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generatedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(text)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return {
        success: false,
        error: "Invalid Razorpay signature",
      };
    }

    // Fetch payment details from Razorpay
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    if (payment.status !== "captured" && payment.status !== "authorized") {
      return {
        success: false,
        error: "Payment not successful",
      };
    }

    // Convert amount from paise to USD using real-time exchange rate
    const amountInINR = payment.amount / 100; // Convert from paise to INR
    const amountInUSD = await convertINRToUSD(amountInINR);

    return {
      success: true,
      amount: amountInUSD,
      paymentId: razorpay_payment_id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Razorpay verification failed",
    };
  }
}

/**
 * Verify PayU payment
 */
async function verifyPayUPayment(
  txnid: string,
  paymentData: any,
  userId: string
): Promise<{ success: boolean; amount?: number; paymentId?: string; error?: string }> {
  try {
    const { status, hash, amount, productinfo, firstname, email } = paymentData;

    if (!status || !hash || !amount) {
      return {
        success: false,
        error: "Missing PayU payment data",
      };
    }

    const config = getPayUConfig();

    // Verify hash
    const isValidHash = verifyPayUHash(
      config.salt,
      status,
      hash,
      txnid,
      amount,
      productinfo || "Nowgai Credits",
      firstname || email.split("@")[0],
      email
    );

    if (!isValidHash) {
      return {
        success: false,
        error: "Invalid PayU hash",
      };
    }

    if (status !== "success") {
      return {
        success: false,
        error: "Payment not successful",
      };
    }

    // Convert amount from INR to USD using real-time exchange rate
    const amountInINR = parseFloat(amount);
    const amountInUSD = await convertINRToUSD(amountInINR);

    return {
      success: true,
      amount: amountInUSD,
      paymentId: txnid,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "PayU verification failed",
    };
  }
}

