import { PaymentSettings } from "@nowgai/shared/models";
import type { Request, Response } from "express";

/**
 * GET /api/admin/payment-settings
 * Get all payment settings (excluding DEFAULT)
 */
export async function getPaymentSettings(req: Request, res: Response) {
  try {
    const settings = await PaymentSettings.find({
      region: { $ne: "DEFAULT" },
    }).sort({ region: 1 });

    return res.json({
      success: true,
      settings: settings.map((s) => ({
        id: s._id.toString(),
        region: s.region,
        provider: s.provider,
        settings: s.settings,
        updatedAt: s.updatedAt,
        updatedBy: s.updatedBy,
      })),
    });
  } catch (error: any) {
    console.error("Error fetching payment settings:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch payment settings",
    });
  }
}

/**
 * GET /api/admin/payment-settings/default
 * Get default payment provider setting
 */
export async function getDefaultPaymentSettings(req: Request, res: Response) {
  try {
    const defaultSetting = await PaymentSettings.findOne({
      region: "DEFAULT",
    });

    if (!defaultSetting) {
      // Return default Stripe if not configured
      return res.json({
        success: true,
        defaultProvider: "stripe",
      });
    }

    return res.json({
      success: true,
      defaultProvider: defaultSetting.provider,
      updatedAt: defaultSetting.updatedAt,
      updatedBy: defaultSetting.updatedBy,
    });
  } catch (error: any) {
    console.error("Error fetching default payment settings:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch default payment settings",
    });
  }
}

/**
 * PUT /api/admin/payment-settings/default
 * Update default payment provider
 * Body: { provider: "stripe" | "razorpay" | "payu" }
 */
export async function updateDefaultPaymentSettings(
  req: Request,
  res: Response
) {
  try {
    const { provider } = req.body;

    if (!provider) {
      return res.status(400).json({
        success: false,
        error: "Provider is required",
      });
    }

    if (!["stripe", "razorpay", "payu"].includes(provider)) {
      return res.status(400).json({
        success: false,
        error: "Provider must be one of: stripe, razorpay, payu",
      });
    }

    // Get user ID from request (set by auth middleware)
    const userId = (req as any).user?.id || (req as any).user?._id?.toString();

    const defaultSetting = await PaymentSettings.findOneAndUpdate(
      { region: "DEFAULT" },
      {
        region: "DEFAULT",
        provider,
        updatedAt: new Date(),
        updatedBy: userId || null,
      },
      { upsert: true, new: true }
    );

    return res.json({
      success: true,
      defaultProvider: defaultSetting.provider,
      updatedAt: defaultSetting.updatedAt,
      updatedBy: defaultSetting.updatedBy,
    });
  } catch (error: any) {
    console.error("Error updating default payment settings:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to update default payment settings",
    });
  }
}

/**
 * POST /api/admin/payment-settings
 * Create or update payment settings for a region
 * Body: { region: string, provider: "stripe" | "razorpay" | "payu" }
 */
export async function updatePaymentSettings(req: Request, res: Response) {
  try {
    const { region, provider } = req.body;

    if (!region || !provider) {
      return res.status(400).json({
        success: false,
        error: "Region and provider are required",
      });
    }

    // Prevent using "DEFAULT" as a country code
    if (region.toUpperCase() === "DEFAULT") {
      return res.status(400).json({
        success: false,
        error:
          "Cannot use 'DEFAULT' as a region code. Use the default provider endpoint instead.",
      });
    }

    if (!["stripe", "razorpay", "payu"].includes(provider)) {
      return res.status(400).json({
        success: false,
        error: "Provider must be one of: stripe, razorpay, payu",
      });
    }

    // Get user ID from request (set by auth middleware)
    const userId = (req as any).user?.id || (req as any).user?._id?.toString();

    const setting = await PaymentSettings.findOneAndUpdate(
      { region: region.toUpperCase() },
      {
        region: region.toUpperCase(),
        provider,
        updatedAt: new Date(),
        updatedBy: userId || null,
      },
      { upsert: true, new: true }
    );

    return res.json({
      success: true,
      setting: {
        id: setting._id.toString(),
        region: setting.region,
        provider: setting.provider,
        settings: setting.settings,
        updatedAt: setting.updatedAt,
        updatedBy: setting.updatedBy,
      },
    });
  } catch (error: any) {
    console.error("Error updating payment settings:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to update payment settings",
    });
  }
}

/**
 * DELETE /api/admin/payment-settings/:region
 * Delete payment settings for a region
 */
export async function deletePaymentSettings(req: Request, res: Response) {
  try {
    const { region } = req.params;

    if (!region) {
      return res.status(400).json({
        success: false,
        error: "Region is required",
      });
    }

    const result = await PaymentSettings.findOneAndDelete({
      region: region.toUpperCase(),
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        error: "Payment setting not found",
      });
    }

    return res.json({
      success: true,
      message: "Payment setting deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting payment settings:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to delete payment settings",
    });
  }
}
