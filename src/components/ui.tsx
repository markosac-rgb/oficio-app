"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
        "pressable inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-2xl font-extrabold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-clay text-white hover:bg-clay-dark",
        secondary: "border border-line bg-sand text-ink hover:bg-paper",
        ghost: "text-ink hover:bg-white",
        leaf: "bg-leaf text-white hover:bg-leaf-dark",
        danger: "bg-danger text-white",
      },
      size: {
        default: "h-12 px-4 text-base",
        sm: "h-10 px-3 text-sm",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-12 w-full rounded-2xl border border-line bg-sand px-3 text-base text-ink placeholder:text-muted/80",
        props.className,
      )}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-28 w-full rounded-2xl border border-line bg-sand px-3 py-3 text-base text-ink placeholder:text-muted/80",
        props.className,
      )}
    />
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-extrabold text-ink">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-sm leading-5 text-muted">{hint}</span> : null}
      {error ? <span className="mt-1 block text-sm font-bold text-danger">{error}</span> : null}
    </label>
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-3xl border border-line bg-sand p-4 shadow-sm", className)} {...props} />;
}

export function Badge({
  tone = "sand",
  children,
}: {
  tone?: "sand" | "clay" | "leaf" | "gold" | "danger";
  children: React.ReactNode;
}) {
  const tones = {
    sand: "bg-paper text-ink",
    clay: "bg-[#f8e4db] text-clay-dark",
    leaf: "bg-[#e4f3ee] text-leaf-dark",
    gold: "bg-[#f8efd4] text-gold",
    danger: "bg-[#fde8eb] text-danger",
  };
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold", tones[tone])}>{children}</span>;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 max-h-[85dvh] w-[min(100%-2rem,32rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-sand p-5 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <DialogPrimitive.Title className="text-xl font-extrabold">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close className="rounded-full p-1" aria-label="Cerrar">
              <X />
            </DialogPrimitive.Close>
          </div>
          <div className="mt-3 text-base leading-6">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
