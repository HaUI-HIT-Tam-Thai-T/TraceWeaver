import type { InputHTMLAttributes, Ref } from "react";
import { Input as ShadcnInput } from "./primitives/input";
import { cn } from "../../lib/utils";
import SearchOutlined from "@mui/icons-material/SearchOutlined";

type InputProps = InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> };

// React 19 passes the React Hook Form register() ref through to the native input.
export function Input({ className, type, ...props }: InputProps) {
  const input = (
    <ShadcnInput
      {...props}
      type={type}
      className={cn(
        "min-h-10 bg-control py-2 md:text-base motion-reduce:transition-none",
        type === "search" && "pl-10",
        className,
      )}
    />
  );
  if (type !== "search") return input;
  return (
    <div className="relative min-w-0">
      <SearchOutlined
        aria-hidden="true"
        sx={{ fontSize: "1.25rem" }}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
      />
      {input}
    </div>
  );
}
