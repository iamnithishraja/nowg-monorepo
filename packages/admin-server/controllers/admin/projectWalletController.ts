import { OrgWallet } from "@nowgai/shared/models";
import { UserRole, hasAdminAccess } from "@nowgai/shared/types";
import {
    calculateMaxCreditBack,
    calculateTotalCreditedBack,
    calculateTotalReceivedFromOrg,
    createTransaction,
    getLastTransactionId,
    validateCreditBackAmount,
} from "@nowgai/shared/utils";
import type { Request, Response } from "express";
import mongoose from "mongoose";
import { isOrganizationAdmin } from "../../lib/organizationRoles";
import { createPaymentCheckout } from "../../lib/paymentHandler";
import { isProjectAdmin } from "../../lib/projectRoles";
import { getBetterAuthUrl } from "../../lib/stripe";
import Organization from "../../models/organizationModel";
import OrgProjectWallet from "../../models/orgProjectWalletModel";
import Project from "../../models/projectModel";

// Helper to validate ObjectId
const isValidObjectId = (id: string): boolean => {
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * GET /api/admin/project-wallets/:projectId
 * Get or create wallet for a project
 */
export async function getOrCreateProjectWallet(req: Request, res: Response) {
  try {
    const { projectId } = req.params;
    const user = (req as any).user;

    if (!projectId || !isValidObjectId(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Check permissions: must be project admin, org admin for this project's organization, or system admin
    if (user?.id) {
      const hasAccess = await isProjectAdmin(user.id, projectId);
      const hasOrgAccess = await isOrganizationAdmin(
        user.id,
        project.organizationId.toString()
      );
      if (!hasAccess && !hasOrgAccess && !hasAdminAccess(user.role)) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You can only access wallets for projects where you are an admin",
        });
      }
    }

    // Find existing wallet or create new one
    let wallet = await OrgProjectWallet.findOne({
      projectId: projectId,
    });

    if (!wallet) {
      // Create new wallet for the project
      wallet = new OrgProjectWallet({
        projectId: projectId,
        balance: 0,
        transactions: [],
      });
      await wallet.save();
      console.log(`✅ Created new wallet for project: ${project.name}`);
    }

    const organization = await Organization.findById(project.organizationId);

    return res.json({
      wallet: {
        id: wallet._id.toString(),
        projectId: wallet.projectId.toString(),
        projectName: project.name,
        organizationId: project.organizationId.toString(),
        organizationName: organization?.name || "",
        balance: wallet.balance,
        transactionCount: wallet.transactions?.length || 0,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt,
      },
    });
  } catch (error: any) {
    console.error("Error getting/creating project wallet:", error);
    return res.status(500).json({
      error: "Failed to get project wallet",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * POST /api/admin/project-wallets/:projectId/transfer-from-org
 * Transfer funds from organization wallet to project wallet (ATOMIC)
 * This creates a debit in org wallet and credit in project wallet
 */
export async function transferFundsToProject(req: Request, res: Response) {
  try {
    const { projectId } = req.params;
    const { amount, description } = req.body;
    const adminUser = (req as any).user;

    if (!projectId || !isValidObjectId(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    // Validate amount
    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return res.status(400).json({
        error: "Amount must be a positive number",
      });
    }

    // Get project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // If user has project admin role or org admin role, check permissions
    if (adminUser?.id) {
      const hasAccess = await isProjectAdmin(adminUser.id, projectId);
      const hasOrgAccess = await isOrganizationAdmin(
        adminUser.id,
        project.organizationId
      );
      if (!hasAccess && !hasOrgAccess && !hasAdminAccess(adminUser.role)) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You can only transfer funds to projects where you are an admin",
        });
      }
      // Verify the project belongs to their organization
      // Only check this if user is NOT an org admin for this project's organization
      // (hasOrgAccess already verifies they're an org admin for the project's org)
      if (
        !hasOrgAccess &&
        !hasAdminAccess(adminUser.role) &&
        adminUser.organizationId &&
        adminUser.organizationId !== project.organizationId.toString()
      ) {
        return res.status(403).json({
          error: "Forbidden",
          message: "Project does not belong to your organization",
        });
      }
    }

    const organizationId = project.organizationId;
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Start a MongoDB session for atomic transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Get org wallet
      let orgWallet = await OrgWallet.findOne({
        organizationId: organizationId,
        type: "org_wallet",
      }).session(session);

      if (!orgWallet) {
        orgWallet = new OrgWallet({
          organizationId: organizationId,
          type: "org_wallet",
          balance: 0,
          transactions: [],
        });
        await orgWallet.save({ session });
      }

      // Check if org has sufficient balance
      if (orgWallet.balance < transferAmount) {
        await session.abortTransaction();
        return res.status(400).json({
          error: "Insufficient balance",
          message: `Organization wallet has insufficient balance. Current balance: ${orgWallet.balance}, Required: ${transferAmount}`,
        });
      }

      // Get or create project wallet
      let projectWallet = await OrgProjectWallet.findOne({
        projectId: projectId,
      }).session(session);

      if (!projectWallet) {
        projectWallet = new OrgProjectWallet({
          projectId: projectId,
          balance: 0,
          transactions: [],
        });
        await projectWallet.save({ session });
      }

      // Calculate balances
      const orgBalanceBefore = orgWallet.balance;
      const orgBalanceAfter = orgBalanceBefore - transferAmount;
      const projectBalanceBefore = projectWallet.balance;
      const projectBalanceAfter = projectBalanceBefore + transferAmount;

      // Create org wallet debit transaction
      const orgTransaction = {
        type: "debit",
        amount: transferAmount,
        balanceBefore: orgBalanceBefore,
        balanceAfter: orgBalanceAfter,
        description:
          description?.trim() || `Transfer to project: ${project.name}`,
        performedBy: adminUser?.id || adminUser?._id?.toString() || "system",
        fromAddress: orgWallet._id.toString(), // From org wallet
        toAddress: projectWallet._id.toString(), // To project wallet
        createdAt: new Date(),
      };

      // Create project wallet credit transaction
      const projectTransaction = {
        type: "credit",
        amount: transferAmount,
        balanceBefore: projectBalanceBefore,
        balanceAfter: projectBalanceAfter,
        description:
          description?.trim() ||
          `Transfer from organization: ${organization.name}`,
        performedBy: adminUser?.id || adminUser?._id?.toString() || "system",
        relatedOrgWalletTransactionId: null, // Will be set after org transaction is saved
        fromAddress: orgWallet._id.toString(), // From org wallet
        toAddress: projectWallet._id.toString(), // To project wallet
        createdAt: new Date(),
      };

      // Update org wallet
      orgWallet.balance = orgBalanceAfter;
      orgWallet.transactions.push(orgTransaction);
      await orgWallet.save({ session });

      // Link project transaction to org transaction
      const orgTransactionId =
        orgWallet.transactions[
          orgWallet.transactions.length - 1
        ]._id?.toString();
      if (orgTransactionId) {
        projectTransaction.relatedOrgWalletTransactionId = orgTransactionId;
      }

      // Update project wallet
      projectWallet.balance = projectBalanceAfter;
      projectWallet.transactions.push(projectTransaction);
      await projectWallet.save({ session });

      // Commit the transaction
      await session.commitTransaction();

      console.log(
        `✅ Transferred ${transferAmount} from ${organization.name} to project ${project.name}. Org balance: ${orgBalanceAfter}, Project balance: ${projectBalanceAfter}`
      );

      return res.json({
        success: true,
        message: `Successfully transferred ${transferAmount} credits to project`,
        orgWallet: {
          id: orgWallet._id.toString(),
          organizationId: orgWallet.organizationId.toString(),
          balance: orgWallet.balance,
          transaction: {
            type: orgTransaction.type,
            amount: orgTransaction.amount,
            balanceBefore: orgTransaction.balanceBefore,
            balanceAfter: orgTransaction.balanceAfter,
            description: orgTransaction.description,
            createdAt: orgTransaction.createdAt,
          },
        },
        projectWallet: {
          id: projectWallet._id.toString(),
          projectId: projectWallet.projectId.toString(),
          balance: projectWallet.balance,
          transaction: {
            type: projectTransaction.type,
            amount: projectTransaction.amount,
            balanceBefore: projectTransaction.balanceBefore,
            balanceAfter: projectTransaction.balanceAfter,
            description: projectTransaction.description,
            createdAt: projectTransaction.createdAt,
          },
        },
      });
    } catch (error: any) {
      // Abort transaction on error
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  } catch (error: any) {
    console.error("Error transferring funds to project:", error);
    return res.status(500).json({
      error: "Failed to transfer funds",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * POST /api/admin/project-wallets/:projectId/add-credits
 * Add credits directly to a project wallet (for admin use)
 */
export async function addCreditsToProject(req: Request, res: Response) {
  try {
    const { projectId } = req.params;
    const { amount, description } = req.body;
    const adminUser = (req as any).user;

    if (!projectId || !isValidObjectId(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    // Only ADMIN and TECH_SUPPORT can add credits directly
    if (
      adminUser?.role !== UserRole.ADMIN &&
      adminUser?.role !== UserRole.TECH_SUPPORT
    ) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Only admins can add credits directly to project wallets",
      });
    }

    // Validate amount
    const creditAmount = parseFloat(amount);
    if (isNaN(creditAmount) || creditAmount <= 0) {
      return res.status(400).json({
        error: "Amount must be a positive number",
      });
    }

    // Get project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Find or create project wallet
    let projectWallet = await OrgProjectWallet.findOne({
      projectId: projectId,
    });

    if (!projectWallet) {
      projectWallet = new OrgProjectWallet({
        projectId: projectId,
        balance: 0,
        transactions: [],
      });
    }

    const balanceBefore = projectWallet.balance;
    const balanceAfter = balanceBefore + creditAmount;

    // Create transaction record
    const transaction = {
      type: "credit",
      amount: creditAmount,
      balanceBefore,
      balanceAfter,
      description: description?.trim() || `Added ${creditAmount} credits`,
      performedBy: adminUser?.id || adminUser?._id?.toString() || "admin",
      relatedOrgWalletTransactionId: null,
      fromAddress: null, // Direct admin credit, no from address
      toAddress: projectWallet._id.toString(), // To project wallet
      createdAt: new Date(),
    };

    // Update wallet
    projectWallet.balance = balanceAfter;
    projectWallet.transactions.push(transaction);
    await projectWallet.save();

    console.log(
      `✅ Added ${creditAmount} credits to project ${project.name}'s wallet. New balance: ${balanceAfter}`
    );

    return res.json({
      success: true,
      message: `Successfully added ${creditAmount} credits`,
      wallet: {
        id: projectWallet._id.toString(),
        projectId: projectWallet.projectId.toString(),
        projectName: project.name,
        balance: projectWallet.balance,
        transactionCount: projectWallet.transactions?.length || 0,
        createdAt: projectWallet.createdAt,
        updatedAt: projectWallet.updatedAt,
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
    console.error("Error adding credits to project:", error);
    return res.status(500).json({
      error: "Failed to add credits",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * GET /api/admin/project-wallets/:projectId/transactions
 * Get wallet transactions for a project
 */
export async function getProjectWalletTransactions(
  req: Request,
  res: Response
) {
  try {
    const { projectId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const user = (req as any).user;

    if (!projectId || !isValidObjectId(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    // Get project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Check permissions: must be project admin, org admin for this project's organization, or system admin
    if (user?.id) {
      const hasAccess = await isProjectAdmin(user.id, projectId);
      const hasOrgAccess = await isOrganizationAdmin(
        user.id,
        project.organizationId.toString()
      );
      if (!hasAccess && !hasOrgAccess && !hasAdminAccess(user.role)) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You can only access wallets for projects where you are an admin",
        });
      }
    }

    // Find wallet
    const wallet = await OrgProjectWallet.findOne({
      projectId: projectId,
    });

    if (!wallet) {
      return res.json({
        transactions: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasMore: false,
        },
        wallet: null,
      });
    }

    // Get transactions with pagination (sorted by newest first)
    // Filter to show ONLY external payment gateway transactions (Stripe payments)
    // Show both:
    // 1. Direct Stripe payments to project wallet (funds added by project admin directly)
    // 2. Transfers from org wallet to project wallet (which have relatedOrgWalletTransactionId)
    // Exclude: deductions, credit backs, and other internal transfers
    const allTransactions = (wallet.transactions || []).filter((t: any) => {
      // Must be a credit transaction
      const isCredit = t.type === "credit";
      // Must NOT be a deduction (debit type)
      const isNotDeduction = t.type !== "debit";
      // Must NOT be a credit back transaction
      const isNotCreditBack = !t.isCreditBack || t.isCreditBack === false;
      
      if (!isCredit || !isNotDeduction || !isNotCreditBack) {
        return false;
      }
      
      // Case 1: Direct Stripe payment (funds added by project admin)
      // Check if it has stripePaymentId OR if description indicates Stripe payment
      const hasStripePaymentId = t.stripePaymentId != null && t.stripePaymentId !== "";
      const isStripePaymentDescription = t.description && 
        (t.description.includes("Stripe payment") || t.description.includes("via Stripe"));
      
      if (hasStripePaymentId || isStripePaymentDescription) {
        // Must NOT have fromAddress (direct Stripe payment, not a transfer)
        return !t.fromAddress || t.fromAddress === null;
      }
      
      // Case 2: Transfer from org wallet (has relatedOrgWalletTransactionId or fromAddress)
      const hasRelatedOrgTx = t.relatedOrgWalletTransactionId != null && t.relatedOrgWalletTransactionId !== "";
      const hasFromAddress = t.fromAddress != null && t.fromAddress !== "";
      if (hasRelatedOrgTx || hasFromAddress) {
        // This is a transfer from org wallet to project wallet
        return true;
      }
      
      // Exclude everything else
      return false;
    });
    const sortedTransactions = [...allTransactions].sort(
      (a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const total = sortedTransactions.length;
    const skip = (page - 1) * limit;
    const paginatedTransactions = sortedTransactions.slice(skip, skip + limit);

    return res.json({
      transactions: paginatedTransactions.map((t: any) => ({
        id: t._id?.toString(),
        type: t.type,
        amount: t.amount,
        balanceBefore: t.balanceBefore,
        balanceAfter: t.balanceAfter,
        description: t.description,
        performedBy: t.performedBy,
        stripePaymentId: t.stripePaymentId,
        relatedOrgWalletTransactionId: t.relatedOrgWalletTransactionId,
        createdAt: t.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + paginatedTransactions.length < total,
      },
      wallet: {
        id: wallet._id.toString(),
        projectId: wallet.projectId.toString(),
        projectName: project.name,
        balance: wallet.balance,
      },
    });
  } catch (error: any) {
    console.error("Error fetching project wallet transactions:", error);
    return res.status(500).json({
      error: "Failed to fetch transactions",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * POST /api/admin/project-wallets/:projectId/stripe-checkout
 * Create Stripe checkout session for adding credits to project wallet
 * Funds will first go to org wallet, then automatically transfer to project wallet
 */
export async function createProjectStripeCheckout(req: Request, res: Response) {
  try {
    const { projectId } = req.params;
    const { amount, countryCode } = req.body;
    const adminUser = (req as any).user;

    if (!projectId || !isValidObjectId(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    // Get project first (needed for org admin check)
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Check permissions: Only org admin for this project's organization or system admin can add funds
    // Project admins are NOT allowed to add funds through payment providers
    if (adminUser?.id) {
      const hasOrgAccess = await isOrganizationAdmin(
        adminUser.id,
        project.organizationId.toString()
      );
      const isSystemAdmin = hasAdminAccess(adminUser.role);
      
      // Check if user is ONLY a project admin (not org admin or system admin)
      const isOnlyProjectAdmin = await isProjectAdmin(adminUser.id, projectId) && !hasOrgAccess && !isSystemAdmin;
      
      if (isOnlyProjectAdmin) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "Project admins cannot add funds to projects. Please contact your organization admin.",
        });
      }
      
      if (!hasOrgAccess && !isSystemAdmin) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You can only add credits to projects where you are an organization admin or system admin",
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

    // Get organization
    const organization = await Organization.findById(project.organizationId);
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const betterAuthUrl = await getBetterAuthUrl();

    // Build success and cancel URLs
    const successUrl = `${betterAuthUrl}/admin/projects/${projectId}/wallet?payment=success&session_id={CHECKOUT_SESSION_ID}&provider={PROVIDER}`;
    const cancelUrl = `${betterAuthUrl}/admin/projects/${projectId}/wallet?payment=cancelled`;

    console.log("💳 Creating payment checkout session for project wallet:", {
      projectId,
      projectName: project.name,
      organizationId: project.organizationId.toString(),
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
          organizationId: project.organizationId.toString(),
          projectId: projectId,
          creditAmount: creditAmount.toString(),
          originalAmount: creditAmount.toString(),
          type: "project_wallet",
        },
        successUrl,
        cancelUrl,
        description: `$${creditAmount.toFixed(2)} in credits for project wallet. Funds will first be added to organization wallet, then automatically transferred to project wallet.`,
        productName: `Project Wallet Credits - ${project.name}`,
      },
      project.organizationId.toString()
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
 * POST /api/admin/project-wallets/:projectId/stripe-verify
 * Verify Stripe payment and atomically:
 * 1. Add credits to org wallet
 * 2. Transfer from org wallet to project wallet
 */
export async function verifyProjectStripePayment(req: Request, res: Response) {
  try {
    const { projectId } = req.params;
    const { sessionId } = req.body;
    const adminUser = (req as any).user;

    if (!projectId || !isValidObjectId(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
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
    const metadataProjectId = metadata.projectId;
    const metadataOrgId = metadata.organizationId;
    const creditAmount = parseFloat(metadata.creditAmount || "0");
    const userId = metadata.userId;

    // Verify project ID matches
    if (metadataProjectId !== projectId) {
      return res.status(400).json({
        error: "Project ID mismatch",
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

    // Get project and organization
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const organization = await Organization.findById(metadataOrgId);
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // If user has project admin role, check if they are admin for this project
    // Or if they are org admin for the project's organization
    if (adminUser?.id) {
      const hasAccess = await isProjectAdmin(adminUser.id, projectId);
      const hasOrgAccess = await isOrganizationAdmin(
        adminUser.id,
        project.organizationId.toString()
      );
      if (!hasAccess && !hasOrgAccess && !hasAdminAccess(adminUser.role)) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You can only verify payments for projects where you are an admin",
        });
      }
    }

    // Check if this payment has already been processed
    const paymentIntentId =
      typeof checkoutSession.payment_intent === "string"
        ? checkoutSession.payment_intent
        : checkoutSession.payment_intent?.id || "";

    // Find or create org wallet
    let orgWallet = await OrgWallet.findOne({
      organizationId: metadataOrgId,
      type: "org_wallet",
    });

    if (!orgWallet) {
      orgWallet = new OrgWallet({
        organizationId: metadataOrgId,
        type: "org_wallet",
        balance: 0,
        transactions: [],
      });
    }

    // Check if payment already processed in org wallet
    const existingOrgTransaction = orgWallet.transactions.find(
      (tx: any) => tx.stripePaymentId === paymentIntentId
    );

    if (existingOrgTransaction) {
      // Payment already processed, check if transfer was done
      const projectWallet = await OrgProjectWallet.findOne({
        projectId: projectId,
      });

      if (projectWallet) {
        const existingProjectTransaction = projectWallet.transactions.find(
          (tx: any) =>
            tx.description?.includes(paymentIntentId) ||
            tx.description?.includes("Stripe payment")
        );

        if (existingProjectTransaction) {
          return res.json({
            success: true,
            message: "Payment already processed",
            wallet: {
              id: projectWallet._id.toString(),
              projectId: projectWallet.projectId.toString(),
              projectName: project.name,
              balance: projectWallet.balance,
            },
          });
        }
      }
    }

    // ATOMIC OPERATION: Add to org wallet, then transfer to project wallet
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Step 1: Add credits to org wallet
      const orgBalanceBefore = orgWallet.balance;
      const orgBalanceAfter = orgBalanceBefore + creditAmount;

      const orgTransaction = {
        type: "credit",
        amount: creditAmount,
        balanceBefore: orgBalanceBefore,
        balanceAfter: orgBalanceAfter,
        description: `Added ${creditAmount} credits via Stripe payment (for project ${project.name})`,
        performedBy: adminUserId || "system",
        stripePaymentId: paymentIntentId,
        fromAddress: null, // External payment, no from address
        toAddress: orgWallet._id.toString(), // To org wallet
        createdAt: new Date(),
      };

      orgWallet.balance = orgBalanceAfter;
      orgWallet.transactions.push(orgTransaction);
      await orgWallet.save({ session });

      // Step 2: Transfer from org wallet to project wallet
      // Find or create project wallet
      let projectWallet = await OrgProjectWallet.findOne({
        projectId: projectId,
      }).session(session);

      if (!projectWallet) {
        projectWallet = new OrgProjectWallet({
          projectId: projectId,
          balance: 0,
          transactions: [],
        });
      }

      const projectBalanceBefore = projectWallet.balance;
      const projectBalanceAfter = projectBalanceBefore + creditAmount;

      // Create debit transaction in org wallet
      const orgDebitTransaction = {
        type: "debit",
        amount: creditAmount,
        balanceBefore: orgBalanceAfter,
        balanceAfter: orgBalanceAfter - creditAmount,
        description: `Transferred ${creditAmount} credits to project ${project.name}`,
        performedBy: adminUserId || "system",
        relatedProjectId: projectId,
        fromAddress: orgWallet._id.toString(), // From org wallet
        toAddress: projectWallet._id.toString(), // To project wallet
        createdAt: new Date(),
      };

      // Create credit transaction in project wallet
      const projectTransaction = {
        type: "credit",
        amount: creditAmount,
        balanceBefore: projectBalanceBefore,
        balanceAfter: projectBalanceAfter,
        description: `Added ${creditAmount} credits via Stripe payment (transferred from org wallet)`,
        performedBy: adminUserId || "system",
        relatedOrgWalletTransactionId: orgTransaction.stripePaymentId,
        fromAddress: orgWallet._id.toString(), // From org wallet
        toAddress: projectWallet._id.toString(), // To project wallet
        createdAt: new Date(),
      };

      // Update org wallet (deduct the amount)
      orgWallet.balance = orgBalanceAfter - creditAmount;
      orgWallet.transactions.push(orgDebitTransaction);
      await orgWallet.save({ session });

      // Update project wallet (add the amount)
      projectWallet.balance = projectBalanceAfter;
      projectWallet.transactions.push(projectTransaction);
      await projectWallet.save({ session });

      // Commit transaction
      await session.commitTransaction();
      session.endSession();

      console.log(
        `✅ Atomically processed Stripe payment for project ${project.name}: Added ${creditAmount} to org wallet, then transferred to project wallet. Project balance: ${projectBalanceAfter}`
      );

      return res.json({
        success: true,
        message: `Successfully added ${creditAmount} credits to project wallet`,
        wallet: {
          id: projectWallet._id.toString(),
          projectId: projectWallet.projectId.toString(),
          projectName: project.name,
          balance: projectWallet.balance,
          transactionCount: projectWallet.transactions?.length || 0,
        },
        transaction: {
          type: projectTransaction.type,
          amount: projectTransaction.amount,
          balanceBefore: projectTransaction.balanceBefore,
          balanceAfter: projectTransaction.balanceAfter,
          description: projectTransaction.description,
          createdAt: projectTransaction.createdAt,
        },
      });
    } catch (error: any) {
      // Rollback transaction on error
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error: any) {
    console.error("Payment verification error:", error);
    return res.status(500).json({
      error: "Payment verification failed",
      message: error.message || "An error occurred",
    });
  }
}

/**
 * POST /api/admin/project-wallets/:projectId/credit-back-to-org
 * Credit back funds from project wallet to org wallet (ATOMIC)
 * Only credits back funds that were received from the org wallet
 */
export async function creditBackFromProjectToOrg(req: Request, res: Response) {
  try {
    const { projectId } = req.params;
    const { amount, description } = req.body;
    const adminUser = (req as any).user;

    if (!projectId || !isValidObjectId(projectId)) {
      return res.status(400).json({ error: "Invalid project ID" });
    }

    // Validate amount
    const creditBackAmount = parseFloat(amount);
    if (isNaN(creditBackAmount) || creditBackAmount <= 0) {
      return res.status(400).json({
        error: "Amount must be a positive number",
      });
    }

    // Get project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Check permissions - must be org admin or system admin
    if (adminUser?.id) {
      const hasOrgAccess = await isOrganizationAdmin(
        adminUser.id,
        project.organizationId.toString()
      );

      if (!hasOrgAccess && !hasAdminAccess(adminUser.role)) {
        return res.status(403).json({
          error: "Forbidden",
          message:
            "You must be an org admin or system admin to credit back funds to organization wallet",
        });
      }
    }

    const organization = await Organization.findById(project.organizationId);
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Start a MongoDB session for atomic transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Get project wallet
      const projectWallet = await OrgProjectWallet.findOne({
        projectId: projectId,
      }).session(session);

      if (!projectWallet) {
        await session.abortTransaction();
        return res.status(404).json({
          error: "Project wallet not found",
          message: "Please create a project wallet first",
        });
      }

      // Calculate credit-back limits
      const totalReceivedFromOrg = calculateTotalReceivedFromOrg(
        projectWallet.transactions
      );
      const totalCreditedBackToOrg = calculateTotalCreditedBack(
        projectWallet.transactions
      );
      const maxAllowedCreditBack = calculateMaxCreditBack(
        projectWallet.balance,
        totalReceivedFromOrg,
        totalCreditedBackToOrg
      );

      // Validate credit-back amount
      const validation = validateCreditBackAmount(
        creditBackAmount,
        maxAllowedCreditBack,
        projectWallet.balance,
        totalReceivedFromOrg,
        totalCreditedBackToOrg
      );

      if (!validation.valid) {
        await session.abortTransaction();
        return res.status(400).json({
          error: "Invalid credit-back amount",
          message: validation.error,
          ...validation.details,
        });
      }

      // Get org wallet
      let orgWallet = await OrgWallet.findOne({
        organizationId: project.organizationId,
        type: "org_wallet",
      }).session(session);

      if (!orgWallet) {
        await session.abortTransaction();
        return res.status(404).json({
          error: "Organization wallet not found",
        });
      }

      // Calculate balances
      const projectBalanceBefore = projectWallet.balance;
      const projectBalanceAfter = projectBalanceBefore - creditBackAmount;
      const orgBalanceBefore = orgWallet.balance;
      const orgBalanceAfter = orgBalanceBefore + creditBackAmount;

      // Create transactions
      const projectTransaction = createTransaction(
        "debit",
        creditBackAmount,
        projectBalanceBefore,
        projectBalanceAfter,
        description || `Credit back to organization: ${organization.name}`,
        adminUser?.id || adminUser?._id?.toString() || "system",
        {
          isCreditBack: true,
          fromAddress: projectWallet._id.toString(), // From project wallet
          toAddress: orgWallet._id.toString(), // To org wallet
        }
      );

      const orgTransaction = createTransaction(
        "credit",
        creditBackAmount,
        orgBalanceBefore,
        orgBalanceAfter,
        description || `Credit back from project: ${project.name}`,
        adminUser?.id || adminUser?._id?.toString() || "system",
        {
          isCreditBack: true,
          fromAddress: projectWallet._id.toString(), // From project wallet
          toAddress: orgWallet._id.toString(), // To org wallet
        }
      );

      // Update project wallet
      projectWallet.balance = projectBalanceAfter;
      projectWallet.transactions.push(projectTransaction);
      await projectWallet.save({ session });

      // Update org wallet
      orgWallet.balance = orgBalanceAfter;
      orgWallet.transactions.push(orgTransaction);
      await orgWallet.save({ session });

      // Link transactions for audit trail
      const orgTransactionId = getLastTransactionId(orgWallet);
      if (orgTransactionId) {
        const lastProjectTxIndex = projectWallet.transactions.length - 1;
        projectWallet.transactions[
          lastProjectTxIndex
        ].relatedOrgWalletTransactionId = orgTransactionId;
        await projectWallet.save({ session });
      }

      // Commit the transaction
      await session.commitTransaction();

      console.log(
        `✅ Credited back $${creditBackAmount} from project ${project.name} to org ${organization.name}. Project balance: $${projectBalanceAfter}, Org balance: $${orgBalanceAfter}`
      );

      return res.json({
        success: true,
        message: `Successfully credited back $${creditBackAmount} to organization wallet`,
        projectWallet: {
          id: projectWallet._id.toString(),
          projectId: projectWallet.projectId.toString(),
          balance: projectWallet.balance,
          transaction: {
            type: projectTransaction.type,
            amount: projectTransaction.amount,
            balanceBefore: projectTransaction.balanceBefore,
            balanceAfter: projectTransaction.balanceAfter,
            description: projectTransaction.description,
            isCreditBack: projectTransaction.isCreditBack,
            createdAt: projectTransaction.createdAt,
          },
        },
        orgWallet: {
          id: orgWallet._id.toString(),
          organizationId: orgWallet.organizationId.toString(),
          balance: orgWallet.balance,
          transaction: {
            type: orgTransaction.type,
            amount: orgTransaction.amount,
            balanceBefore: orgTransaction.balanceBefore,
            balanceAfter: orgTransaction.balanceAfter,
            description: orgTransaction.description,
            isCreditBack: orgTransaction.isCreditBack,
            createdAt: orgTransaction.createdAt,
          },
        },
      });
    } catch (error: any) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  } catch (error: any) {
    console.error("Error crediting back from project to org:", error);
    return res.status(500).json({
      error: "Failed to credit back funds",
      message: error.message || "An error occurred",
    });
  }
}
