import { Injectable } from '@angular/core';

export interface EvaResult { left: number; right: number; mark: number; lineY: number; }

@Injectable({ providedIn: 'root' })
export class EvaService {
  async load(dataUrl: string, maxW = 1200): Promise<HTMLCanvasElement> {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve(); img.onerror = reject; img.src = dataUrl;
    });
    const scale = Math.min(1, maxW / img.width);
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  detect(c: HTMLCanvasElement): EvaResult | null {
    const W = c.width, H = c.height;
    if (W < 8 || H < 8) return null;
    const d = c.getContext('2d')!.getImageData(0, 0, W, H).data;
    const gray = new Uint8Array(W * H);
    for (let i = 0; i < gray.length; i++) {
      gray[i] = Math.round(d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114);
    }
    const g = this.highPassDarkLines(gray, W, H);
    let min = 255, maxValue = 0;
    for (const value of g) { min = Math.min(min, value); maxValue = Math.max(maxValue, value); }
    if (maxValue - min < 12) return null;
    const threshold = this.otsu(g);
    const dark = (x: number, y: number): boolean =>
      x >= 0 && x < W && y >= 0 && y < H && g[y * W + x] <= threshold && g[y * W + x] < 243;

    const rows = new Uint32Array(H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (dark(x, y)) rows[y]++;
    let lineY = 3, best = 0;
    for (let y = 3; y < H - 3; y++) {
      let sum = 0;
      for (let k = -3; k <= 3; k++) sum += rows[y + k];
      if (sum > best) { best = sum; lineY = y; }
    }
    if (!best) return null;
    const band = (x: number): boolean => {
      for (let y = lineY - 3; y <= lineY + 3; y++) if (dark(x, y)) return true;
      return false;
    };
    let left = 0, right = 0, start = -1, gap = 0;
    for (let x = 0; x < W; x++) {
      if (band(x)) {
        if (start < 0) start = x;
        gap = 0;
        if (x - start > right - left) { left = start; right = x; }
      } else if (start >= 0 && ++gap > 6) { start = -1; gap = 0; }
    }
    if (right - left < W * 0.3) return null;
    const reach = Math.round((right - left) * 0.08), skip = 5;
    const score = new Uint32Array(W);
    let maxScore = 0;
    for (let x = left; x <= right; x++) {
      let count = 0;
      for (let k = skip; k < reach; k++) {
        if (dark(x, lineY - k)) count++;
        if (dark(x, lineY + k)) count++;
      }
      score[x] = count;
      maxScore = Math.max(maxScore, count);
    }
    if (!maxScore || maxScore < reach * 0.5) return null;
    const clusters: { x: number; s: number }[] = [];
    let sumX = 0, countX = 0, peak = 0;
    for (let x = left; x <= right + 1; x++) {
      if (x <= right && score[x] > maxScore * 0.5) {
        sumX += x; countX++; peak = Math.max(peak, score[x]);
      } else if (countX) {
        clusters.push({ x: sumX / countX, s: peak });
        sumX = 0; countX = 0; peak = 0;
      }
    }
    const margin = (right - left) * 0.015;
    const inner = clusters.filter(k => k.x > left + margin && k.x < right - margin);
    const pick = (inner.length ? inner : clusters).sort((a, b) => b.s - a.s)[0];
    return pick ? { left, right, mark: pick.x, lineY } : null;
  }

  // Signed high-pass = gray - local mean. Keep only dark features,
  // then invert to preserve the detector's dark-on-white convention.
  private highPassDarkLines(gray: Uint8Array, width: number, height: number, radius = 12, gain = 3): Uint8Array {
    const horizontal = new Float32Array(gray.length);
    const result = new Uint8Array(gray.length);
    for (let y = 0; y < height; y++) {
      const offset = y * width;
      let sum = 0;
      for (let x = 0; x <= Math.min(radius, width - 1); x++) sum += gray[offset + x];
      for (let x = 0; x < width; x++) {
        if (x > 0) {
          if (x + radius < width) sum += gray[offset + x + radius];
          if (x - radius - 1 >= 0) sum -= gray[offset + x - radius - 1];
        }
        const size = Math.min(width - 1, x + radius) - Math.max(0, x - radius) + 1;
        horizontal[offset + x] = sum / size;
      }
    }
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let y = 0; y <= Math.min(radius, height - 1); y++) sum += horizontal[y * width + x];
      for (let y = 0; y < height; y++) {
        if (y > 0) {
          if (y + radius < height) sum += horizontal[(y + radius) * width + x];
          if (y - radius - 1 >= 0) sum -= horizontal[(y - radius - 1) * width + x];
        }
        const size = Math.min(height - 1, y + radius) - Math.max(0, y - radius) + 1;
        const i = y * width + x;
        const darkResponse = Math.max(0, sum / size - gray[i]);
        result[i] = Math.round(255 - Math.min(255, gain * darkResponse));
      }
    }
    return result;
  }

  compute(r: { left: number; right: number; mark: number }, rulerCm = 10) {
    if (r.right <= r.left) throw new Error('Extremites invalides');
    const pct = Math.min(100, Math.max(0, (r.mark - r.left) / (r.right - r.left) * 100));
    return { pct: +pct.toFixed(1), cm: +(pct / 100 * rulerCm).toFixed(2) };
  }

  private otsu(g: Uint8Array): number {
    const histogram = new Uint32Array(256);
    for (const value of g) histogram[value]++;
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * histogram[i];
    let backgroundSum = 0, backgroundWeight = 0, best = -1, threshold = 128;
    for (let i = 0; i < 256; i++) {
      backgroundWeight += histogram[i];
      if (!backgroundWeight) continue;
      const foregroundWeight = g.length - backgroundWeight;
      if (!foregroundWeight) break;
      backgroundSum += i * histogram[i];
      const delta = backgroundSum / backgroundWeight - (sum - backgroundSum) / foregroundWeight;
      const variance = backgroundWeight * foregroundWeight * delta * delta;
      if (variance > best) { best = variance; threshold = i; }
    }
    return threshold;
  }
}
