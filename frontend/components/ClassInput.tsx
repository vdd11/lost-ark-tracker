"use client";

import { ComponentProps } from "react";

import { LOST_ARK_CLASSES } from "@/lib/classes";

const LIST_ID = "lost-ark-classes";

/**
 * Class name with suggestions that filter as you type. Any text is still
 * accepted, so a class added to the game later works too. Render
 * <ClassSuggestions /> once on the page.
 */
export default function ClassInput(props: Omit<ComponentProps<"input">, "list">) {
  return <input {...props} list={LIST_ID} autoComplete="off" />;
}

export function ClassSuggestions() {
  return (
    <datalist id={LIST_ID}>
      {LOST_ARK_CLASSES.map((name) => (
        <option key={name} value={name} />
      ))}
    </datalist>
  );
}
