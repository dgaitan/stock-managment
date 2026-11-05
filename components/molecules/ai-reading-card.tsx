import { SparklesIcon } from "lucide-react";

/** Tarjeta azul con la lectura de la IA sobre las cifras del motor. */
export function AiReadingCard({ lines }: { lines: string[] }) {
  return (
    <div className="rounded-[10px] border border-blue-200 bg-info-surface px-4 py-3.5">
      <div className="mb-1.5 flex items-center gap-1.5">
        <SparklesIcon aria-hidden className="size-3.5 text-primary" />
        <span className="text-xs font-semibold text-primary">Lectura generada por IA a partir de las cifras del motor</span>
      </div>
      {lines.map((line) => (
        <p key={line} className="text-[13px] leading-[1.6]">
          {line}
        </p>
      ))}
    </div>
  );
}
