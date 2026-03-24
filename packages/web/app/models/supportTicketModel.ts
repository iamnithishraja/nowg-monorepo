import mongoose from "mongoose";

export const supportTicketSchemaDefinition = {
  userId: {
    type: String,
    required: true,
    index: true,
  },
  userEmail: {
    type: String,
    required: true,
  },
  userName: {
    type: String,
    default: "",
  },
  subject: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  // Optional contact details
  phone: {
    type: String,
    default: "",
  },
  countryCode: {
    type: String,
    default: "",
  },
  company: {
    type: String,
    default: "",
  },
  status: {
    type: String,
    enum: ["open", "resolved"],
    default: "open",
    index: true,
  },
  resolvedAt: {
    type: Date,
    default: null,
  },
  resolvedBy: {
    type: String,
    default: null,
  },
  adminNotes: {
    type: String,
    default: "",
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
};

export const supportTicketSchema = new mongoose.Schema(
  supportTicketSchemaDefinition
);

// Compound indexes
supportTicketSchema.index({ userId: 1, createdAt: -1 });
supportTicketSchema.index({ status: 1, createdAt: -1 });

export function getSupportTicketModel(): mongoose.Model<any> {
  if (mongoose.models.SupportTicket) {
    return mongoose.models.SupportTicket as mongoose.Model<any>;
  }
  return mongoose.model("SupportTicket", supportTicketSchema);
}

const SupportTicket = getSupportTicketModel();

export default SupportTicket;
