import { Link } from "react-router-dom";

export function DetailLink({ to, label, accessibleLabel }: {
  to: string;
  label: string;
  accessibleLabel: string;
}) {
  return (
    <Link
      className="block max-w-56 truncate text-foreground no-underline hover:text-primary focus-visible:outline-2"
      title={label}
      to={to}
      aria-label={accessibleLabel}
    >
      {label}
    </Link>
  );
}
