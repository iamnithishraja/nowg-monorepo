import { Conversation, OrgProjectWallet, Profile, Project, Team } from "@nowgai/shared/models";
import mongoose from "mongoose";
import NeonUsageBilling from "../models/neonUsageBillingModel.js";
import { getEnvWithDefault } from "../lib/env.js";
import { connectToDatabase } from "../lib/mongo.js";

/**
 * Neon Billing Pricing Constants
 * Based on Neon Scale plan pricing
 */
export const NEON_PRICING = {
  // $0.222 per CU-hour (Compute Unit hour)
  COMPUTE_PER_CU_HOUR: 0.222,
  // $0.35 per GB-month for storage
  STORAGE_PER_GB_MONTH: 0.35,
  // Storage hourly price = 0.35 / (30*24) ≈ $0.000486 per GB-hour
  STORAGE_PER_GB_HOUR: 0.35 / (30 * 24),
  // Minimum billing threshold
  MIN_BILLING_THRESHOLD: 0.001,
  // Maximum hours to fetch (Neon API limitation)
  MAX_HOURS_LOOKBACK: 168,
};

/**
 * Interface for Neon consumption data
 */
interface NeonConsumptionPeriod {
  period_id: string;
  period_start: string;
  period_end: string;
  compute_time_seconds: number;
  data_storage_bytes_hour: number;
  synthetic_storage_size_bytes: number;
  written_data_bytes: number;
  data_transfer_bytes: number;
}

interface NeonConsumptionProject {
  project_id: string;
  periods: NeonConsumptionPeriod[];
}

interface NeonConsumptionResponse {
  projects: NeonConsumptionProject[];
}

/**
 * Interface for billing result
 */
export interface BillingResult {
  success: boolean;
  conversationId: string;
  neonProjectId: string;
  periodsProcessed: number;
  totalComputeCost: number;
  totalStorageCost: number;
  totalCost: number;
  amountBilled: number;
  carryForwardCost: number;
  walletDeducted: boolean;
  walletType?: "org_project" | "team" | "personal";
  error?: string;
}

/**
 * Get the start of the current hour in UTC
 */
export function getCurrentHourUTC(): Date {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  return now;
}

/**
 * Calculate compute cost from compute time seconds
 */
export function calculateComputeCost(computeTimeSeconds: number): number {
  const computeCuHours = computeTimeSeconds / 3600;
  return computeCuHours * NEON_PRICING.COMPUTE_PER_CU_HOUR;
}

/**
 * Calculate storage cost from logical size bytes hour
 */
export function calculateStorageCost(logicalSizeBytesHour: number): number {
  const storageGbHours = logicalSizeBytesHour / Math.pow(1024, 3);
  return storageGbHours * NEON_PRICING.STORAGE_PER_GB_HOUR;
}

/**
 * Fetch consumption history from Neon API
 */
