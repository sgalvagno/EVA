export interface TraceResult { left: number; right: number; mark: number; lineY: number; }

// Extend an existing horizontal seed by following nearby dark runs column by column.
export function followEvaBaseline(mask: Uint8Array, width: number, height: number,
  seed: { left: number; right: number; lineY: number }): TraceResult | null {
  const dark = (x: number, y: number): boolean =>
    x >= 0 && x < width && y >= 0 && y < height && mask[y * width + x] === 1;
  const radius = Math.max(3, Math.round(width / 400));
  const maxGap = Math.max(3, Math.round(width / 200));
  const path = new Float32Array(width); path.fill(NaN);

  const locate = (x: number, predicted: number, search: number): number | null => {
    const low = Math.max(0, Math.floor(predicted - search));
    const high = Math.min(height - 1, Math.ceil(predicted + search));
    let chosen: number | null = null, bestDistance = Infinity;
    for (let y = low; y <= high; y++) {
      if (!dark(x, y)) continue;
      const start = y;
      while (y + 1 <= high && dark(x, y + 1)) y++;
      // At a vertical crossing, stay near the predicted baseline instead of following the marker.
      const candidate = y - start + 1 > radius * 2
        ? Math.max(start, Math.min(y, predicted)) : (start + y) / 2;
      const distance = Math.abs(candidate - predicted);
      if (distance < bestDistance) { bestDistance = distance; chosen = candidate; }
    }
    return chosen;
  };

  let anchorX = -1, anchorY = 0;
  const middle = Math.round((seed.left + seed.right) / 2);
  for (let offset = 0; offset <= seed.right - seed.left && anchorX < 0; offset++) {
    for (const x of offset ? [middle - offset, middle + offset] : [middle]) {
      if (x < seed.left || x > seed.right) continue;
      const y = locate(x, seed.lineY, radius + 3);
      if (y !== null) { anchorX = x; anchorY = y; break; }
    }
  }
  if (anchorX < 0) return null;
  path[anchorX] = anchorY;

  const walk = (direction: number): number => {
    let lastX = anchorX, lastY = anchorY, slope = 0;
    for (let x = anchorX + direction; x >= 0 && x < width; x += direction) {
      const distance = Math.abs(x - lastX);
      if (distance > maxGap + 1) break;
      const predicted = lastY + slope * distance;
      const y = locate(x, predicted, radius + Math.min(2, distance - 1));
      if (y === null) continue;
      const step = (y - lastY) / distance;
      if (Math.abs(step) > radius) continue;
      for (let k = 1; k <= distance; k++) path[lastX + direction * k] = lastY + step * k;
      slope = Math.max(-0.75, Math.min(0.75, slope * 0.7 + step * 0.3));
      lastX = x; lastY = y;
    }
    return lastX;
  };
  const left = walk(-1), right = walk(1);
  if (right - left < width * 0.3) return null;

  const reach = Math.max(8, Math.round((right - left) * 0.08));
  const skip = Math.max(4, Math.round(width / 240));
  const scores = new Uint32Array(width);
  let peak = 0;
  for (let x = left; x <= right; x++) {
    const y = Math.round(path[x]);
    let score = 0;
    for (let k = skip; k < reach; k++) {
      if (dark(x, y - k)) score++;
      if (dark(x, y + k)) score++;
    }
    scores[x] = score; peak = Math.max(peak, score);
  }
  if (!peak || peak < reach * 0.5) return null;
  const clusters: { x: number; score: number }[] = [];
  let sum = 0, count = 0, clusterPeak = 0;
  for (let x = left; x <= right + 1; x++) {
    if (x <= right && scores[x] > peak * 0.5) {
      sum += x; count++; clusterPeak = Math.max(clusterPeak, scores[x]);
    } else if (count) {
      clusters.push({ x: sum / count, score: clusterPeak });
      sum = 0; count = 0; clusterPeak = 0;
    }
  }
  const margin = (right - left) * 0.015;
  const inner = clusters.filter(c => c.x > left + margin && c.x < right - margin);
  const selected = (inner.length ? inner : clusters).sort((a, b) => b.score - a.score)[0];
  return selected ? { left, right, mark: selected.x, lineY: path[Math.round(selected.x)] } : null;
}
