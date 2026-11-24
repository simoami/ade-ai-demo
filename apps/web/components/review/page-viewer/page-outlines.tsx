/** One outline in page pixels; `elementId` marks the selected outline for zooming and hit tests. */
export type OutlineShape = {
  id: string
  elementId?: string
  tone: 'review' | 'selected'
  spotlight?: boolean
  polygon: string[]
}

/** SVG overlay with marching-ants outlines and an optional dimmed spotlight around one of them. */
export function PageOutlines({
  width,
  height,
  shapes,
}: {
  width: number
  height: number
  shapes: OutlineShape[]
}) {
  const spotlight = shapes.find((shape) => shape.spotlight)

  return (
    <svg
      viewBox={`0 0 ${width || 1} ${height || 1}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full overflow-visible"
    >
      {spotlight && (
        <path
          d={`M0 0H${width}V${height}H0Z M${spotlight.polygon.join(' L')}Z`}
          fillRule="evenodd"
          className="fill-black/15 animate-in fade-in duration-200"
        />
      )}
      {shapes.map(({ id, elementId, polygon, tone }) => {
        const coordinates = polygon.join(' ')

        return (
          <g
            key={id}
            id={elementId}
            fill="none"
            strokeWidth={1.25}
            strokeLinejoin="round"
          >
            <polygon
              points={coordinates}
              stroke="white"
              vectorEffect="non-scaling-stroke"
            />
            <polygon
              points={coordinates}
              stroke="black"
              vectorEffect="non-scaling-stroke"
              strokeDasharray={tone === 'selected' ? '5 5' : '4 6'}
              className="animate-marching-ants motion-reduce:animate-none"
            />
          </g>
        )
      })}
    </svg>
  )
}
