import type { LoaderFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { connectToDatabase } from "~/lib/mongo";
import { getFaqModel } from "~/models/faqModel";

// GET /api/faqs - list published FAQs for authenticated users
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const authInstance = await auth;
    const session = await authInstance.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectToDatabase();
    const Faq = getFaqModel();

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

    return new Response(JSON.stringify({ faqs: formatted }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching FAQs:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch FAQs" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