export async function fetchNeonConsumption(
  neonApiKey: string,
  projectIds: string[],
  from: Date,
  to: Date
): Promise<NeonConsumptionResponse | null> {
  const neonApiUrl = getEnvWithDefault(
    "NEON_API_URL",
    "https://console.neon.tech/api/v2"
  );

  try {
    const fromISO = from.toISOString();
    const toISO = to.toISOString();
    const projectIdsParam = projectIds.join(",");

    const url = `${neonApiUrl}/consumption_history/projects?project_ids=${encodeURIComponent(
      projectIdsParam
    )}&from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(
      toISO
    )}&granularity=hourly`;

    console.log(`[NeonBilling] Fetching consumption from: ${url}`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${neonApiKey}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[NeonBilling] API error: ${response.status} - ${errorText}`
      );
      return null;
    }

    const data = await response.json();
    return data as NeonConsumptionResponse;
  } catch (error) {
    console.error("[NeonBilling] Error fetching consumption:", error);
    return null;
  }
}

/**
 * Process billing for a single conversation/project
 */
export async function processBillingForConversation(
  conversationId: string,
  neonApiKey: string
): Promise<BillingResult> {
  await connectToDatabase();

  const result: BillingResult = {
    success: false,
    conversationId,
    neonProjectId: "",
    periodsProcessed: 0,
    totalComputeCost: 0,
    totalStorageCost: 0,
    totalCost: 0,
    amountBilled: 0,
    carryForwardCost: 0,
    walletDeducted: false,
  };

  try {
    // Get conversation with neon config
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      result.error = "Conversation not found";
      return result;
    }

    if (!conversation.neon?.enabled || !conversation.neon?.projectId) {
      result.error = "Neon not enabled for this conversation";
      return result;
    }

    result.neonProjectId = conversation.neon.projectId;

    // Get or create billing record
    let billingRecord = await NeonUsageBilling.findOne({
      conversationId: conversationId,
      neonProjectId: conversation.neon.projectId,
    });

    if (!billingRecord) {
      // Create new billing record
      billingRecord = new NeonUsageBilling({
        conversationId: conversationId,
        neonProjectId: conversation.neon.projectId,
        adminProjectId: conversation.adminProjectId || null,
        userId: conversation.userId,
        teamId: conversation.teamId || null,
        status: "active",
      });

      // Get organization ID if this is a project conversation
      if (conversation.adminProjectId) {
        const project = await Project.findById(conversation.adminProjectId);
        if (project) {
          billingRecord.organizationId = project.organizationId;
        }
      }

      await billingRecord.save();
    }

    // Check if billing is active
    if (billingRecord.status !== "active") {
      result.error = `Billing status is ${billingRecord.status}`;
      return result;
    }

    // Determine time range for fetching
    const currentHour = getCurrentHourUTC();
    let fromTime: Date;

    if (billingRecord.lastBilledAt) {
      fromTime = new Date(billingRecord.lastBilledAt);
    } else if (conversation.neon.createdAt) {
      fromTime = new Date(conversation.neon.createdAt);
    } else {
      // Default to 24 hours ago if no reference
      fromTime = new Date(currentHour.getTime() - 24 * 60 * 60 * 1000);
    }

    // Ensure we don't go beyond max lookback
    const maxLookback = new Date(
      currentHour.getTime() - NEON_PRICING.MAX_HOURS_LOOKBACK * 60 * 60 * 1000
    );
    if (fromTime < maxLookback) {
      fromTime = maxLookback;
    }

    // Fetch consumption from Neon API
    const consumption = await fetchNeonConsumption(
      neonApiKey,
      [conversation.neon.projectId],
      fromTime,
      currentHour
    );

    if (!consumption || !consumption.projects?.length) {
      console.log(
        `[NeonBilling] No consumption data for project ${conversation.neon.projectId}`
      );
      result.success = true;
      result.carryForwardCost = billingRecord.carryForwardCost || 0;
      return result;
    }

    const projectData = consumption.projects.find(
      (p) => p.project_id === conversation.neon.projectId
    );
    if (!projectData || !projectData.periods?.length) {
      console.log(
        `[NeonBilling] No periods for project ${conversation.neon.projectId}`
      );
      result.success = true;
      result.carryForwardCost = billingRecord.carryForwardCost || 0;
      return result;
    }

    // Process each period
    let totalCost = billingRecord.carryForwardCost || 0;
    const newUsageRecords: any[] = [];

    for (const period of projectData.periods) {
      // Check if we already processed this period
      const periodStart = new Date(period.period_start);
      const alreadyProcessed = billingRecord.usageRecords.some(
        (r: any) => new Date(r.periodStart).getTime() === periodStart.getTime()
      );

      if (alreadyProcessed) {
        continue;
      }

      // Calculate costs for this period
      const computeCost = calculateComputeCost(period.compute_time_seconds);
      const storageCost = calculateStorageCost(period.data_storage_bytes_hour);
      const periodTotalCost = computeCost + storageCost;

      result.totalComputeCost += computeCost;
      result.totalStorageCost += storageCost;
      totalCost += periodTotalCost;
      result.periodsProcessed++;

      // Create usage record
      newUsageRecords.push({
        periodStart: new Date(period.period_start),
        periodEnd: new Date(period.period_end),
        computeTimeSeconds: period.compute_time_seconds,
        logicalSizeBytesHour: period.data_storage_bytes_hour,
        computeCost,
        storageCost,
        totalCost: periodTotalCost,
        billed: false,
      });
    }

    result.totalCost = totalCost;

    // Check if we should bill
    let amountToBill = 0;
    let shouldBill = false;

    if (totalCost >= NEON_PRICING.MIN_BILLING_THRESHOLD) {
      shouldBill = true;
      amountToBill = totalCost;
    }

    // Deduct from appropriate wallet
    if (shouldBill && amountToBill > 0) {
      let walletDeducted = false;
      let walletTransactionId: string | null = null;

      // Determine wallet type and deduct
      if (conversation.adminProjectId) {
        // Organization project - deduct from OrgProjectWallet
        result.walletType = "org_project";
        const deductResult = await deductFromOrgProjectWallet(
          conversation.adminProjectId,
          amountToBill,
          conversation.neon.projectId,
          conversationId
        );
        walletDeducted = deductResult.success;
        walletTransactionId = deductResult.transactionId || null;
        if (!walletDeducted) {
          result.error = deductResult.error;
        }
      } else if (conversation.teamId && conversation.projectType === "team") {
        // Team project - deduct from team wallet
        result.walletType = "team";
        const deductResult = await deductFromTeamWallet(
          conversation.teamId.toString(),
          amountToBill,
          conversation.neon.projectId,
          conversationId
        );
        walletDeducted = deductResult.success;
        walletTransactionId = deductResult.transactionId || null;
        if (!walletDeducted) {
          result.error = deductResult.error;
        }
      } else {
        // Personal project - deduct from profile
        result.walletType = "personal";
        const deductResult = await deductFromProfileWallet(
          conversation.userId,
          amountToBill,
          conversation.neon.projectId,
          conversationId
        );
        walletDeducted = deductResult.success;
        walletTransactionId = deductResult.transactionId || null;
        if (!walletDeducted) {
          result.error = deductResult.error;
        }
      }

      result.walletDeducted = walletDeducted;

      if (walletDeducted) {
        result.amountBilled = amountToBill;
        result.carryForwardCost = 0;

        // Mark usage records as billed
        for (const record of newUsageRecords) {
          record.billed = true;
          record.billedAt = new Date();
          record.walletTransactionId = walletTransactionId;
        }

        // Update billing record
        billingRecord.carryForwardCost = 0;
        billingRecord.totalBilledAmount =
          (billingRecord.totalBilledAmount || 0) + amountToBill;
        billingRecord.lastBilledAt = currentHour;
      } else {
        // Billing failed - keep as carry forward
        result.carryForwardCost = totalCost;
        billingRecord.carryForwardCost = totalCost;
        billingRecord.status = "error";
        billingRecord.lastError = result.error || "Wallet deduction failed";
        billingRecord.lastErrorAt = new Date();
      }
    } else {
      // Below threshold - carry forward
      result.carryForwardCost = totalCost;
      billingRecord.carryForwardCost = totalCost;
    }

    // Add usage records to billing record
    if (newUsageRecords.length > 0) {
      billingRecord.usageRecords.push(...newUsageRecords);
      billingRecord.totalUsageRecords =
        (billingRecord.totalUsageRecords || 0) + newUsageRecords.length;
    }

    billingRecord.lastBilledAt = currentHour;
    await billingRecord.save();

    result.success = true;
    return result;
  } catch (error) {
    console.error(`[NeonBilling] Error processing billing:`, error);
    result.error = error instanceof Error ? error.message : String(error);
    return result;
  }
}

/**
 * Deduct from OrgProjectWallet
 */
async function deductFromOrgProjectWallet(
  adminProjectId: string,
  amount: number,
  neonProjectId: string,
  conversationId: string
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  try {
    const projectId =
      adminProjectId instanceof mongoose.Types.ObjectId
        ? adminProjectId
        : new mongoose.Types.ObjectId(adminProjectId);

    const wallet = await OrgProjectWallet.findOne({ projectId });
    if (!wallet) {
      return { success: false, error: "Project wallet not found" };
    }

    if ((wallet.balance || 0) < amount) {
      return { success: false, error: "Insufficient wallet balance" };
    }

    const balanceBefore = wallet.balance || 0;
    const balanceAfter = balanceBefore - amount;
    wallet.balance = balanceAfter;

    wallet.transactions.push({
      type: "debit",
      amount,
      balanceBefore,
      balanceAfter,
      description: `Neon DB usage - Project: ${neonProjectId} - $${amount.toFixed(
        6
      )}`,
      performedBy: "system",
      conversationId,
      createdAt: new Date(),
    });

    await wallet.save();

    const transactionId =
      wallet.transactions[wallet.transactions.length - 1]._id?.toString();
    return { success: true, transactionId };
  } catch (error) {
    console.error(
      "[NeonBilling] Error deducting from org project wallet:",
      error
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Deduct from Team wallet
 */
async function deductFromTeamWallet(
  teamId: string,
  amount: number,
  neonProjectId: string,
  conversationId: string
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  try {
    const team = await Team.findById(teamId);
    if (!team) {
      return { success: false, error: "Team not found" };
    }

    if ((team.balance || 0) < amount) {
      return { success: false, error: "Insufficient team wallet balance" };
    }

    const balanceBefore = team.balance || 0;
    const balanceAfter = balanceBefore - amount;
    team.balance = balanceAfter;

    team.transactions.push({
      type: "deduction",
      amount,
      balanceBefore,
      balanceAfter,
      description: `Neon DB usage - Project: ${neonProjectId} - $${amount.toFixed(
        6
      )}`,
      conversationId,
      createdAt: new Date(),
    });

    await team.save();

    const transactionId =
      team.transactions[team.transactions.length - 1]._id?.toString();
    return { success: true, transactionId };
  } catch (error) {
    console.error("[NeonBilling] Error deducting from team wallet:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Deduct from Profile (personal wallet)
 */
async function deductFromProfileWallet(
  userId: string,
  amount: number,
  neonProjectId: string,
  conversationId: string
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  try {
    const profile = await Profile.findOne({ userId });
    if (!profile) {
      return { success: false, error: "Profile not found" };
    }

    if ((profile.balance || 0) < amount) {
      return { success: false, error: "Insufficient profile balance" };
    }

    const balanceBefore = profile.balance || 0;
    const balanceAfter = balanceBefore - amount;
    profile.balance = balanceAfter;

    profile.transactions.push({
      type: "deduction",
      amount,
      balanceBefore,
      balanceAfter,
      description: `Neon DB usage - Project: ${neonProjectId} - $${amount.toFixed(
        6
      )}`,
      conversationId,
      createdAt: new Date(),
    });

    await profile.save();

    const transactionId =
      profile.transactions[profile.transactions.length - 1]._id?.toString();
    return { success: true, transactionId };
  } catch (error) {
    console.error("[NeonBilling] Error deducting from profile wallet:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Run hourly billing job for all active Neon projects
 */
export async function runHourlyBillingJob(): Promise<{
  success: boolean;
  processedCount: number;
  billedCount: number;
  totalBilledAmount: number;
  errors: string[];
  results: BillingResult[];
}> {
  await connectToDatabase();

  const jobResult = {
    success: true,
    processedCount: 0,
    billedCount: 0,
    totalBilledAmount: 0,
    errors: [] as string[],
    results: [] as BillingResult[],
  };

  try {
    // Get Neon API key from env
    const neonApiKey = getEnvWithDefault("NEON_API_KEY", "");
    if (!neonApiKey) {
      jobResult.success = false;
      jobResult.errors.push("NEON_API_KEY not configured");
      return jobResult;
    }

    // Find all conversations with active Neon projects
    const conversations = await Conversation.find({
      "neon.enabled": true,
      "neon.projectId": { $exists: true, $ne: null },
    }).select("_id neon.projectId");

    console.log(
      `[NeonBilling] Found ${conversations.length} conversations with active Neon projects`
    );

    // Process each conversation
    for (const conversation of conversations) {
      try {
        const result = await processBillingForConversation(
          conversation._id.toString(),
          neonApiKey
        );

        jobResult.results.push(result);
        jobResult.processedCount++;

        if (result.walletDeducted) {
          jobResult.billedCount++;
          jobResult.totalBilledAmount += result.amountBilled;
        }

        if (!result.success && result.error) {
          jobResult.errors.push(`${conversation._id}: ${result.error}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        jobResult.errors.push(`${conversation._id}: ${errorMsg}`);
      }
    }

    console.log(
      `[NeonBilling] Job complete: processed=${
        jobResult.processedCount
      }, billed=${
        jobResult.billedCount
      }, totalAmount=$${jobResult.totalBilledAmount.toFixed(4)}`
    );

    return jobResult;
  } catch (error) {
    console.error("[NeonBilling] Error running hourly job:", error);
    jobResult.success = false;
    jobResult.errors.push(
      error instanceof Error ? error.message : String(error)
    );
    return jobResult;
  }
}
