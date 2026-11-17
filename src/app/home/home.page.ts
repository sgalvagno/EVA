import { Component, ElementRef, ViewChild } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { EvaService, EvaResult, EvaAnalysis } from '../eva.service';

@Component({ selector: 'app-home', templateUrl: 'home.page.html', standalone: false })
export class HomePage {
  @ViewChild('cv', { static: true }) cv!: ElementRef<HTMLCanvasElement>;
  r: EvaResult | null = null;
  width = 0;
  pct: number | null = null;
  cm: number | null = null;
  hasImage = false;
  busy = false;
  useFilter = false;
  showMarkers = true;
  view: 'original' | 'filtered' | 'mask' = 'original';
  error = '';
  private src: HTMLCanvasElement | null = null;
  private analysis: EvaAnalysis | null = null;

  constructor(private eva: EvaService) {}

  async capture() {
    this.busy = true;
    this.error = '';
    try {
      const p = await Camera.getPhoto({
        quality: 90, resultType: CameraResultType.DataUrl, source: CameraSource.Camera,
      });
      if (!p.dataUrl) return;
      const source = await this.eva.load(p.dataUrl);
      this.src = source;
      this.width = source.width;
      this.hasImage = true;
      this.analyze();
    } catch {
      this.error = 'Photo non chargee : prise annulee ou erreur de camera.';
    } finally {
      this.busy = false;
    }
  }

  analyze() {
    if (!this.src) return;
    this.r = null;
    this.analysis = null;
    this.pct = this.cm = null;
    this.error = '';
    try {
      this.analysis = this.eva.analyze(this.src, this.useFilter);
      this.r = this.analysis.result ? { ...this.analysis.result } : null;
    } catch {
      this.error = 'Erreur pendant le traitement de la photo.';
    }
    this.refresh();
  }

  refresh() {
    if (!this.src) return;
    const c = this.cv.nativeElement;
    const ctx = c.getContext('2d')!;
    c.width = this.src.width; c.height = this.src.height;
    const image = this.view === 'filtered' ? this.analysis?.filtered
      : this.view === 'mask' ? this.analysis?.mask : this.src;
    ctx.drawImage(image ?? this.src, 0, 0);
    this.pct = this.cm = null;
    if (!this.r || this.r.right <= this.r.left) return;
    ({ pct: this.pct, cm: this.cm } = this.eva.compute(this.r));
    if (!this.showMarkers) return;
    const { left, right, mark, lineY } = this.r;
    const vertical = (x: number, color: string) => {
      ctx.strokeStyle = color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, lineY - 80); ctx.lineTo(x, lineY + 80); ctx.stroke();
    };
    vertical(left, 'lime'); vertical(right, 'lime'); vertical(mark, 'red');
  }
}
