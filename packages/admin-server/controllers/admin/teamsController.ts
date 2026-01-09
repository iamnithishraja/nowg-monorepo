import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { getUsersCollection } from "../../config/db";
import Team from "../../models/teamModel";
import OrganizationMember from "../../models/organizationMemberModel";
import { UserRole } from "../../types/roles";
import { getUserOrganizations } from "../../lib/organizationRoles";

export async function getTeams(req: Request, res: Response) {
  try {
    const user = (req as any).user;

    // Build query - if user has org admin role, filter by their organizations
    let query: any = {};
    if (user?.id) {
      const userOrgs = await getUserOrganizations(user.id, "org_admin");
      if (userOrgs.length > 0) {
        const orgIds = userOrgs.map((o) => o.organizationId);
        query.organizationId = { $in: orgIds };
      }
    }

    const teams = await Team.find(query).sort({ createdAt: -1 }).lean();

    // Get user emails for adminId (which is a String userId)
    const usersCollection = getUsersCollection();
    const adminIds = [...new Set(teams.map((t: any) => t.adminId))];

    const objectIds = adminIds
      .filter((id) => id)
      .map((id) => {
        try {
          return new ObjectId(id);
        } catch {
          return null;
        }
      })
      .filter((id) => id !== null) as ObjectId[];

    const users = await usersCollection
      .find({ _id: { $in: objectIds } })
      .toArray();

    const userMap = new Map();
    users.forEach((user: any) => {
      userMap.set(user._id.toString(), {
        email: user.email,
        name: user.name,
      });
    });

    // Add user info to teams
    const teamsWithUsers = teams.map((team: any) => {
      const userInfo = userMap.get(team.adminId) || {};
      return {
        ...team,
        adminInfo: userInfo,
      };
    });

    return res.json(teamsWithUsers);
  } catch (error: any) {
    console.error("Error fetching teams:", error);
    return res.status(500).json({ error: "Failed to fetch teams" });
  }
}
