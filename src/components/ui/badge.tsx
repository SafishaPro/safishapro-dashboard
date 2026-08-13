import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-blue-50 text-blue-900 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-200",
        success:
          "border-transparent bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  const resolvedVariant = variant === "secondary" && props.children === "Active" ? "success" : variant;
  return <div className={cn(badgeVariants({ variant: resolvedVariant }), className)} {...props} />;
}

export { Badge, badgeVariants };
