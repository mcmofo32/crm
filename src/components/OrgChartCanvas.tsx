"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { ROLE_LABELS, ROLE_BADGE_VARIANT } from "@/lib/roleLabels";
import type { OrgNode } from "@/lib/actions/orgChart";

const NODE_WIDTH = 200;
const NODE_HEIGHT = 72;
const H_GAP = 28;
const V_GAP = 64;
const PADDING = 32;

type PositionedNode = {
  node: OrgNode;
  x: number;
  y: number;
  children: PositionedNode[];
};

/** Wijst elke node een x/y toe: bladeren op volgorde, ouders gecentreerd boven hun kinderen. */
function layout(roots: OrgNode[]) {
  let leafIndex = 0;

  function place(node: OrgNode, depth: number): PositionedNode {
    if (node.children.length === 0) {
      const x = leafIndex * (NODE_WIDTH + H_GAP);
      leafIndex += 1;
      return { node, x, y: depth * (NODE_HEIGHT + V_GAP), children: [] };
    }
    const children = node.children.map((c) => place(c, depth + 1));
    const x =
      (children[0].x + children[children.length - 1].x) / 2;
    return { node, x, y: depth * (NODE_HEIGHT + V_GAP), children };
  }

  const positioned = roots.map((r) => place(r, 0));

  let maxX = 0;
  let maxY = 0;
  function walk(p: PositionedNode) {
    maxX = Math.max(maxX, p.x + NODE_WIDTH);
    maxY = Math.max(maxY, p.y + NODE_HEIGHT);
    p.children.forEach(walk);
  }
  positioned.forEach(walk);

  return { positioned, width: maxX + PADDING * 2, height: maxY + PADDING * 2 };
}

function flatten(p: PositionedNode, acc: PositionedNode[] = []) {
  acc.push(p);
  p.children.forEach((c) => flatten(c, acc));
  return acc;
}

function NodeCard({ node }: { node: OrgNode }) {
  return (
    <div className="flex w-full flex-col items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-center shadow-sm">
      <Avatar name={node.name} />
      <span className="line-clamp-1 text-sm font-medium text-slate-900">
        {node.name}
      </span>
      <div className="flex flex-wrap items-center justify-center gap-1">
        <Badge variant={ROLE_BADGE_VARIANT[node.role]}>
          {ROLE_LABELS[node.role]}
        </Badge>
        {node.jobFunction && <Badge variant="slate">{node.jobFunction}</Badge>}
      </div>
    </div>
  );
}

export function OrgChartCanvas({ roots }: { roots: OrgNode[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [autoFitted, setAutoFitted] = useState(false);

  const { positioned, width, height } = useMemo(() => layout(roots), [roots]);
  const allNodes = useMemo(
    () => positioned.flatMap((p) => flatten(p)),
    [positioned]
  );

  useLayoutEffect(() => {
    if (autoFitted || !containerRef.current) return;
    const available = containerRef.current.clientWidth - PADDING;
    if (available > 0 && width > available) {
      setScale(Math.max(0.35, available / width));
    }
    setAutoFitted(true);
  }, [autoFitted, width]);

  function fitToScreen() {
    if (!containerRef.current) return;
    const available = containerRef.current.clientWidth - PADDING;
    setScale(available > 0 ? Math.max(0.35, Math.min(1, available / width)) : 1);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          title="Uitzoomen"
          onClick={() => setScale((s) => Math.max(0.3, s - 0.1))}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
        >
          <ZoomOut size={15} />
        </button>
        <span className="w-12 text-center text-sm text-slate-500">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          title="Inzoomen"
          onClick={() => setScale((s) => Math.min(2, s + 0.1))}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
        >
          <ZoomIn size={15} />
        </button>
        <button
          type="button"
          title="Passend maken"
          onClick={fitToScreen}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
        >
          <Maximize2 size={14} />
        </button>
      </div>

      <div
        ref={containerRef}
        className="overflow-auto rounded-lg border border-slate-200 bg-slate-50"
        style={{ maxHeight: "calc(100vh - 260px)" }}
      >
        <div
          style={{
            width: width * scale,
            height: height * scale,
          }}
        >
          <div
            style={{
              width,
              height,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              position: "relative",
            }}
          >
            <svg
              width={width}
              height={height}
              className="absolute left-0 top-0"
              style={{ pointerEvents: "none" }}
            >
              {allNodes.map((p) =>
                p.children.map((child) => {
                  const startX = p.x + NODE_WIDTH / 2 + PADDING;
                  const startY = p.y + NODE_HEIGHT + PADDING;
                  const endX = child.x + NODE_WIDTH / 2 + PADDING;
                  const endY = child.y + PADDING;
                  const midY = startY + (endY - startY) / 2;
                  return (
                    <path
                      key={`${p.node.id}-${child.node.id}`}
                      d={`M ${startX} ${startY} V ${midY} H ${endX} V ${endY}`}
                      fill="none"
                      stroke="#cbd5e1"
                      strokeWidth={2}
                    />
                  );
                })
              )}
            </svg>
            {allNodes.map((p) => (
              <div
                key={p.node.id}
                style={{
                  position: "absolute",
                  left: p.x + PADDING,
                  top: p.y + PADDING,
                  width: NODE_WIDTH,
                }}
              >
                <NodeCard node={p.node} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
