/** The Tools page's cards, one per tool route under /tools/. */
export type Tool = {
  href: string;
  title: string;
  description: string;
  /** A lucide icon name the hub maps to a component. */
  icon: "prices" | "astrogems";
};

export const TOOLS: Tool[] = [
  {
    href: "/tools/prices",
    title: "Prices",
    description: "A notebook of market prices you type in from the game, with how old each one is.",
    icon: "prices",
  },
  {
    href: "/tools/astrogems",
    title: "Astrogem cutting",
    description: "Keep it open beside the game while processing: enter the 4 options and it says process, refresh or stop, from the official odds.",
    icon: "astrogems",
  },
];
