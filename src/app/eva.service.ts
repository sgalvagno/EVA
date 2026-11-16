import { Injectable } from '@angular/core';

export interface EvaResult { left: number; right: number; mark: number; lineY: number; }

@Injectable({ providedIn: 'root' })
export class EvaService {

  async load(dataUrl: string, maxW = 1200): Promise<HTMLCanvasElement> {
    const img = new Image();
    await new Promise<void>((r, e) => { img.onload = () => r(); img.onerror = e; img.src = dataUrl; });
    const s = Math.min(1, maxW / img.width);
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  detect(c: HTMLCanvasElement): EvaResult | null {
    const W = c.width, H = c.height;
    const d = c.getContext('2d')!.getImageData(0, 0, W, H).data;
    const g = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) g[i] = (d[i*4]*0.299 + d[i*4+1]*0.587 + d[i*4+2]*0.114) | 0;

    const t = this.otsu(g);
    const dark = (x: number, y: number) => g[y * W + x] < t * 0.85;

    const rows = new Array(H).fill(0);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (dark(x, y)) rows[y]++;
    let lineY = 0, best = 0;
    for (let y = 3; y < H - 3; y++) {
      const s = rows[y-3] + rows[y-2] + rows[y-1] + rows[y] + rows[y+1] + rows[y+2] + rows[y+3];
      if (s > best) { best = s; lineY = y; }
    }

    const band = (x: number) => { for (let y = lineY - 3; y <= lineY + 3; y++) if (dark(x, y)) return true; return false; };
    let bestRun = [0, 0], start = -1, gap = 0;
    for (let x = 0; x < W; x++) {
      if (band(x)) { if (start < 0) start = x; gap = 0; if (x - start > bestRun[1] - bestRun[0]) bestRun = [start, x]; }
      else if (start >= 0 && ++gap > 6) { start = -1; gap = 0; }
    }
    const [left, right] = bestRun;
    if (right - left < W * 0.3) return null;

    const reach = Math.round((right - left) * 0.08), skip = 5;
    const score = new Array(W).fill(0);
    for (let x = left; x <= right; x++) {
      let n = 0;
      for (let k = skip; k < reach; k++) {
        if (lineY - k >= 0 && dark(x, lineY - k)) n++;
        if (lineY + k < H && dark(x, lineY + k)) n++;
      }
      score[x] = n;
    }
    const max = Math.max(...score);
    if (max < reach * 0.5) return null;

    const clusters: { x: number; s: number }[] = [];
    let cur: number[] = [];
    for (let x = left; x <= right + 1; x++) {
      if (score[x] > max * 0.5) cur.push(x);
      else if (cur.length) {
        clusters.push({ x: cur.reduce((a, b) => a + b) / cur.length, s: Math.max(...cur.map(i => score[i])) });
        cur = [];
      }
    }
    const margin = (right - left) * 0.015;
    const inner = clusters.filter(k => k.x > left + margin && k.x < right - margin);
    const pick = (inner.length ? inner : clusters).sort((a, b) => b.s - a.s)[0];
    return { left, right, mark: pick.x, lineY };
  }

  compute(r: { left: number; right: number; mark: number }, rulerCm = 10) {
    const pct = Math.min(100, Math.max(0, ((r.mark - r.left) / (r.right - r.left)) * 100));
    return { pct: +pct.toFixed(1), cm: +(pct / 100 * rulerCm).toFixed(2) };
  }

  private otsu(g: Uint8Array): number {
    const h = new Array(256).fill(0); g.forEach(v => h[v]++);
    const total = g.length; let sum = 0; for (let i = 0; i < 256; i++) sum += i * h[i];
    let sB = 0, wB = 0, max = 0, th = 128;
    for (let i = 0; i < 256; i++) {
      wB += h[i]; if (!wB) continue;
      const wF = total - wB; if (!wF) break;
      sB += i * h[i];
      const mB = sB / wB, mF = (sum - sB) / wF;
      const v = wB * wF * (mB - mF) ** 2;
      if (v > max) { max = v; th = i; }
    }
    return th;
  }
}
