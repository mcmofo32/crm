type Series = {
  key: string;
  label: string;
  color: string;
  values: number[];
};

/** Lichte lijngrafiek zonder externe library: één as, dunne lijnen, punten met native tooltip. */
export function LineChart({
  labels,
  series,
  height = 200,
  valueSuffix = "",
}: {
  labels: string[];
  series: Series[];
  height?: number;
  valueSuffix?: string;
}) {
  const width = Math.max(labels.length * 56, 320);
  const padding = { top: 16, right: 12, bottom: 28, left: 12 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const maxValue = Math.max(1, ...series.flatMap((s) => s.values));
  const niceMax = niceCeiling(maxValue);
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(niceMax * f));

  const stepX = labels.length > 1 ? plotWidth / (labels.length - 1) : 0;
  const xFor = (i: number) => padding.left + stepX * i;
  const yFor = (v: number) => padding.top + plotHeight * (1 - v / niceMax);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        role="img"
        aria-label="Lijngrafiek"
        className="min-w-full"
      >
        {gridLines.map((v) => (
          <g key={v}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={yFor(v)}
              y2={yFor(v)}
              stroke="#e2e8f0"
              strokeWidth={1}
            />
            <text
              x={padding.left}
              y={yFor(v) - 4}
              fontSize={10}
              fill="#94a3b8"
            >
              {v.toLocaleString("nl-BE")}
              {valueSuffix}
            </text>
          </g>
        ))}

        {labels.map((label, i) => (
          <text
            key={label + i}
            x={xFor(i)}
            y={height - 8}
            fontSize={10}
            fill="#94a3b8"
            textAnchor="middle"
          >
            {label}
          </text>
        ))}

        {series.map((s) => (
          <g key={s.key}>
            <polyline
              points={s.values.map((v, i) => `${xFor(i)},${yFor(v)}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {s.values.map((v, i) => (
              <circle key={i} cx={xFor(i)} cy={yFor(v)} r={8} fill="transparent">
                <title>
                  {s.label} — {labels[i]}: {v.toLocaleString("nl-BE")}
                  {valueSuffix}
                </title>
              </circle>
            ))}
            {s.values.map((v, i) => (
              <circle
                key={`dot-${i}`}
                cx={xFor(i)}
                cy={yFor(v)}
                r={3}
                fill={s.color}
                stroke="white"
                strokeWidth={1}
                pointerEvents="none"
              />
            ))}
          </g>
        ))}
      </svg>
      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-slate-500">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function niceCeiling(value: number) {
  if (value <= 5) return 5;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}
