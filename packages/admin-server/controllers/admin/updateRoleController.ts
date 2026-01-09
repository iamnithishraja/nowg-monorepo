import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { getUsersCollection } from "../../config/db";
import {
  isValidUserRole,
  getInvalidUserRoleError,
} from "../../types/roles";

export async function updateRole(req: Request, res: Response) {
  try {
    const { userId, role } = req.body;

    console.log("Update role request:", { userId, role });

    if (!userId || !role) {
      return res.status(400).json({ error: "userId and role are required" });
    }

    if (!isValidUserRole(role)) {
      return res.status(400).json({
        error: getInvalidUserRoleError(),
      });
    }

    const usersCollection = getUsersCollection();

    let objectId: ObjectId;
    try {
      objectId = new ObjectId(userId);
    } catch (err) {
      return res.status(400).json({ error: "Invalid user ID format" });
    }

    const result = await usersCollection.updateOne(
      { _id: objectId },
      { $set: { role } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      success: true,
      message: "User role updated successfully",
    });
  } catch (error: any) {
    console.error("Error updating user role:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error.message || String(error),
    });
  }
}
