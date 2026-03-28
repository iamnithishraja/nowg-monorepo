import mongoose from "mongoose";

export const faqSchemaDefinition = {
  question: {
    type: String,
    required: true,
  },
  answer: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    default: "General",
  },
  order: {
    type: Number,
    default: 0,
    index: true,
  },
  isPublished: {
    type: Boolean,
    default: true,
    index: true,
  },
  createdBy: {
    type: String,
    default: "",
  },
  updatedBy: {
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

export const faqSchema = new mongoose.Schema(faqSchemaDefinition);

faqSchema.pre("save", function () {
  this.updatedAt = new Date();
});

faqSchema.index({ isPublished: 1, order: 1 });
faqSchema.index({ category: 1, order: 1 });

export function getFaqModel(): mongoose.Model<any> {
  if (mongoose.models.Faq) {
    return mongoose.models.Faq as mongoose.Model<any>;
  }
  return mongoose.model("Faq", faqSchema);
}

const Faq = getFaqModel();

export default Faq;
