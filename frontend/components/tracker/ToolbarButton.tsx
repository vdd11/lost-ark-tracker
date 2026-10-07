import { ReactNode } from "react";

/**
 * A toggle button in the tracker's toolbar (Customize, Edit who does what).
 * On a phone it's just its icon, so the toolbar stays one row; the label is
 * its tooltip and what a screen reader says.
 */
export default function ToolbarButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-sm sm:px-3 ${
        active ? "border-accent bg-accent/15 font-medium" : "border-border bg-surface hover:bg-surface-2"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
