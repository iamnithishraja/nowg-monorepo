import mongoose from "mongoose";

/**
 * Payment Settings Model
 * Stores payment provider configuration for different regions
 */
const paymentSettingsSchema = new mongoose.Schema({
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
});

const PaymentSettings = mongoose.model(
  "PaymentSettings",
  paymentSettingsSchema
);
export default PaymentSettings;
