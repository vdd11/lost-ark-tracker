/** The Tools page's cards, one per tool route under /tools/. */
export type Tool = {
  href: string;
  title: string;
  description: string;
  /** A lucide icon name the hub maps to a component. */
  icon: "prices" | "honing" | "astrogems";
};

export const TOOLS: Tool[] = [
  {
    href: "/tools/prices",
    title: "Prices",
    description: "Market prices you type in from the game, used by the other tools to put a gold value on materials.",
    icon: "prices",
  },
  {
    href: "/tools/honing",
    title: "Honing planner",
    description: "What a target item level costs, as a range, and how many weeks of your own gold it takes. Compare characters.",
    icon: "honing",
  },
];
