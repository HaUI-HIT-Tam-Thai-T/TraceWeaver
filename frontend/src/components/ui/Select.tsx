import type { SelectHTMLAttributes, Ref } from "react";
import { NativeSelect } from "./primitives/native-select";
import { cn } from "../../utils/classNames";

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  ref?: Ref<HTMLSelectElement>;
};

export function Select({ className, ...props }: SelectProps) {
  return (
    <NativeSelect
      {...props}
      className={cn("min-h-10 bg-control text-base motion-reduce:transition-none", className)}
    />
  );
}
