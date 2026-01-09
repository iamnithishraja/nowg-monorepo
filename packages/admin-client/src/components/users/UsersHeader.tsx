interface UsersHeaderProps {
  isProjectAdmin: boolean;
}

export function UsersHeader({ isProjectAdmin }: UsersHeaderProps) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-semibold text-foreground mb-2">
        {isProjectAdmin ? "Project Members" : "Users Management"}
      </h1>
      <p className="text-muted-foreground">
        {isProjectAdmin
          ? "View and manage members of your project"
          : "View and manage user accounts"}
      </p>
    </div>
  );
}
