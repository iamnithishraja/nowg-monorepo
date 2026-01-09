import { Router } from "express";
import { requireAdmin } from "../../middleware/betterAuthMiddleware";
import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  assignProjectAdmin,
  unassignProjectAdmin,
  deleteProject,
  acceptProjectInvitation,
  rejectProjectInvitation,
} from "../../controllers/admin/projectsController";

const router = Router();

// All routes require admin authentication
router.use(requireAdmin);

// GET /api/admin/projects - Get all projects
router.get("/", getProjects);

// GET /api/admin/projects/:id - Get a single project by ID
router.get("/:id", getProject);

// POST /api/admin/projects - Create a new project
router.post("/", createProject);

// PUT /api/admin/projects/:id - Update a project
router.put("/:id", updateProject);

// POST /api/admin/projects/:id/assign-admin - Assign user as project admin
router.post("/:id/assign-admin", assignProjectAdmin);

// DELETE /api/admin/projects/:id/admin - Unassign project admin
router.delete("/:id/admin", unassignProjectAdmin);

// DELETE /api/admin/projects/:id - Delete (archive) a project
router.delete("/:id", deleteProject);

export default router;
