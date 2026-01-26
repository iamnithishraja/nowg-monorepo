import { ProjectWallet, Team, TeamMember } from "@nowgai/shared/models";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { connectToDatabase } from "~/lib/mongo";

// Helper to get authenticated user
async function getAuthenticatedUser(request: Request) {
  const authInstance = await auth;
  const session = await authInstance.api.getSession({
    headers: request.headers,
  });

  if (!session?.user?.id) {
    throw new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return session.user;
}

// GET: Get team wallet balance and transactions
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await getAuthenticatedUser(request);
    await connectToDatabase();

    const url = new URL(request.url);
    const teamId = url.searchParams.get("teamId");

    if (!teamId) {
      return new Response(JSON.stringify({ error: "Team ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check if user is member of team
    const membership = await TeamMember.findOne({
      teamId,
      userId: user.id,
      status: "active",
    });

    if (!membership) {
      return new Response(
        JSON.stringify({ error: "Not a member of this team" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const team = await Team.findById(teamId);
    if (!team) {
      return new Response(JSON.stringify({ error: "Team not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get recent transactions (last 50)
    const recentTransactions = team.transactions
      .sort(
        (a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 50);

    return new Response(
      JSON.stringify({
        success: true,
        balance: team.balance || 0,
        transactions: recentTransactions,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Team wallet error:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "Failed to fetch wallet",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// POST: Transfer funds to project wallet
export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await getAuthenticatedUser(request);
    await connectToDatabase();

    const body = await request.json();
    const { teamId, conversationId, amount } = body;

    if (!teamId || !conversationId || !amount) {
      return new Response(
        JSON.stringify({
          error: "Team ID, conversation ID, and amount are required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Amount must be greater than 0" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check if user is member of team
    const membership = await TeamMember.findOne({
      teamId,
      userId: user.id,
      status: "active",
    });

    if (!membership) {
      return new Response(
        JSON.stringify({ error: "Not a member of this team" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const team = await Team.findById(teamId);
    if (!team) {
      return new Response(JSON.stringify({ error: "Team not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check balance
    if (team.balance < amount) {
      return new Response(
        JSON.stringify({ error: "Insufficient team balance" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Get or create project wallet
    let projectWallet = await ProjectWallet.findOne({ conversationId });
    if (!projectWallet) {
      projectWallet = new ProjectWallet({
        conversationId,
        teamId,
        balance: 0,
      });
    }

    // Transfer funds
    const balanceBefore = team.balance;
    team.balance -= amount;
    const balanceAfter = team.balance;

    const projectBalanceBefore = projectWallet.balance;
    projectWallet.balance += amount;
    const projectBalanceAfter = projectWallet.balance;

    // Record transaction in team wallet
    team.transactions.push({
      type: "transfer_to_project",
      amount: -amount,
      balanceBefore,
      balanceAfter,
      description: `Transfer to project ${conversationId}`,
      conversationId,
      userId: user.id,
      createdAt: new Date(),
    });

    // Record transaction in project wallet
    projectWallet.transactions.push({
      type: "transfer_from_team",
      amount,
      balanceBefore: projectBalanceBefore,
      balanceAfter: projectBalanceAfter,
      description: `Transfer from team wallet`,
      conversationId,
      userId: user.id,
      createdAt: new Date(),
    });

    await team.save();
    await projectWallet.save();

    return new Response(
      JSON.stringify({
        success: true,
        teamBalance: team.balance,
        projectBalance: projectWallet.balance,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    if (error instanceof Response) throw error;
    console.error("Team wallet transfer error:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "Failed to transfer funds",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
