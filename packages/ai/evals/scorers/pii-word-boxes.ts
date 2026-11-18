import { normalized } from '#evals/scorers/ocr'
import type { Box, Word } from '#stages/ocr/ocr-result'

/** Ground-truth PII text and its box in the scored PDF variant. */
export type PiiSpan = { text: string; box: Box }

function intersection(a: Box, b: Box): Box | null {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const width = Math.min(a.x + a.width, b.x + b.width) - x
  const height = Math.min(a.y + a.height, b.y + b.height) - y
  return width > 0 && height > 0 ? { x, y, width, height } : null
}

/** Exact area of a union of rectangles by coordinate compression. */
function unionArea(boxes: readonly Box[]) {
  const xs = [...new Set(boxes.flatMap((box) => [box.x, box.x + box.width]))]
  const ys = [...new Set(boxes.flatMap((box) => [box.y, box.y + box.height]))]
  xs.sort((a, b) => a - b)
  ys.sort((a, b) => a - b)

  let area = 0
  for (let i = 0; i + 1 < xs.length; i++) {
    for (let j = 0; j + 1 < ys.length; j++) {
      const [x0, x1, y0, y1] = [
        xs[i] ?? 0,
        xs[i + 1] ?? 0,
        ys[j] ?? 0,
        ys[j + 1] ?? 0,
      ]
      const covered = boxes.some(
        (box) =>
          box.x <= x0 &&
          x1 <= box.x + box.width &&
          box.y <= y0 &&
          y1 <= box.y + box.height
      )
      if (covered) area += (x1 - x0) * (y1 - y0)
    }
  }
  return area
}

function scoreRun(span: PiiSpan, boxes: readonly Box[]) {
  const union = unionArea(boxes)
  const inside = unionArea(
    boxes.flatMap((box) => intersection(box, span.box) ?? [])
  )

  return {
    coverage: inside / (span.box.width * span.box.height),
    overCoverage: union > 0 ? (union - inside) / union : 0,
  }
}

/**
 * Scores each PII span against the shortest reading-order word runs whose text contains it,
 * keeping the run that covers most of the span box. Unmatched spans score zero coverage.
 */
export function scorePiiWordBoxes(
  spans: readonly PiiSpan[],
  words: readonly Word[]
) {
  const tokens = words.map((word) => normalized(word.text))

  return spans.map((span) => {
    const target = normalized(span.text)
    const maxRun = 2 * target.split(' ').length + 2
    let best: { coverage: number; overCoverage: number | null } = {
      coverage: 0,
      overCoverage: null,
    }

    for (let start = 0; target && start < tokens.length; start++) {
      for (
        let end = start;
        end < tokens.length && end - start < maxRun;
        end++
      ) {
        if (
          !tokens
            .slice(start, end + 1)
            .join(' ')
            .includes(target)
        )
          continue

        // A run that still matches without its first word is scored from the next start.
        if (
          end === start ||
          !tokens
            .slice(start + 1, end + 1)
            .join(' ')
            .includes(target)
        ) {
          const score = scoreRun(
            span,
            words.slice(start, end + 1).map((word) => word.box)
          )
          if (
            score.coverage > best.coverage ||
            (score.coverage === best.coverage &&
              (best.overCoverage === null ||
                score.overCoverage < best.overCoverage))
          )
            best = score
        }
        break
      }
    }

    return best
  })
}

/** Span-mean coverage and matched-span-mean over-coverage; null when not applicable. */
export function summarizePiiWordBoxes(
  scores: readonly ReturnType<typeof scorePiiWordBoxes>[number][]
) {
  const matched = scores.flatMap((score) => score.overCoverage ?? [])

  return {
    coverage: scores.length
      ? scores.reduce((sum, score) => sum + score.coverage, 0) / scores.length
      : null,
    overCoverage: matched.length
      ? matched.reduce((sum, value) => sum + value, 0) / matched.length
      : null,
  }
}
