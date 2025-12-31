"use client";

import { createContext, useContext, ReactNode } from "react";

interface CoresContextValue {
  initialActiveCoresCount: number;
}

const CoresContext = createContext<CoresContextValue>({
  initialActiveCoresCount: 2,
});

export function CoresProvider({
  children,
  initialActiveCoresCount,
}: {
  children: ReactNode;
  initialActiveCoresCount: number;
}) {
  return (
    <CoresContext.Provider value={{ initialActiveCoresCount }}>
      {children}
    </CoresContext.Provider>
  );
}

export function useInitialActiveCoresCount(): number {
  return useContext(CoresContext).initialActiveCoresCount;
}
