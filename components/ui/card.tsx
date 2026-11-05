import * as React from "react"
import { cn } from "cn"

// Tarjeta del diseño aprobado: borde zinc-200, radio 10 px y sombra mínima. El padding lo pone quien la usa.
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "rounded-[10px] border border-border bg-card text-card-foreground shadow-[0_1px_2px_rgba(0,0,0,.04)]",
        className
      )}
      {...props}
    />
  )
}

export { Card }
