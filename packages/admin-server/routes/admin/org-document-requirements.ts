import express from "express";
import {
  getRequirements,
  createRequirement,
  updateRequirement,
  deleteRequirement,
} from "../../controllers/admin/orgDocumentRequirementsController.js";

const router = express.Router();

router.get("/", getRequirements);
router.post("/", createRequirement);
router.put("/:id", updateRequirement);
router.delete("/:id", deleteRequirement);

export default router;
