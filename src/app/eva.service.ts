import { Injectable } from '@angular/core';
import { followEvaBaseline } from './eva-trace';

export interface EvaResult { left: number; right: number; mark: number; lineY: number; }
export interface EvaAnalysis {
  result: EvaResult | null;
  filtered: HTMLCanvasElement;
  mask: HTMLCanvasElement;
}

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

  detect(c: HTMLCanvasElement, useFilter = false): EvaResult | null {
    return this.analyze(c, useFilter).result;
  }

  analyze(c: HTMLCanvasElement, useFilter = false): EvaAnalysis {
    const W = c.width, H = c.height;
    if (!W || !H) throw new Error('Image vide');
    const data = c.getContext('2d')!.getImageData(0, 0, W, H).data;
    const gray = new Uint8Array(W * H);
    for (let i = 0; i < gray.length; i++) {
      gray[i] = Math.round(data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114);
    }
    const filtered = this.highPassDarkLines(gray, W, H);
    const input = useFilter ? filtered : gray;
    let min = 255, max = 0;
    for (const value of input) { min = Math.min(min, value); max = Math.max(max, value); }
    const mask = new Uint8Array(input.length);
    if (max - min >= 12) {
      const threshold = this.otsu(input);
      for (let i = 0; i < input.length; i++) {
        mask[i] = input[i] <= threshold && input[i] < 243 ? 1 : 0;
      }
    }
    const maskGray = new Uint8Array(mask.length);
    for (let i = 0; i < mask.length; i++) maskGray[i] = mask[i] ? 0 : 255;
    return {
      result: this.detectMask(mask, W, H),
      filtered: this.toCanvas(filtered, W, H),
      mask: this.toCanvas(maskGray, W, H)
    };
  }

  private toCanvas(gray: Uint8Array, width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const image = ctx.createImageData(width, height);
    for (let i = 0; i < gray.length; i++) {
      image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = gray[i];
      image.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  }

  private detectMask(mask: Uint8Array, W: number, H: number): EvaResult | null {
    if (W < 8 || H < 8) return null;
    const dark = (x: number, y: number): boolean =>
      x >= 0 && x < W && y >= 0 && y < H && mask[y * W + x] === 1;
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
    return followEvaBaseline(mask, W, H, { left, right, lineY });
  }

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
        const response = Math.max(0, sum / size - gray[i]);
        result[i] = Math.round(255 - Math.min(255, gain * response));
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
