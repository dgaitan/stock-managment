import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// Insignias del diseño aprobado: píldora 12 px con borde, un tono por significado.
const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        outline: "border-border bg-background text-zinc-600",
        secondary: "border-border bg-zinc-100 text-zinc-700",
        red: "border-red-200 bg-red-100 text-red-900",
        orange: "border-orange-200 bg-orange-100 text-orange-900",
        amber: "border-amber-200 bg-amber-100 text-amber-900",
        blue: "border-blue-200 bg-blue-100 text-blue-900",
        green: "border-green-200 bg-green-100 text-green-900",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
