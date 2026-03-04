import type { Route } from "./+types/api.auth.change-password.tsx";
import { auth } from "~/lib/auth";
import bcrypt from "bcrypt";

export async function action({ request }: Route.ActionArgs) {
  try {
    // Get the current session
    const authInstance = await auth;
    const session = await authInstance.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return new Response(
        JSON.stringify({
          error: "Current password and new password are required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (newPassword.length < 8) {
      return new Response(
        JSON.stringify({
          error: "New password must be at least 8 characters long",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Get the MongoDB client from auth
    const { getAuthMongoClient } = await import("~/lib/auth");
    const mongoClient = await getAuthMongoClient();
    const dbName = process.env.MONGODB_DB_NAME || "nowgai";
    const db = mongoClient.db(dbName);

    // Get the user from the database
    const usersCollection = db.collection("user");
    const user = await usersCollection.findOne({ _id: session.user.id });

    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check if user has a password (they might have signed up with OAuth)
    if (!user.password) {
      return new Response(
        JSON.stringify({
          error:
            "Cannot change password for OAuth accounts. Please use your OAuth provider to manage your password.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isPasswordValid) {
      return new Response(
        JSON.stringify({ error: "Current password is incorrect" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the password in the database
    await usersCollection.updateOne(
      { _id: session.user.id },
      { $set: { password: hashedPassword } },
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "Password changed successfully",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("Error changing password:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to change password" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
