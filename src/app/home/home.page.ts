import { Component, ElementRef, ViewChild } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { EvaService, EvaResult } from '../eva.service';

@Component({ selector: 'app-home', templateUrl: 'home.page.html', standalone: false })
export class HomePage {
  @ViewChild('cv') cv!: ElementRef<HTMLCanvasElement>;
  r: EvaResult | null = null;
  width = 0;
  pct = 0; cm = 0;
  private src!: HTMLCanvasElement;

  constructor(private eva: EvaService) {}

  async capture() {
    const p = await Camera.getPhoto({
      quality: 90, resultType: CameraResultType.DataUrl, source: CameraSource.Camera,
    });
    this.src = await this.eva.load(p.dataUrl!);
    this.width = this.src.width;
    this.r = this.eva.detect(this.src) ?? {
      left: this.width * 0.1, right: this.width * 0.9, mark: this.width * 0.5, lineY: this.src.height / 2,
    };
    setTimeout(() => this.refresh());
  }

  refresh() {
    if (!this.r) return;
    const c = this.cv.nativeElement, ctx = c.getContext('2d')!;
    c.width = this.src.width; c.height = this.src.height;
    ctx.drawImage(this.src, 0, 0);
    const { left, right, mark, lineY } = this.r;
    const v = (x: number, col: string) => {
      ctx.strokeStyle = col; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, lineY - 80); ctx.lineTo(x, lineY + 80); ctx.stroke();
    };
    v(left, 'lime'); v(right, 'lime'); v(mark, 'red');
    ({ pct: this.pct, cm: this.cm } = this.eva.compute(this.r));
  }
}
