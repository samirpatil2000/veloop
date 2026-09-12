export class LoopBuffer<T> {
  private readonly items: T[] = [];

  constructor(private readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error("LoopBuffer capacity must be a positive integer");
    }
  }

  push(item: T): void {
    if (this.items.length === this.capacity) this.items.shift();
    this.items.push(item);
  }

  get length(): number {
    return this.items.length;
  }

  get maxLength(): number {
    return this.capacity;
  }

  values(): T[] {
    return [...this.items];
  }

  clear(): void {
    this.items.length = 0;
  }

  take(): T[] {
    const result = this.values();
    this.clear();
    return result;
  }
}
