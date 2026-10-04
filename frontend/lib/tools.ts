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
];
