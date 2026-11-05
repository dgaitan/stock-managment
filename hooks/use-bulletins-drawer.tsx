"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// Abre el drawer «Comunicados» desde otro lugar (el enlace «Gestionar comunicados» del stepper).
type BulletinsDrawer = { open: boolean; setOpen: (open: boolean) => void };

const Context = createContext<BulletinsDrawer | null>(null);

export function BulletinsDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <Context value={{ open, setOpen }}>{children}</Context>;
}

export function useBulletinsDrawer(): BulletinsDrawer {
  const drawer = useContext(Context);
  if (!drawer) throw new Error("useBulletinsDrawer requiere BulletinsDrawerProvider");
  return drawer;
}
