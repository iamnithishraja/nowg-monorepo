import mongoose from "mongoose";

/**
 * Payment Settings Model
 * Stores payment provider configuration for different regions
 */
export const paymentSettingsSchemaDefinition = {
  // Region code (e.g., "IN" for India)
  region: {
    type: String,
    required: true,
    unique: true,
    index: true,
    uppercase: true,
  },
  // Payment provider: "stripe", "razorpay", or "payu"
  provider: {
    type: String,
    required: true,
    enum: ["stripe", "razorpay", "payu"],
    default: "stripe",
  },
  // Additional settings for the provider
  settings: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  updatedBy: {
    type: String, // User ID who updated this setting
    default: null,
  },
};

export const paymentSettingsSchema = new mongoose.Schema(paymentSettingsSchemaDefinition);

// Model getter function for consistent access
export function getPaymentSettingsModel(): mongoose.Model<any> {
  if (mongoose.models.PaymentSettings) {
    return mongoose.models.PaymentSettings as mongoose.Model<any>;
  }
  return mongoose.model("PaymentSettings", paymentSettingsSchema);
}

const PaymentSettings = getPaymentSettingsModel();

export default PaymentSettings;
