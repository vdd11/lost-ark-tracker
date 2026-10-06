/** The Tools page's cards, one per tool route under /tools/. */
export type Tool = {
  href: string;
  title: string;
  description: string;
  /** A lucide icon name the hub maps to a component. */
  icon: "astrogems";
  /** A game icon (lib/data/icons.ts) used instead when its file is bundled. */
  gameIcon?: string;
};

export const TOOLS: Tool[] = [
  {
    href: "/tools/astrogems",
    title: "Astrogem cutting",
    description: "Keep it open beside the game while processing: enter the 4 options and it says process, refresh or stop, from the official odds.",
    icon: "astrogems",
    gameIcon: "astrogem-order",
  },
];
