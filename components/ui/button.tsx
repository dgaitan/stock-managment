import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// Medidas del diseño aprobado: 40 px (32 px «sm», 44 px los íconos), radio 6 px, texto 14 px.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[6px] border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        outline: "border-border bg-background text-foreground hover:bg-subtle aria-expanded:bg-subtle",
        secondary: "bg-secondary text-secondary-foreground hover:bg-zinc-200",
        ghost: "bg-transparent text-foreground hover:bg-muted aria-expanded:bg-muted",
        destructive: "bg-destructive/10 text-destructive hover:bg-destructive/20",
        link: "h-auto px-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-2.5 text-[13px]",
        xs: "h-6 gap-1 px-1.5 text-xs [&_svg:not([class*='size-'])]:size-3",
        icon: "size-11 p-0",
        "icon-sm": "size-8 p-0",
        inline: "h-auto p-0 text-[13px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
