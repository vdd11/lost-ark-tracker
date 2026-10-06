import GameIcon from "@/components/GameIcon";
import { classIconName } from "@/lib/data/icons";

/** A character's name with their class icon in front, so who's who reads at a glance. */
export default function CharacterName({ name, className, size = 24 }: { name: string; className?: string | null; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {className ? <GameIcon name={classIconName(className)} size={size} rem alt="" /> : null}
      {name}
    </span>
  );
}
