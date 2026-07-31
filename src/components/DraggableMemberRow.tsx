"use client";

import { useState } from "react";
import { GripVertical } from "lucide-react";

export function DraggableMemberRow({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", userId);
        e.dataTransfer.effectAllowed = "move";
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      className={`flex items-center gap-1 ${dragging ? "opacity-40" : ""}`}
    >
      <GripVertical
        size={14}
        className="shrink-0 cursor-grab text-slate-300 active:cursor-grabbing"
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
