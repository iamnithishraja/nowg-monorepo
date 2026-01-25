import { Organization } from "@nowgai/shared/models";
import PaymentSettings from "../models/paymentSettingsModel";

export type PaymentProvider = "stripe" | "razorpay" | "payu";

/**
 * Get the default payment provider from settings
 * Falls back to "stripe" if not configured
 */
export async function getDefaultPaymentProvider(): Promise<PaymentProvider> {
  try {
    const defaultSetting = await PaymentSettings.findOne({
      region: "DEFAULT",
    });

    if (defaultSetting) {
      console.log(
        "✅ Found default payment provider:",
        defaultSetting.provider
      );
      return defaultSetting.provider as PaymentProvider;
    }

    console.log("⚠️ No default payment provider configured, using Stripe");
    return "stripe";
  } catch (error) {
    console.error("❌ Error getting default payment provider:", error);
    return "stripe";
  }
}

/**
 * Get payment provider for a given country code
 * Uses default provider if no country-specific setting found
 */
export async function getPaymentProviderForCountry(
  countryCode: string
): Promise<PaymentProvider> {
  try {
    const region = countryCode.toUpperCase();
    console.log("🔍 Looking up payment provider for region:", region);

    const setting = await PaymentSettings.findOne({
      region: region,
    });

    if (setting) {
      console.log("✅ Found payment setting:", {
        region: setting.region,
        provider: setting.provider,
      });
      return setting.provider as PaymentProvider;
    }

    // Use configured default provider
    const defaultProvider = await getDefaultPaymentProvider();
    console.log(
      "⚠️ No payment setting found for region:",
      region,
      "- using default provider:",
      defaultProvider
    );
    return defaultProvider;
  } catch (error) {
    console.error("❌ Error getting payment provider:", error);
    // Fallback to Stripe on error
    return "stripe";
  }
}

/**
 * Get payment provider for an organization
 * Priority: Organization-specific > Country-specific > Default
 */
export async function getPaymentProviderForOrganization(
  organizationId: string | null | undefined,
  countryCode: string | null
): Promise<PaymentProvider> {
  try {
    // First, check if organization has a specific payment provider set
    if (organizationId) {
      const organization = await Organization.findById(organizationId);
      if (organization?.paymentProvider) {
        console.log("✅ Found organization-specific payment provider:", {
          organizationId,
          provider: organization.paymentProvider,
        });
        return organization.paymentProvider as PaymentProvider;
      }
    }

    // Fall back to country-specific provider
    if (countryCode) {
      return await getPaymentProviderForCountry(countryCode);
    }

    // Finally, use default provider
    return await getDefaultPaymentProvider();
  } catch (error) {
    console.error("❌ Error getting payment provider for organization:", error);
    // Fallback to Stripe on error
    return "stripe";
  }
}

/**
 * Get all payment settings (excluding DEFAULT)
 */
export async function getAllPaymentSettings() {
  try {
    return await PaymentSettings.find({ region: { $ne: "DEFAULT" } }).sort({
      region: 1,
    });
  } catch (error) {
    console.error("Error getting payment settings:", error);
    return [];
  }
}
