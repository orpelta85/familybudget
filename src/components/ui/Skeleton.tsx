'use client'

const shimmerStyle: React.CSSProperties = {
  background: 'linear-gradient(90deg, oklch(0.18 0.01 250) 25%, oklch(0.22 0.01 250) 50%, oklch(0.18 0.01 250) 75%)',
  backgroundSize: '200% 100%',
  animation: 'skeleton-shimmer 1.8s ease-in-out infinite',
  borderRadius: 8,
}

type Variant = 'text' | 'card' | 'circle' | 'chart'

export function Skeleton({
  variant = 'text',
  width,
  height,
  style,
}: {
  variant?: Variant
  width?: number | string
  height?: number | string
  style?: React.CSSProperties
}) {
  const defaults: Record<Variant, React.CSSProperties> = {
    text: { width: width ?? '100%', height: height ?? 16, borderRadius: 6 },
    card: {
      width: width ?? '100%',
      height: height ?? 100,
      borderRadius: 12,
      border: '1px solid oklch(0.22 0.01 250)',
    },
    circle: {
      width: width ?? 40,
      height: height ?? 40,
      borderRadius: '50%',
    },
    chart: {
      width: width ?? '100%',
      height: height ?? 180,
      borderRadius: 12,
      border: '1px solid oklch(0.22 0.01 250)',
    },
  }

  return <div style={{ ...shimmerStyle, ...defaults[variant], ...style }} />
}

/** Dashboard skeleton — KPI cards + chart + budget rows */
export function DashboardSkeleton() {
  return (
    <div style={{ padding: '0' }}>
      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Skeleton variant="text" width={80} height={22} />
          <Skeleton variant="text" width={120} height={14} style={{ marginTop: 6 }} />
        </div>
      </div>

      {/* Period selector */}
      <Skeleton variant="text" width="100%" height={38} style={{ marginBottom: 16, borderRadius: 8 }} />

      {/* KPI cards grid */}
      <div className="grid-kpi">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{
            background: 'oklch(0.16 0.01 250)',
            border: '1px solid oklch(0.25 0.01 250)',
            borderRadius: 12,
            padding: 16,
          }}>
            <Skeleton variant="circle" width={28} height={28} />
            <Skeleton variant="text" width={60} height={12} style={{ marginTop: 10 }} />
            <Skeleton variant="text" width={90} height={24} style={{ marginTop: 6 }} />
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid-2" style={{ marginTop: 8 }}>
        <Skeleton variant="chart" height={200} />
        <Skeleton variant="chart" height={200} />
      </div>

      {/* Budget rows */}
      <Skeleton variant="card" height={140} style={{ marginTop: 8 }} />
    </div>
  )
}

/** Table skeleton — mimics expense/income table rows */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div style={{ padding: '0' }}>
      {/* Header area */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Skeleton variant="text" width={100} height={22} />
          <Skeleton variant="text" width={140} height={14} style={{ marginTop: 6 }} />
        </div>
        <Skeleton variant="text" width={100} height={36} style={{ borderRadius: 8 }} />
      </div>

      {/* KPI summary cards */}
      <div className="grid-kpi" style={{ marginBottom: 16 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{
            background: 'oklch(0.16 0.01 250)',
            border: '1px solid oklch(0.25 0.01 250)',
            borderRadius: 12,
            padding: 16,
          }}>
            <Skeleton variant="text" width={50} height={12} />
            <Skeleton variant="text" width={80} height={22} style={{ marginTop: 6 }} />
          </div>
        ))}
      </div>

      {/* Table rows */}
      <div style={{
        background: 'oklch(0.16 0.01 250)',
        border: '1px solid oklch(0.25 0.01 250)',
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 16px',
            borderBottom: i < rows - 1 ? '1px solid oklch(0.22 0.01 250)' : 'none',
          }}>
            <Skeleton variant="circle" width={32} height={32} />
            <div style={{ flex: 1 }}>
              <Skeleton variant="text" width={`${50 + (i % 3) * 15}%`} height={14} />
              <Skeleton variant="text" width={80} height={11} style={{ marginTop: 6 }} />
            </div>
            <Skeleton variant="text" width={70} height={18} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Chart placeholder skeleton for dynamic imports */
export function ChartSkeleton({ height = 180 }: { height?: number }) {
  return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Skeleton variant="chart" height={height - 20} />
    </div>
  )
}
