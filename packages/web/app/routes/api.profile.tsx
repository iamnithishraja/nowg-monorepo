import type { ActionFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { connectToDatabase } from "~/lib/mongo";

export async function action({ request }: ActionFunctionArgs) {
  console.log("[API Profile] Request received:", request.method);
  
  try {
    // Import Profile model dynamically (same as loader)
    const { Profile } = await import("@nowgai/shared/models");
    
    // Get authenticated user session
    const authInstance = await auth;
    const session = await authInstance.api.getSession({
      headers: request.headers,
    });

    console.log("[API Profile] Session:", session ? "authenticated" : "not authenticated");

    if (!session) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Only handle POST requests
    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const userId = session.user.id;
    console.log("[API Profile] User ID:", userId);

    await connectToDatabase();
    console.log("[API Profile] Database connected");

    // Parse request body
    const contentType = request.headers.get("content-type") || "";
    let data: any = {};

    if (contentType.includes("application/json")) {
      // Handle JSON body
      const text = await request.text();
      if (text && text.trim()) {
        data = JSON.parse(text);
      }
    } else {
      // Handle FormData
      const formData = await request.formData();
      data = {
        linkedin: formData.get("linkedin")?.toString() || "",
        instagram: formData.get("instagram")?.toString() || "",
        x: formData.get("x")?.toString() || "",
        discord: formData.get("discord")?.toString() || "",
        portfolio: formData.get("portfolio")?.toString() || "",
        bio: formData.get("bio")?.toString() || "",
        address: formData.get("address")?.toString() || "",
        customUrls: formData.getAll("customUrls")
          .map(url => url.toString())
          .filter((url) => url.trim()),
      };
    }

    // Update profile using findOneAndUpdate (more reliable)
    const updateData = {
      linkedin: data.linkedin || "",
      instagram: data.instagram || "",
      x: data.x || "",
      discord: data.discord || "",
      portfolio: data.portfolio || "",
      bio: data.bio || "",
      address: data.address || "",
      customUrls: Array.isArray(data.customUrls)
        ? data.customUrls.filter((url: string) => url.trim())
        : [],
      lastUpdated: new Date(),
    };

    console.log("[API Profile] Saving profile for user:", userId);
    console.log("[API Profile] Update data:", updateData);

    // Use lean() to get plain JS object and see raw MongoDB result
    const profile = await Profile.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { new: true, upsert: true, lean: true }
    );

    console.log("[API Profile] Raw saved profile:", JSON.stringify(profile, null, 2));

    // Return updated profile data from the update data since we know it was saved
    return new Response(
      JSON.stringify({
        success: true,
        profile: {
          linkedin: (profile as any)?.linkedin || updateData.linkedin,
          instagram: (profile as any)?.instagram || updateData.instagram,
          x: (profile as any)?.x || updateData.x,
          discord: (profile as any)?.discord || updateData.discord,
          portfolio: (profile as any)?.portfolio || updateData.portfolio,
          bio: (profile as any)?.bio || updateData.bio,
          address: (profile as any)?.address || updateData.address,
          customUrls: (profile as any)?.customUrls || updateData.customUrls,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Profile API error:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Failed to update profile",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
