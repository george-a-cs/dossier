"use client";

import { use } from "react";
import { BriefComposer } from "@/components/briefs/BriefComposer";

export default function BriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <BriefComposer briefId={id} />;
}
