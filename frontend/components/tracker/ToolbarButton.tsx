import { ReactNode } from "react";

/** A toggle button in the tracker's toolbar (Customize, Edit who does what). */
export default function ToolbarButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${
        active ? "border-accent bg-accent/15 font-medium" : "border-border bg-surface hover:bg-surface-2"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
