import { Users } from "@phosphor-icons/react";

interface UsersHeaderProps {
  isProjectAdmin: boolean;
}

export function UsersHeader({ isProjectAdmin }: UsersHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-[6px] accent-primary/10">
          <Users className="w-6 h-6 text-[#7b4cff]" weight="fill" />
        </div>
        <div>
          <h1 className="text-[24px] font-semibold text-primary tracking-[-0.48px]">
            {isProjectAdmin ? "Project Members" : "Users Management"}
          </h1>
        </div>
      </div>
      <p className="text-[14px] text-secondary tracking-[-0.28px]">
        {isProjectAdmin
          ? "View and manage members of your project"
          : "View and manage user accounts"}
      </p>
    </div>
  );
}

