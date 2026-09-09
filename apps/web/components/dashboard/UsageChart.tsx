import { lastDays } from "@/lib/format";

function dayLabel(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${Number(month)}/${Number(day)}`;
}

export function UsageChart({ dates }: { dates: string[] }) {
  const days = lastDays(7);
  const counts = days.map((day) => dates.filter((item) => item.startsWith(day)).length);
  const max = Math.max(1, ...counts);
  const width = 560;
  const height = 180;
  const pad = { top: 16, right: 20, bottom: 28, left: 20 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const step = counts.length > 1 ? innerW / (counts.length - 1) : innerW;

  const points = counts.map((count, index) => {
    const x = pad.left + index * step;
    const y = pad.top + innerH - (count / max) * innerH;
    return `${x},${y}`;
  });
  const line = points.join(" ");
  const area = `${pad.left},${pad.top + innerH} ${line} ${pad.left + innerW},${pad.top + innerH}`;

  return (
    <div className="min-w-0 overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-40 w-full max-w-full sm:h-48"
        role="img"
        aria-label="Briefing activity for the last 7 days"
      >
        <defs>
          <linearGradient id="usageFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4F6BF5" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#4F6BF5" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#usageFill)" />
        <polyline
          points={line}
          fill="none"
          stroke="#4F6BF5"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {counts.map((count, index) => {
          const x = pad.left + index * step;
          const y = pad.top + innerH - (count / max) * innerH;
          return <circle key={days[index]} cx={x} cy={y} r="3.5" fill="#4F6BF5" />;
        })}
        {days.map((day, index) => (
          <text
            key={day}
            x={pad.left + index * step}
            y={height - 8}
            textAnchor="middle"
            className="fill-muted"
            fontSize="11"
          >
            {dayLabel(day)}
          </text>
        ))}
      </svg>
    </div>
  );
}
