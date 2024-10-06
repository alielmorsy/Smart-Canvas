
export type BoundingBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type QuadTreeBoundary = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export class QuadTree {
  private boundary: QuadTreeBoundary;
  private capacity: number;
  private drawings: Drawing[];
  private divided: boolean;
  private northeast?: QuadTree;
  private northwest?: QuadTree;
  private southeast?: QuadTree;
  private southwest?: QuadTree;

  constructor(boundary: QuadTreeBoundary, capacity: number) {
    this.boundary = boundary;
    this.capacity = capacity;
    this.drawings = [];
    this.divided = false;
  }

  insert(drawing: Drawing): boolean {
    if (!this.intersectsBoundary(this.calculateBoundingBox(drawing))) {
      return false;
    }

    if (this.drawings.length < this.capacity) {
      this.drawings.push(drawing);
      return true;
    }

    if (!this.divided) {
      this.subdivide();
    }

    return (
      this.northeast!.insert(drawing) ||
      this.northwest!.insert(drawing) ||
      this.southeast!.insert(drawing) ||
      this.southwest!.insert(drawing)
    );
  }

  private subdivide(): void {
    const x = this.boundary.x;
    const y = this.boundary.y;
    const w = this.boundary.w / 2;
    const h = this.boundary.h / 2;

    this.northeast = new QuadTree(
      { x: x + w, y: y - h, w: w, h: h },
      this.capacity,
    );
    this.northwest = new QuadTree(
      { x: x - w, y: y - h, w: w, h: h },
      this.capacity,
    );
    this.southeast = new QuadTree(
      { x: x + w, y: y + h, w: w, h: h },
      this.capacity,
    );
    this.southwest = new QuadTree(
      { x: x - w, y: y + h, w: w, h: h },
      this.capacity,
    );

    this.divided = true;
  }

  queryRange(range: BoundingBox): Drawing[] {
    let foundDrawings: Drawing[] = [];
    if (!this.intersectsBoundary(range)) {
      return foundDrawings;
    }

    for (let drawing of this.drawings) {
      if (this.drawingIntersectsRange(drawing, range)) {
        foundDrawings.push(drawing);
      }
    }

    if (this.divided) {
      foundDrawings = foundDrawings.concat(
        this.northeast!.queryRange(range),
        this.northwest!.queryRange(range),
        this.southeast!.queryRange(range),
        this.southwest!.queryRange(range),
      );
    }

    return foundDrawings;
  }

  private intersectsBoundary(range: BoundingBox): boolean {
    return !(
      range.minX > this.boundary.x + this.boundary.w ||
      range.maxX < this.boundary.x - this.boundary.w ||
      range.minY > this.boundary.y + this.boundary.h ||
      range.maxY < this.boundary.y - this.boundary.h
    );
  }

  private drawingIntersectsRange(
    drawing: Drawing,
    range: BoundingBox,
  ): boolean {
    const bbox = this.calculateBoundingBox(drawing);
    return !(
      bbox.minX > range.maxX ||
      bbox.maxX < range.minX ||
      bbox.minY > range.maxY ||
      bbox.maxY < range.minY
    );
  }

  private calculateBoundingBox(drawing: Drawing): BoundingBox {
    return {
      minX: Math.min(drawing.x0, drawing.x1),
      minY: Math.min(drawing.y0, drawing.y1),
      maxX: Math.max(drawing.x0, drawing.x1),
      maxY: Math.max(drawing.y0, drawing.y1),
    };
  }
}

class Eraser {
  private size: number;

  constructor(size: number) {
    this.size = size;
  }

  erase(quadTree: QuadTree, x: number, y: number): Drawing[] {
    const range: BoundingBox = {
      minX: x - this.size / 2,
      minY: y - this.size / 2,
      maxX: x + this.size / 2,
      maxY: y + this.size / 2,
    };

    const potentialDrawings = quadTree.queryRange(range);
    return potentialDrawings.filter(
      (drawing) => !this.intersects(drawing, x, y),
    );
  }

  private intersects(drawing: Drawing, x: number, y: number): boolean {
    const distToStart = this.distanceToPoint(x, y, drawing.x0, drawing.y0);
    const distToEnd = this.distanceToPoint(x, y, drawing.x1, drawing.y1);

    if (distToStart <= this.size / 2 || distToEnd <= this.size / 2) {
      return true;
    }

    const lineLength = this.distanceToPoint(
      drawing.x0,
      drawing.y0,
      drawing.x1,
      drawing.y1,
    );
    if (lineLength === 0) return false;

    const t =
      ((x - drawing.x0) * (drawing.x1 - drawing.x0) +
        (y - drawing.y0) * (drawing.y1 - drawing.y0)) /
      (lineLength * lineLength);

    if (t < 0 || t > 1) return false;

    const projX = drawing.x0 + t * (drawing.x1 - drawing.x0);
    const projY = drawing.y0 + t * (drawing.y1 - drawing.y0);

    return this.distanceToPoint(x, y, projX, projY) <= this.size / 2;
  }

  private distanceToPoint(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): number {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }
}
