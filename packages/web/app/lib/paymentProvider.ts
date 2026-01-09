import { connectToDatabase } from "~/lib/mongo";
import PaymentSettings from "~/models/paymentSettingsModel";
import Organization from "~/models/organizationModel";

export type PaymentProvider = "stripe" | "razorpay" | "payu";

/**
 * Get the default payment provider from settings
 * Falls back to "stripe" if not configured
 */
export async function getDefaultPaymentProvider(): Promise<PaymentProvider> {
  try {
    await connectToDatabase();
    const defaultSetting = await PaymentSettings.findOne({
      region: "DEFAULT",
    });

    if (defaultSetting) {
      return defaultSetting.provider as PaymentProvider;
    }

    return "stripe";
  } catch (error) {
    console.error("Error getting default payment provider:", error);
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
    await connectToDatabase();
    const setting = await PaymentSettings.findOne({
      region: countryCode.toUpperCase(),
    });

    if (setting) {
      return setting.provider as PaymentProvider;
    }

    // Use configured default provider
    return await getDefaultPaymentProvider();
  } catch (error) {
    console.error("Error getting payment provider:", error);
    // Default to Stripe on error
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
    await connectToDatabase();

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
    console.error("Error getting payment provider for organization:", error);
    // Fallback to Stripe on error
    return "stripe";
  }
}

/**
 * Get all payment settings (excluding DEFAULT)
 */
export async function getAllPaymentSettings() {
  try {
    await connectToDatabase();
    return await PaymentSettings.find({ region: { $ne: "DEFAULT" } }).sort({
      region: 1,
    });
  } catch (error) {
    console.error("Error getting payment settings:", error);
    return [];
  }
}
