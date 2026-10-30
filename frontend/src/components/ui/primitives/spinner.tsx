import type { SvgIconProps } from "@mui/material/SvgIcon";
// MUI SVG icon with the existing spinner accessibility and reduced-motion behavior.
// Source: https://ui.shadcn.com/r/styles/new-york-v4/spinner.json
import { cn } from "../../../lib/utils";
import AutorenewIcon from "@mui/icons-material/Autorenew";

function Spinner({ className, ...props }: SvgIconProps) {
  return (
    <AutorenewIcon
      sx={{ fontSize: "1rem" }}
      role="status"
      aria-label="Loading"
      className={cn("animate-spin motion-reduce:animate-none", className)}
      {...props}
    />
  );
}

export { Spinner };
