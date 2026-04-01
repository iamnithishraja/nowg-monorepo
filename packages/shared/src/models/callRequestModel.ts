import mongoose from "mongoose";

export const callRequestSchemaDefinition = {
  requestId: {
    type: String,
    unique: true,
    sparse: true,
  },
  ticketId: {
    type: String,
    required: true,
    index: true,
  },
  userId: {
    type: String,
    required: true,
    index: true,
  },
  userEmail: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    default: "",
  },
  countryCode: {
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

export const callRequestSchema = new mongoose.Schema(callRequestSchemaDefinition);

callRequestSchema.pre("save", function () {
  this.updatedAt = new Date();
});

callRequestSchema.index({ userId: 1, createdAt: -1 });
callRequestSchema.index({ status: 1, createdAt: -1 });

export function getCallRequestModel(): mongoose.Model<any> {
  if (mongoose.models.CallRequest) {
    return mongoose.models.CallRequest as mongoose.Model<any>;
  }
  return mongoose.model("CallRequest", callRequestSchema);
}

const CallRequest = getCallRequestModel();

export default CallRequest;
