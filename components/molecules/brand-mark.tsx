import { BoxIcon } from "lucide-react";
import { APP_NAME } from "@/lib/app";

// Logo + nombre. «header»: 32 px / 16 px (encabezado); «login»: 36 px / 18 px.
const SIZES = {
  header: { box: "size-8", icon: "size-[17px]", text: "text-base" },
  login: { box: "size-9", icon: "size-5", text: "text-lg" },
} as const;

export function BrandMark({ size }: { size: keyof typeof SIZES }) {
  const s = SIZES[size];
  return (
    <div className="flex items-center gap-2.5">
      <span className={`flex items-center justify-center rounded-lg bg-primary text-primary-foreground ${s.box}`}>
        <BoxIcon aria-hidden className={s.icon} />
      </span>
      <span className={`font-semibold ${s.text}`}>{APP_NAME}</span>
    </div>
  );
}
