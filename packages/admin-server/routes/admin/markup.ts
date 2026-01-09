import express from "express";
import { requireAdmin } from "../../middleware/betterAuthMiddleware";
import {
  getMarkup,
  createMarkup,
} from "../../controllers/admin/markupController";

const markupRouter = express.Router();

// Allow super_admin and org_admin (permissions checked in controller)
markupRouter.get("/getMarkup", requireAdmin, getMarkup);
markupRouter.post("/createMarkup", requireAdmin, createMarkup);
export default markupRouter;
