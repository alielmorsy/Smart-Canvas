export type Drawing = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  lineColor: string;
  type?: string
  value?: string
};

export interface Options {
  size?: number;
}

export interface ToolBarProps {
  onOptionChange: (value: string, options?: Options) => void;
}

export interface PositionProps {
  left: string | number;
  top: string | number;
}

export interface CanvasProps {
  className?: string;
}

export type Shape = Drawing[]
export type Shapes = Shape[]

export interface NewCanvasInfo {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface SolutionPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BackendResponse {
  status: number;
  message: string;
  event?: string;
  task_id?: string;
  value?: string;
  position?: SolutionPosition;
}