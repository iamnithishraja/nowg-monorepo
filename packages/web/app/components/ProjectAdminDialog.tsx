import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Loader2 } from "lucide-react";

interface Organization {
  id: string;
  name: string;
  role: string;
}

interface User {
  id: string;
  email: string;
  name?: string;
}

interface ProjectAdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizations: Organization[];
  availableUsers: User[];
  isLoadingUsers: boolean;
  selectedOrganizationId: string;
  selectedProjectAdminId: string;
  projectTitle: string;
  onOrganizationChange: (orgId: string) => void;
  onProjectAdminChange: (userId: string) => void;
  onProjectTitleChange: (title: string) => void;
  onCreateProject: () => void;
  isCreating: boolean;
}

export function ProjectAdminDialog({
  open,
  onOpenChange,
  organizations,
  availableUsers,
  isLoadingUsers,
  selectedOrganizationId,
  selectedProjectAdminId,
  projectTitle,
  onOrganizationChange,
  onProjectAdminChange,
  onProjectTitleChange,
  onCreateProject,
  isCreating,
}: ProjectAdminDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-[#1a1a1a] border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white">
            Create Project
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-white/70">
            Since you're creating a project in your organization, please provide
            a project title and assign a project admin.
          </p>

          {/* Project Title Input */}
          <div className="space-y-2">
            <Label className="text-white/80">Project Title</Label>
            <Input
              value={projectTitle}
              onChange={(e) => onProjectTitleChange(e.target.value)}
              placeholder="Enter project title"
              className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30"
            />
          </div>

          {/* Organization Selection */}
          {organizations.length > 1 && (
            <div className="space-y-2">
              <Label className="text-white/80">Organization</Label>
              <Select
                value={selectedOrganizationId}
                onValueChange={(value) => {
                  onOrganizationChange(value);
                  onProjectAdminChange("");
                }}
              >
                <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white">
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10">
                  {organizations.map((org) => (
                    <SelectItem
                      key={org.id}
                      value={org.id}
                      className="text-white hover:bg-white/10"
                    >
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Project Admin Selection */}
          <div className="space-y-2">
            <Label className="text-white/80">Project Admin</Label>
            {isLoadingUsers ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-white/50" />
              </div>
            ) : (
              <Select
                value={selectedProjectAdminId}
                onValueChange={onProjectAdminChange}
              >
                <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white">
                  <SelectValue placeholder="Select project admin" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10">
                  {availableUsers.length === 0 ? (
                    <div className="px-2 py-4 text-center text-sm text-white/50">
                      No users available
                    </div>
                  ) : (
                    availableUsers.map((user) => (
                      <SelectItem
                        key={user.id}
                        value={user.id}
                        className="text-white hover:bg-white/10"
                      >
                        <div className="flex flex-col">
                          <span>{user.name || user.email}</span>
                          {user.name && (
                            <span className="text-xs text-white/50">
                              {user.email}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="bg-white/[0.04] border-white/[0.08] text-white hover:bg-white/[0.08]"
          >
            Cancel
          </Button>
          <Button
            onClick={onCreateProject}
            disabled={!selectedProjectAdminId || !projectTitle.trim() || isCreating}
            className="bg-white text-black hover:bg-white/90"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Project"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

