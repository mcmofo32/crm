import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { ROLE_LABELS, ROLE_BADGE_VARIANT } from "@/lib/roleLabels";
import type { OrgNode } from "@/lib/actions/orgChart";

export function OrgChartNode({ node, depth = 0 }: { node: OrgNode; depth?: number }) {
  return (
    <div className={depth > 0 ? "ml-6 border-l border-slate-200 pl-6" : ""}>
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <Avatar name={node.name} />
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900">{node.name}</span>
            <Badge variant={ROLE_BADGE_VARIANT[node.role]}>
              {ROLE_LABELS[node.role]}
            </Badge>
          </div>
          <div className="text-xs text-slate-400">
            {node.email || "Geen e-mailadres"}
            {node.teamName ? ` · coacht "${node.teamName}"` : ""}
          </div>
        </div>
      </div>
      {node.children.length > 0 && (
        <div className="mt-3 flex flex-col gap-3">
          {node.children.map((child) => (
            <OrgChartNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
