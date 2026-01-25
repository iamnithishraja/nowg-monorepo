import { OrganizationMember, ProjectMember, TeamMember } from "@nowgai/shared/models";
import mongoose from "mongoose";
import Conversation from "../models/conversationModel";
import Project from "../models/projectModel";
import VersionSnapshot from "../models/versionSnapshotModel";
import type {
    TemplateFileSnapshot,
    VersionSnapshotPayload,
} from "../types/versioning";
import { connectToDatabase } from "./mongo";

interface VersionSnapshotLean {
  _id: mongoose.Types.ObjectId;
  label: string;
  versionNumber: number;
  files: TemplateFileSnapshot[];
  selectedPath?: string;
  previewUrl?: string | null;
  anchorMessageId?: string | null;
  createdAt: Date;
}

export class VersionSnapshotService {
  private async ensureConnection() {
    await connectToDatabase();
  }

  private async assertConversationOwnership(
    conversationId: string,
    userId: string
  ) {
    await this.ensureConnection();

    // Use mongoose.models to ensure the model is registered
    const ConversationModel = mongoose.models.Conversation || Conversation;
    if (!ConversationModel) {
      throw new Error("Conversation model not available");
    }

    const conversation = await ConversationModel.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
    })
      .select("_id userId teamId projectType adminProjectId")
      .lean();

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // For organization projects (linked via adminProjectId), check access
    if (conversation.adminProjectId) {
      // Handle adminProjectId whether it's an ObjectId, string, or populated object
      let projectId: mongoose.Types.ObjectId;
      if (conversation.adminProjectId instanceof mongoose.Types.ObjectId) {
        projectId = conversation.adminProjectId;
      } else if (typeof conversation.adminProjectId === "string") {
        projectId = new mongoose.Types.ObjectId(conversation.adminProjectId);
      } else if (
        typeof conversation.adminProjectId === "object" &&
        conversation.adminProjectId !== null &&
        "_id" in conversation.adminProjectId
      ) {
        const adminProjectIdObj = conversation.adminProjectId as { _id: any };
        projectId =
          adminProjectIdObj._id instanceof mongoose.Types.ObjectId
            ? adminProjectIdObj._id
            : new mongoose.Types.ObjectId(adminProjectIdObj._id);
      } else {
        projectId = new mongoose.Types.ObjectId(
          String(conversation.adminProjectId)
        );
      }

      // Check 1: Direct project membership
      const projectMembership = await ProjectMember.findOne({
        projectId: projectId,
        userId: userId,
        status: "active",
      });

      if (projectMembership) {
        return; // User has direct project access
      }

      // Check 2: Organization membership (get project's organization first)
      const project = await Project.findById(projectId).lean();
      if (project && project.organizationId) {
        const organizationId =
          project.organizationId instanceof mongoose.Types.ObjectId
            ? project.organizationId
            : new mongoose.Types.ObjectId(project.organizationId);

        const orgMembership = await OrganizationMember.findOne({
          organizationId: organizationId,
          userId: userId,
          status: "active",
        });

        if (orgMembership) {
          return; // User has organization access
        }
      }

      // No access found for org/project conversation
      throw new Error("Conversation not found");
    }

    // For team projects, check if user is a team member
    if (conversation.teamId && conversation.projectType === "team") {
      const membership = await TeamMember.findOne({
        teamId: conversation.teamId,
        userId: userId,
        status: "active",
      });

      if (!membership) {
        throw new Error("Not a member of this team");
      }
    } else {
      // For personal projects, check if user owns the conversation
      if (conversation.userId !== userId) {
        throw new Error("Conversation not found");
      }
    }
  }

  async list(
    conversationId: string,
    userId: string
  ): Promise<
    Array<{
      id: string;
      label: string;
      versionNumber: number;
      files: TemplateFileSnapshot[];
      selectedPath?: string;
      previewUrl: string | null;
      anchorMessageId?: string | null;
      createdAt: Date;
    }>
  > {
    await this.ensureConnection();
    await this.assertConversationOwnership(conversationId, userId);

    const versions = await VersionSnapshot.find({
      conversationId: new mongoose.Types.ObjectId(conversationId),
    })
      .sort({ versionNumber: 1 })
      .lean<VersionSnapshotLean[]>();

    return versions.map((v: any) => ({
      id: v._id.toString(),
      label: v.label,
      versionNumber: v.versionNumber,
      files: v.files || [],
      selectedPath: v.selectedPath,
      previewUrl: v.previewUrl ?? null,
      anchorMessageId: v.anchorMessageId ?? null,
      createdAt: v.createdAt,
    }));
  }

  async get(
    versionId: string,
    userId: string
  ): Promise<{
    id: string;
    label: string;
    versionNumber: number;
    files: TemplateFileSnapshot[];
    selectedPath?: string;
    previewUrl: string | null;
    anchorMessageId?: string | null;
    createdAt: Date;
    conversationId: string;
  } | null> {
    await this.ensureConnection();

    const version = await VersionSnapshot.findOne({
      _id: new mongoose.Types.ObjectId(versionId),
    }).lean<
      | (VersionSnapshotLean & {
          conversationId: mongoose.Types.ObjectId;
          userId: string;
        })
      | null
    >();

    if (!version) {
      return null;
    }

    // Check access to the conversation (ownership or team membership)
    await this.assertConversationOwnership(
      version.conversationId.toString(),
      userId
    );

    return {
      id: version._id.toString(),
      label: version.label,
      versionNumber: version.versionNumber,
      files: version.files || [],
      selectedPath: version.selectedPath,
      previewUrl: version.previewUrl ?? null,
      anchorMessageId: version.anchorMessageId ?? null,
      createdAt: version.createdAt,
      conversationId: version.conversationId.toString(),
    };
  }

  async create(
    conversationId: string,
    userId: string,
    payload: VersionSnapshotPayload
  ) {
    await this.ensureConnection();
    await this.assertConversationOwnership(conversationId, userId);

    const lastVersion = await VersionSnapshot.findOne({
      conversationId: new mongoose.Types.ObjectId(conversationId),
    })
      .sort({ versionNumber: -1 })
      .lean<VersionSnapshotLean | null>();

    const nextNumber = (lastVersion?.versionNumber ?? 0) + 1;
    const label = payload.label || `Version ${nextNumber}`;

    const doc = await VersionSnapshot.create({
      conversationId: new mongoose.Types.ObjectId(conversationId),
      userId,
      versionNumber: nextNumber,
      label,
      files: payload.files,
      selectedPath: payload.selectedPath,
      previewUrl: payload.previewUrl ?? null,
      anchorMessageId: payload.anchorMessageId ?? null,
    });

    return {
      id: doc._id.toString(),
      label: doc.label,
      versionNumber: doc.versionNumber,
      files: doc.files,
      selectedPath: doc.selectedPath,
      previewUrl: doc.previewUrl ?? null,
      anchorMessageId: doc.anchorMessageId ?? null,
      createdAt: doc.createdAt,
    };
  }
}
