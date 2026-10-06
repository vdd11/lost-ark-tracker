import { Font, layoutWhatsLeftImage } from "@/lib/shareImage";
import { LeftGroup } from "@/lib/whatsLeft";

const SIZES: Record<Font, string> = { title: "600 22px", name: "600 16px", body: "13px", small: "12px" };
// The app's dark theme, which reads well in Discord either way.
const COLORS = { bg: "#1a1a19", chip: "#262624", border: "#353532", fg: "#ededed", muted: "#a3a29b", accent: "#e0b44c" };

/**
 * Draws What's left as a PNG, in the browser only: nothing is uploaded.
 * Twice the pixels, so it stays sharp when pasted.
 */
export async function whatsLeftPng(groups: LeftGroup[], subtitle: string): Promise<Blob> {
  const family = getComputedStyle(document.body).fontFamily || "sans-serif";
  const font = (f: Font) => `${SIZES[f]} ${family}`;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas");
  const measure = (text: string, f: Font) => {
    ctx.font = font(f);
    return ctx.measureText(text).width;
  };
  const layout = layoutWhatsLeftImage(groups, subtitle, measure);

  const scale = 2;
  canvas.width = layout.width * scale;
  canvas.height = layout.height * scale;
  ctx.scale(scale, scale);
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.textBaseline = "top";
  for (const op of layout.ops) {
    if (op.kind === "chip") {
      ctx.beginPath();
      ctx.roundRect(op.x + 0.5, op.y + 0.5, op.w - 1, op.h - 1, 6);
      ctx.fillStyle = COLORS.chip;
      ctx.fill();
      ctx.strokeStyle = COLORS.border;
      ctx.stroke();
    } else {
      ctx.font = font(op.font);
      ctx.fillStyle = COLORS[op.color];
      ctx.textAlign = op.align ?? "left";
      ctx.fillText(op.text, op.x, op.y);
    }
  }
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No image"))), "image/png"));
}
