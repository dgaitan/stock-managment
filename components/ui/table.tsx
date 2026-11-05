import * as React from "react"
import { cn } from "cn"

// Tabla del diseño aprobado. «default»: encabezado 44 px y filas 52 px con 16 px a los lados (dashboard).
// «sm»: 40 / 48 px, 12 px a los lados y texto 13 px (tablas dentro de drawers y diálogos).
function Table({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"table"> & { size?: "default" | "sm" }) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table
        data-slot="table"
        data-size={size}
        className={cn("group/table w-full border-collapse text-sm data-[size=sm]:text-[13px]", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("[&_tr]:border-border", className)} {...props} />
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={className} {...props} />
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr data-slot="table-row" className={cn("border-b border-hairline", className)} {...props} />
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-11 bg-subtle px-4 text-left align-middle text-xs font-medium whitespace-nowrap text-zinc-600 group-data-[size=sm]/table:h-10 group-data-[size=sm]/table:px-3",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "h-[52px] px-4 align-middle whitespace-nowrap group-data-[size=sm]/table:h-12 group-data-[size=sm]/table:px-3",
        className
      )}
      {...props}
    />
  )
}

export { Table, TableHeader, TableBody, TableHead, TableRow, TableCell }
