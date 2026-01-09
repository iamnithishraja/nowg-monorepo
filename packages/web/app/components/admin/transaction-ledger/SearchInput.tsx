import { MagnifyingGlass } from "@phosphor-icons/react";
import { Input } from "../../ui/input";

interface SearchInputProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}

export function SearchInput({
  placeholder = "Search...",
  value,
  onChange,
}: SearchInputProps) {
  return (
    <div className="relative">
      <MagnifyingGlass className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-tertiary" />
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-8 bg-surface-2 border-subtle text-primary placeholder:text-tertiary focus:border-[#555558]"
      />
    </div>
  );
}

