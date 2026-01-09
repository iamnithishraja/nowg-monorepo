import type { LoaderFunctionArgs } from "react-router";
import { Transaction, User } from "~/models/adminModel";
import Profile from "~/models/profileModel";
import { auth } from "~/lib/auth";

async function requireAdmin(request: Request) {
  const authInstance = await auth;
  const session = await authInstance.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const user = await User.findOne({ email: session.user.email });
  if (!user || user.role !== "admin") {
    throw new Response("Forbidden - Admin access required", { status: 403 });
  }

  return user;
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    await requireAdmin(request);

    // Get all users with their profiles
    const users = await User.find({}).select("email firstName lastName");
    const profiles = await Profile.find({});

    // Create a map of userId to user info
    const userMap = new Map();
    users.forEach((user) => {
      userMap.set(user._id.toString(), {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      });
    });

    // Collect only Stripe recharge transactions
    const rechargeTransactions: any[] = [];

    profiles.forEach((profile) => {
      const userInfo = userMap.get(profile.userId) || {};
      const userBalance = profile.balance || 0;

      // Only include recharge transactions with Stripe payment ID
      profile.transactions.forEach((txn: any) => {
        if (txn.type === "recharge" && txn.stripePaymentId) {
          rechargeTransactions.push({
            id: txn._id.toString(),
            userId: profile.userId,
            userEmail: userInfo.email || "Unknown",
            userName:
              `${userInfo.firstName || ""} ${userInfo.lastName || ""}`.trim() ||
              "Unknown",
            type: "token_purchase",
            amount: txn.amount.toFixed(2),
            currency: "USD",
            status: "completed",
            gatewayId: null,
            gatewayTransactionId: txn.stripePaymentId,
            description: txn.description || "Stripe recharge",
            metadata: {
              currentBalance: userBalance,
              balanceAfter: txn.balanceAfter,
            },
            createdAt: txn.createdAt,
          });
        }
      });
    });

    // Sort by date (newest first)
    rechargeTransactions.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Limit to 100 most recent
    const limitedTransactions = rechargeTransactions.slice(0, 100);

    return new Response(JSON.stringify(limitedTransactions), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Error fetching transactions:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch transactions" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
