import { User as UserIcon } from "lucide-react";

interface ProfileAvatarProps {
  imageUrl?: string | null;
  displayName: string;
  size?: "sm" | "lg";
}

export function ProfileAvatar({
  imageUrl,
  displayName,
  size = "lg",
}: ProfileAvatarProps) {
  const sizeClass = size === "lg" ? "w-16 h-16" : "w-10 h-10";
  const textSize = size === "lg" ? "text-xl" : "text-sm";

  const initials = (() => {
    const source = displayName || "";
    const parts = source
      .split(" ")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length >= 2)
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    const handle = source.includes("@") ? source.split("@")[0] : source;
    return handle.slice(0, 2).toUpperCase();
  })();

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        className={`${sizeClass} rounded-full object-cover border border-white/10`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white ${textSize} font-semibold`}
    >
      {initials || <UserIcon className="w-6 h-6" />}
    </div>
  );
}
