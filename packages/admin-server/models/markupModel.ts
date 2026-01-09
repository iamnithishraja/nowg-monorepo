import mongoose from "mongoose";

const markupSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    required: true,
  },
  provider:{
    type: String,
    enum:["openrouter", "deployment", "managed_database"],
    required: true,
  },
  value:{
    type:Number,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("Markup", markupSchema);
