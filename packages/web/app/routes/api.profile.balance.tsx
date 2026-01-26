import { Profile } from "@nowgai/shared/models";
import type { LoaderFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { connectToDatabase } from "~/lib/mongo";
import { isWhitelistedEmail } from "~/lib/stripe";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Get authenticated user session
    const authInstance = await auth;
    const session = await authInstance.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const userId = session.user.id;
    const userEmail = session.user.email;

    await connectToDatabase();

    // Get or create profile
    let profile = await Profile.findOne({ userId });
    if (!profile) {
      profile = new Profile({ userId });
      await profile.save();
    }

    // Check if user is whitelisted
    const isWhitelisted = isWhitelistedEmail(userEmail);

    // Update whitelist status in profile if needed
    if (isWhitelisted !== profile.isWhitelisted) {
      profile.isWhitelisted = isWhitelisted;
      await profile.save();
    }

    // Get recent transactions (last 50)
    const recentTransactions = profile.transactions
      .sort(
        (a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 50);

    return new Response(
      JSON.stringify({
        success: true,
        balance: profile.balance || 0,
        isWhitelisted,
        transactions: recentTransactions,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Balance API error:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "Failed to fetch balance",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
