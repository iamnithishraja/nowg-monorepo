import { Router } from "express";
import { getOrgDocuments } from "../../controllers/admin/orgDocumentSubmissionsController";
import {
  approveEnterpriseRequest,
  assignOrgAdmin,
  createOrganization,
  deleteOrganization,
  getOrganizationPaymentProvider,
  getOrganizations,
  getOrgUsers,
  getPendingEnterpriseRequests,
  inviteUserToOrg,
  rejectEnterpriseRequest,
  removeUserFromOrg,
  searchUserByEmail,
  updateOrganization,
  updateOrganizationPaymentProvider,
  updateUserRoleInOrg
} from "../../controllers/admin/organizationsController";
import { requireAdmin } from "../../middleware/betterAuthMiddleware";

const router = Router();

// GET /api/admin/organizations/:orgId/documents - Get all documents for organization
router.get("/:orgId/documents", getOrgDocuments);

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

// GET /api/admin/organizations/pending-enterprise - List pending enterprise requests
router.get("/pending-enterprise", getPendingEnterpriseRequests);

// POST /api/admin/organizations/:id/approve-enterprise - Approve an enterprise request
router.post("/:id/approve-enterprise", approveEnterpriseRequest);

// POST /api/admin/organizations/:id/reject-enterprise - Reject an enterprise request
router.post("/:id/reject-enterprise", rejectEnterpriseRequest);

export default router;
