import { OrgWallet } from "@nowgai/shared/models";
import { UserRole, hasAdminAccess } from "@nowgai/shared/types";
import type { Request, Response } from "express";
import mongoose from "mongoose";
import { isOrganizationAdmin } from "../../lib/organizationRoles";
import { createPaymentCheckout } from "../../lib/paymentHandler";
import { getBetterAuthUrl } from "../../lib/stripe";
import Organization from "../../models/organizationModel";

// Helper to validate ObjectId
const isValidObjectId = (id: string): boolean => {
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * POST /api/admin/org-wallets/:organizationId/stripe-checkout
 * Create Stripe checkout session for adding credits to org wallet
 */
export async function createStripeCheckout(req: Request, res: Response) {
  try {
    const { organizationId } = req.params;
    const { amount, countryCode } = req.body;
    const adminUser = (req as any).user; // From requireAdmin middleware

    if (!organizationId || !isValidObjectId(organizationId)) {
      return res.status(400).json({ error: "Invalid organization ID" });
    }

    // If user has org admin role, check if they are admin for this organization
    // Check both hasOrgAdminAccess flag and role
    const hasOrgAdminAccessFlag =
      (adminUser as any)?.hasOrgAdminAccess || false;
    const isOrgAdminByRole =
      adminUser?.role === UserRole.ORG_ADMIN || hasOrgAdminAccessFlag;

    if (adminUser?.id) {
      // If user has org admin access flag, verify they're admin for this specific org
      if (isOrgAdminByRole) {
        const hasOrgAccess = await isOrganizationAdmin(
          adminUser.id,
          organizationId
        );
        if (!hasOrgAccess && !hasAdminAccess(adminUser.role)) {
          return res.status(403).json({
            error: "Forbidden",
            message:
              "You can only add credits to organizations where you are an admin",
          });
        }
      } else if (!hasAdminAccess(adminUser.role)) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You can only add credits to organizations where you are an admin",
        });
      }
    }

    // Validate amount
    const creditAmount = parseFloat(amount);
    if (isNaN(creditAmount) || creditAmount <= 0) {
      return res
        .status(400)
        .json({ error: "Amount must be a positive number" });
    }

    // Check if organization exists
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const betterAuthUrl = await getBetterAuthUrl();

    // Build success and cancel URLs - redirect to wallet page for org admins
    const successUrl = `${betterAuthUrl}/admin/wallet?payment=success&session_id={CHECKOUT_SESSION_ID}&provider={PROVIDER}&organizationId=${organizationId}`;
    const cancelUrl = `${betterAuthUrl}/admin/wallet?payment=cancelled&organizationId=${organizationId}`;

    console.log("💳 Creating payment checkout session:", {
      organizationId,
      amount: creditAmount,
      countryCode,
      successUrl,
      cancelUrl,
    });

    // Create payment checkout based on country code and organization
    const paymentResult = await createPaymentCheckout(
      countryCode || null,
      {
        amount: creditAmount,
        userId: adminUser?.id || adminUser?._id?.toString() || "",
        userEmail: adminUser?.email || "",
        metadata: {
          userId: adminUser?.id || adminUser?._id?.toString() || "",
          organizationId: organizationId,
          creditAmount: creditAmount.toString(),
          originalAmount: creditAmount.toString(),
          type: "org_wallet",
        },
        successUrl,
        cancelUrl,
        description: `$${creditAmount.toFixed(2)} in credits for organization wallet`,
        productName: `Organization Wallet Credits - ${organization.name}`,
      },
      organizationId
    );

    return res.json({
      success: true,
      provider: paymentResult.provider,
      sessionId: paymentResult.sessionId,
      url: paymentResult.url,
      formData: paymentResult.formData,
      formAction: paymentResult.formAction,
      keyId: paymentResult.keyId,
    });
  } catch (error: any) {
    console.error("Stripe checkout error:", error);
    return res.status(500).json({
      error: "Failed to create checkout session",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * POST /api/admin/org-wallets/:organizationId/stripe-verify
 * Verify Stripe payment and add credits to org wallet
 */
export async function verifyStripePayment(req: Request, res: Response) {
  try {
    const { organizationId } = req.params;
    const { sessionId } = req.body;
    const adminUser = (req as any).user; // From requireAdmin middleware

    if (!organizationId || !isValidObjectId(organizationId)) {
      return res.status(400).json({ error: "Invalid organization ID" });
    }

    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }

    // If user has org admin role, check if they are admin for this organization
    // Check both hasOrgAdminAccess flag and role
    const hasOrgAdminAccessFlag =
      (adminUser as any)?.hasOrgAdminAccess || false;
    const isOrgAdminByRole =
      adminUser?.role === UserRole.ORG_ADMIN || hasOrgAdminAccessFlag;

    if (adminUser?.id) {
      // If user has org admin access flag, verify they're admin for this specific org
      if (isOrgAdminByRole) {
        const hasOrgAccess = await isOrganizationAdmin(
          adminUser.id,
          organizationId
        );
        if (!hasOrgAccess && !hasAdminAccess(adminUser.role)) {
          return res.status(403).json({
            error: "Forbidden",
            message:
              "You can only verify payments for organizations where you are an admin",
          });
        }
      } else if (!hasAdminAccess(adminUser.role)) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You can only verify payments for organizations where you are an admin",
        });
      }
    }

    const stripe = await getStripe();

    // Retrieve the checkout session from Stripe
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });

    // Check if payment was successful
    if (checkoutSession.payment_status !== "paid") {
      return res.status(400).json({
        error: "Payment not completed",
        paymentStatus: checkoutSession.payment_status,
      });
    }

    // Extract metadata
    const metadata = checkoutSession.metadata || {};
    const metadataOrgId = metadata.organizationId;
    const creditAmount = parseFloat(metadata.creditAmount || "0");
    const userId = metadata.userId;

    // Verify organization ID matches (compare as strings to handle any type differences)
    const metadataOrgIdStr = String(metadataOrgId || "").trim();
    const organizationIdStr = String(organizationId || "").trim();

    if (
      !metadataOrgIdStr ||
      !organizationIdStr ||
      metadataOrgIdStr !== organizationIdStr
    ) {
      console.error("Organization ID mismatch:", {
        metadataOrgId: metadataOrgIdStr,
        organizationId: organizationIdStr,
        metadata,
      });
      return res.status(400).json({
        error: "Organization ID mismatch",
        details: `Expected ${organizationIdStr}, got ${metadataOrgIdStr} from Stripe metadata`,
      });
    }

    // Verify user matches
    const adminUserId = adminUser?.id || adminUser?._id?.toString() || "";
    if (userId && userId !== adminUserId) {
      return res.status(403).json({
        error: "User mismatch",
      });
    }

    if (!creditAmount || creditAmount <= 0) {
      return res.status(400).json({
        error: "Invalid credit amount in session metadata",
      });
    }

    // Check if organization exists
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Find or create wallet
    let wallet = await OrgWallet.findOne({
      organizationId: organizationId,
      type: "org_wallet",
    });

    if (!wallet) {
      wallet = new OrgWallet({
        organizationId: organizationId,
        type: "org_wallet",
        balance: 0,
        transactions: [],
      });
    }

    // Check if this payment has already been processed
    const paymentIntentId =
      typeof checkoutSession.payment_intent === "string"
        ? checkoutSession.payment_intent
        : checkoutSession.payment_intent?.id || "";

    const existingTransaction = wallet.transactions.find(
      (tx: any) => tx.stripePaymentId === paymentIntentId
    );

    if (existingTransaction) {
      return res.json({
        success: true,
        message: "Payment already processed",
        wallet: {
          id: wallet._id.toString(),
          organizationId: wallet.organizationId.toString(),
          organizationName: organization.name,
          type: wallet.type,
          balance: wallet.balance,
        },
      });
    }

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + creditAmount;

    // Create transaction record
    const transaction = {
      type: "credit",
      amount: creditAmount,
      balanceBefore,
      balanceAfter,
      description: `Added ${creditAmount} credits via Stripe payment`,
      performedBy: adminUserId || "system",
      stripePaymentId: paymentIntentId,
      fromAddress: null, // External payment, no from address
      toAddress: wallet._id.toString(), // To org wallet
      createdAt: new Date(),
    };

    // Update wallet
    wallet.balance = balanceAfter;
    wallet.transactions.push(transaction);
    await wallet.save();

    console.log(
      `✅ Added ${creditAmount} credits to ${organization.name}'s wallet via Stripe. New balance: ${balanceAfter}`
    );

    return res.json({
      success: true,
      message: `Successfully added ${creditAmount} credits`,
      wallet: {
        id: wallet._id.toString(),
        organizationId: wallet.organizationId.toString(),
        organizationName: organization.name,
        type: wallet.type,
        balance: wallet.balance,
        transactionCount: wallet.transactions?.length || 0,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt,
      },
      transaction: {
        type: transaction.type,
        amount: transaction.amount,
        balanceBefore: transaction.balanceBefore,
        balanceAfter: transaction.balanceAfter,
        description: transaction.description,
        createdAt: transaction.createdAt,
      },
    });
  } catch (error: any) {
    console.error("Payment verification error:", error);
    return res.status(500).json({
      error: "Payment verification failed",
      message: error.message || "An error occurred",
    });
  }
}
