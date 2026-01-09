import { Router } from "express";
import { requireAdmin } from "../../middleware/betterAuthMiddleware";
import {
  getOrganizations,
  createOrganization,
  updateOrganization,
  assignOrgAdmin,
  updateUserRoleInOrg,
  deleteOrganization,
  acceptInvitation,
  rejectInvitation,
  searchUserByEmail,
  inviteUserToOrg,
  getOrgUsers,
  removeUserFromOrg,
  getOrganizationPaymentProvider,
  updateOrganizationPaymentProvider,
} from "../../controllers/admin/organizationsController";

const router = Router();

// All routes require admin authentication
router.use(requireAdmin);

// GET /api/admin/organizations - Get all organizations
router.get("/", getOrganizations);

// POST /api/admin/organizations - Create a new organization
router.post("/", createOrganization);

// PUT /api/admin/organizations/:id - Update an organization
router.put("/:id", updateOrganization);

// GET /api/admin/organizations/search-user - Search user by email
router.get("/search-user", searchUserByEmail);

// POST /api/admin/organizations/:id/assign-admin - Assign user as org admin
router.post("/:id/assign-admin", assignOrgAdmin);

// POST /api/admin/organizations/:id/update-user-role - Update user role
router.post("/:id/update-user-role", updateUserRoleInOrg);

// POST /api/admin/organizations/:id/invite-user - Invite user to organization
router.post("/:id/invite-user", inviteUserToOrg);

// GET /api/admin/organizations/:organizationId/users - Get all users in organization
router.get("/:organizationId/users", getOrgUsers);

// DELETE /api/admin/organizations/:id - Delete (suspend) an organization
router.delete("/:id", deleteOrganization);

// DELETE /api/admin/organizations/:organizationId/users/:userId - Remove user from organization
router.delete("/:organizationId/users/:userId", removeUserFromOrg);

// GET /api/admin/organizations/:organizationId/payment-provider - Get payment provider for organization
router.get(
  "/:organizationId/payment-provider",
  getOrganizationPaymentProvider
);

// PUT /api/admin/organizations/:organizationId/payment-provider - Update payment provider for organization
router.put(
  "/:organizationId/payment-provider",
  updateOrganizationPaymentProvider
);

export default router;
