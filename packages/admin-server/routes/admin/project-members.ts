import { Router } from "express";
import { requireAdmin } from "../../middleware/betterAuthMiddleware";
import {
  getProjectMembers,
  getAvailableOrgUsers,
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
  createProjectConversation,
  getProjectConversation,
} from "../../controllers/admin/projectMembersController";

const router = Router();

// All routes require admin authentication
router.use(requireAdmin);

// GET /api/admin/projects/:projectId/members - Get all members for a project
router.get("/projects/:projectId/members", getProjectMembers);

// GET /api/admin/organizations/:organizationId/available-users - Get available users from org
router.get(
  "/organizations/:organizationId/available-users",
  getAvailableOrgUsers
);

// POST /api/admin/projects/:projectId/members - Add a user to a project
router.post("/projects/:projectId/members", addProjectMember);

// PUT /api/admin/projects/:projectId/members/:memberId - Update member role
router.put("/projects/:projectId/members/:memberId", updateProjectMemberRole);

// DELETE /api/admin/projects/:projectId/members/:memberId - Remove a user from a project
router.delete("/projects/:projectId/members/:memberId", removeProjectMember);

// POST /api/admin/projects/:projectId/conversation - Create conversation for a project
router.post("/projects/:projectId/conversation", createProjectConversation);

// GET /api/admin/projects/:projectId/conversation - Get conversation for a project
router.get("/projects/:projectId/conversation", getProjectConversation);

export default router;
