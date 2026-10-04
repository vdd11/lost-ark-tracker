import { Character } from "./api";

/** A raid group (static), as GET /api/raid-groups returns it. */
export type RaidGroup = {
  id: number;
  name: string;
  task_id: number | null;
  schedule: string | null;
  members: string[];
  notes: string | null;
  position: number;
};

/** Off until turned on under Customize. */
export const RAID_GROUPS_PREFERENCE = "widget-raid-groups";

export type MemberStatus = { name: string; character: Character | null; status: "done" | "left" | "other" };

/**
 * Each member of a group: one of the user's characters (matched by name,
 * ignoring case) who has done the group's raid this week or still has it
 * left, or someone else's character.
 */
export function memberStatuses(group: RaidGroup, characters: Character[], isDone: (characterId: number, taskId: number) => boolean): MemberStatus[] {
  const byName = new Map(characters.map((c) => [c.name.trim().toLowerCase(), c]));
  return group.members.map((name) => {
    const character = byName.get(name.trim().toLowerCase()) ?? null;
    if (!character || group.task_id === null) return { name, character, status: "other" };
    return { name, character, status: isDone(character.id, group.task_id) ? "done" : "left" };
  });
}

/** "Bardy, Sorcy, Tanky" -> ["Bardy", "Sorcy", "Tanky"]: commas or new lines, blanks and repeats dropped. */
export function parseMembers(text: string): string[] {
  return [...new Set(text.split(/[,\n]/).map((n) => n.trim()).filter(Boolean))];
}
