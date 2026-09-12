export class MediaEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly output: MediaStream;

  constructor(
    width = 1280,
    height = 720,
    fps = 30,
  ) {
    const canvas = document.getElementById("output");
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error("Output canvas missing");
    }

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D canvas context unavailable");

    canvas.width = width;
    canvas.height = height;

    this.canvas = canvas;
    this.ctx = ctx;
    this.output = canvas.captureStream(fps);
  }

  render(source: CanvasImageSource): void {
    this.ctx.drawImage(source, 0, 0, this.canvas.width, this.canvas.height);
  }

  getOutputStream(): MediaStream {
    return this.output;
  }
}
