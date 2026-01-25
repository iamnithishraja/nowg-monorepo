import { OrganizationMember, ProjectMember } from "@nowgai/shared/models";
import mongoose from "mongoose";
import type { LoaderFunctionArgs } from "react-router";
import { auth } from "~/lib/auth";
import { connectToDatabase } from "~/lib/mongo";
import Conversation from "../models/conversationModel";
import Organization from "../models/organizationModel";
import Project from "../models/projectModel";

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
    await connectToDatabase();

    // Get user's organization memberships (org_admin or org_user)
    const orgMemberships = await OrganizationMember.find({
      userId: userId,
      status: "active",
    }).lean();

    if (orgMemberships.length === 0) {
      return new Response(
        JSON.stringify({ conversations: [], organizations: [] }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const organizationIds = orgMemberships.map((m: any) =>
      m.organizationId instanceof mongoose.Types.ObjectId
        ? m.organizationId
        : new mongoose.Types.ObjectId(m.organizationId)
    );

    // Get all projects in user's organizations
    const projects = await Project.find({
      organizationId: { $in: organizationIds },
      status: "active",
    })
      .select("_id")
      .lean();

    const projectIds = projects.map((p: any) =>
      p._id instanceof mongoose.Types.ObjectId
        ? p._id
        : new mongoose.Types.ObjectId(p._id)
    );

    // Also get user's direct project memberships
    const projectMemberships = await ProjectMember.find({
      userId: userId,
      status: "active",
    }).lean();

    const userProjectIds = projectMemberships.map((m: any) =>
      m.projectId instanceof mongoose.Types.ObjectId
        ? m.projectId
        : new mongoose.Types.ObjectId(m.projectId)
    );

    // Combine both: projects in user's orgs + projects user is directly member of
    // Use Set with string representation for uniqueness, then convert back to ObjectIds
    const allProjectIdStrings = [
      ...new Set([
        ...projectIds.map((id: any) => id.toString()),
        ...userProjectIds.map((id: any) => id.toString()),
      ]),
    ];

    if (allProjectIdStrings.length === 0) {
      return new Response(
        JSON.stringify({ conversations: [], organizations: [] }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Convert projectIds to ObjectIds for query
    const projectObjectIds = allProjectIdStrings
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (projectObjectIds.length === 0) {
      return new Response(
        JSON.stringify({ conversations: [], organizations: [] }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Find conversations linked to projects user has access to
    // Conversations are linked via adminProjectId
    const conversations = await Conversation.find({
      adminProjectId: { $in: projectObjectIds },
    })
      .populate({
        path: "adminProjectId",
        select: "name organizationId",
        populate: {
          path: "organizationId",
          select: "name",
        },
      })
      .sort({ createdAt: -1 })
      .lean();

    // Format conversations with project and organization info
    const formattedConversations = conversations.map((conv: any) => {
      const project = conv.adminProjectId;
      const organization = project?.organizationId;

      return {
        id: conv._id.toString(),
        title: conv.title,
        model: conv.model,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        project: project
          ? {
              id: project._id.toString(),
              name: project.name,
            }
          : null,
        organization: organization
          ? {
              id: organization._id.toString(),
              name: organization.name,
            }
          : null,
      };
    });

    // Get unique organizations for filtering
    const orgIds = [
      ...new Set(organizationIds.map((id: any) => id.toString())),
    ];
    const organizations = await Organization.find({
      _id: { $in: orgIds },
    })
      .select("name _id")
      .lean();

    console.log(
      `Found ${formattedConversations.length} conversations for user ${userId}`
    );
    console.log(`User has ${orgMemberships.length} organization memberships`);
    console.log(`Found ${allProjectIdStrings.length} accessible projects`);

    return new Response(
      JSON.stringify({
        conversations: formattedConversations,
        organizations: organizations.map((org: any) => ({
          id: org._id.toString(),
          name: org.name,
        })),
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": "true",
        },
      }
    );
  } catch (error: any) {
    console.error("Error fetching organization conversations:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch conversations",
        message: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
