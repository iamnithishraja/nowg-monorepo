import { Faq } from "@nowgai/shared/models";
import { hasAdminAccess } from "@nowgai/shared/types";
import type { Request, Response } from "express";

/**
 * GET /api/admin/faqs
 * List all FAQs (admin only)
 */
export async function getFaqs(req: Request, res: Response) {
  try {
    const adminUser = (req as any).user;

    if (!hasAdminAccess(adminUser?.role)) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Only admins can view FAQs",
      });
    }

    const faqs = await Faq.find({}).sort({ order: 1, createdAt: -1 }).lean();

    const formatted = faqs.map((f: any) => ({
      id: f._id.toString(),
      question: f.question,
      answer: f.answer,
      category: f.category,
      order: f.order,
      isPublished: f.isPublished,
      createdBy: f.createdBy,
      updatedBy: f.updatedBy,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    }));

    return res.json({ faqs: formatted });
  } catch (error: any) {
    console.error("Error fetching FAQs:", error);
    return res.status(500).json({
      error: "Failed to fetch FAQs",
      message: error.message,
    });
  }
}

/**
 * GET /api/admin/faqs/public
 * List published FAQs (accessible to authenticated users)
 */
export async function getPublicFaqs(req: Request, res: Response) {
  try {
    const faqs = await Faq.find({ isPublished: true })
      .sort({ order: 1, createdAt: -1 })
      .lean();

    const formatted = faqs.map((f: any) => ({
      id: f._id.toString(),
      question: f.question,
      answer: f.answer,
      category: f.category,
      order: f.order,
    }));

    return res.json({ faqs: formatted });
  } catch (error: any) {
    console.error("Error fetching public FAQs:", error);
    return res.status(500).json({
      error: "Failed to fetch FAQs",
      message: error.message,
    });
  }
}

/**
 * POST /api/admin/faqs
 * Create a new FAQ
 */
export async function createFaq(req: Request, res: Response) {
  try {
    const adminUser = (req as any).user;

    if (!hasAdminAccess(adminUser?.role)) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Only admins can create FAQs",
      });
    }

    const { question, answer, category, order, isPublished } = req.body;

    if (!question?.trim() || !answer?.trim()) {
      return res.status(400).json({
        error: "Question and answer are required",
      });
    }

    const faq = new Faq({
      question: question.trim(),
      answer: answer.trim(),
      category: category?.trim() || "General",
      order: order ?? 0,
      isPublished: isPublished !== false,
      createdBy: adminUser?.email || adminUser?.id || "admin",
      updatedBy: adminUser?.email || adminUser?.id || "admin",
    });

    await faq.save();

    return res.status(201).json({
      success: true,
      faq: {
        id: faq._id.toString(),
        question: faq.question,
        answer: faq.answer,
        category: faq.category,
        order: faq.order,
        isPublished: faq.isPublished,
        createdBy: faq.createdBy,
        updatedBy: faq.updatedBy,
        createdAt: faq.createdAt,
        updatedAt: faq.updatedAt,
      },
    });
  } catch (error: any) {
    console.error("Error creating FAQ:", error);
    return res.status(500).json({
      error: "Failed to create FAQ",
      message: error.message,
    });
  }
}

/**
 * PUT /api/admin/faqs/:faqId
 * Update a FAQ
 */
export async function updateFaq(req: Request, res: Response) {
  try {
    const adminUser = (req as any).user;

    if (!hasAdminAccess(adminUser?.role)) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Only admins can update FAQs",
      });
    }

    const { faqId } = req.params;
    const { question, answer, category, order, isPublished } = req.body;

    const faq = await Faq.findById(faqId);
    if (!faq) {
      return res.status(404).json({ error: "FAQ not found" });
    }

    if (question !== undefined) faq.question = question.trim();
    if (answer !== undefined) faq.answer = answer.trim();
    if (category !== undefined) faq.category = category.trim() || "General";
    if (order !== undefined) faq.order = order;
    if (isPublished !== undefined) faq.isPublished = isPublished;
    faq.updatedBy = adminUser?.email || adminUser?.id || "admin";
    faq.updatedAt = new Date();

    await faq.save();

    return res.json({
      success: true,
      faq: {
        id: faq._id.toString(),
        question: faq.question,
        answer: faq.answer,
        category: faq.category,
        order: faq.order,
        isPublished: faq.isPublished,
        createdBy: faq.createdBy,
        updatedBy: faq.updatedBy,
        createdAt: faq.createdAt,
        updatedAt: faq.updatedAt,
      },
    });
  } catch (error: any) {
    console.error("Error updating FAQ:", error);
    return res.status(500).json({
      error: "Failed to update FAQ",
      message: error.message,
    });
  }
}

/**
 * DELETE /api/admin/faqs/:faqId
 * Delete a FAQ
 */
export async function deleteFaq(req: Request, res: Response) {
  try {
    const adminUser = (req as any).user;

    if (!hasAdminAccess(adminUser?.role)) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Only admins can delete FAQs",
      });
    }

    const { faqId } = req.params;

    const faq = await Faq.findByIdAndDelete(faqId);
    if (!faq) {
      return res.status(404).json({ error: "FAQ not found" });
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting FAQ:", error);
    return res.status(500).json({
      error: "Failed to delete FAQ",
      message: error.message,
    });
  }
}
