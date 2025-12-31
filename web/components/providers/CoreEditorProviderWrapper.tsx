"use client";

import { ReactNode } from "react";
import { CoreEditorProvider } from "@/contexts/CoreEditorContext";
import { DraggableCoreEditor } from "@/components/cores/DraggableCoreEditor";

export function CoreEditorProviderWrapper({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <CoreEditorProvider>
      {children}
      <DraggableCoreEditor />
    </CoreEditorProvider>
  );
}
