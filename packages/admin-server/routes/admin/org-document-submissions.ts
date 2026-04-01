import express from "express";
import { reviewDocumentSubmission } from "../../controllers/admin/orgDocumentSubmissionsController.js";

const router = express.Router();

router.post("/:id/review", reviewDocumentSubmission);

export default router;
