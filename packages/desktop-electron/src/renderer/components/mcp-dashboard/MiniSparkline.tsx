/**
 * Mini Sparkline Component
 *
 * 10-bar chart showing activity over last 5 minutes.
 */

interface MiniSparklineProps {
  data: number[];
  width?: number;
  height?: number;
}

export function MiniSparkline({ data, width = 60, height = 16 }: MiniSparklineProps) {
  const maxValue = Math.max(...data, 1); // Ensure at least 1 to avoid division by zero
  const barCount = data.length;
  const barWidth = Math.floor(width / barCount) - 1;
  const gap = 1;

  return (
    <div
      className="mini-sparkline"
      style={{ width, height }}
      title={`Activity: ${data.reduce((a, b) => a + b, 0)} calls in 5 min`}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {data.map((value, index) => {
          const barHeight = Math.max(2, (value / maxValue) * height);
          const x = index * (barWidth + gap);
          const y = height - barHeight;

          // Color intensity based on value
          const intensity = Math.min(1, value / Math.max(maxValue, 1));
          const opacity = 0.3 + intensity * 0.7;

          return (
            <rect
              key={index}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={1}
              className="sparkline-bar"
              style={{ opacity }}
            />
          );
        })}
      </svg>
    </div>
  );
}
