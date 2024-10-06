import { useEffect, useRef, useState } from "react";
import { useIdleTimer } from "react-idle-timer";
import { QuadTreeBoundary } from "./utils.ts";
import { Shape, Shapes, Drawing, SolutionPosition } from "./types";

interface UseCanvasProps {
  initialColor?: string;
}

enum PressedButton {
  None = -1,
  LEFT = 0,
  RIGHT = 1,
}

interface DrawingState {
  scale: number;
  offsetX: number;
  offsetY: number;
  prevCursorX: number;
  prevCursorY: number;
}


type onIdleType = (shape: Shapes) => void;

const DoublePI = Math.PI * 2;
const drawPoint = (ctx, x, y, pointSize = 1) => {
  pointSize *= 2;
  ctx.beginPath();
  ctx.arc(x, y, pointSize, 0, DoublePI); // Draw circle at (x, y)
  ctx.fill();
};

function isDrawingUnderEraser(
  drawing: Drawing,
  eraserPos: { x: number; y: number },
  eraserSize: number
): boolean {
  const distToStart = distanceToPoint(
    eraserPos.x,
    eraserPos.y,
    drawing.x0,
    drawing.y0
  );
  const distToEnd = distanceToPoint(
    eraserPos.x,
    eraserPos.y,
    drawing.x1,
    drawing.y1
  );
  const halfEraser = eraserSize / 2;
  if (distToStart <= halfEraser || distToEnd <= halfEraser) {
    return true;
  }

  const lineLength = distanceToPoint(
    drawing.x0,
    drawing.y0,
    drawing.x1,
    drawing.y1
  );
  if (lineLength === 0) return true;

  const t =
    ((eraserPos.x - drawing.x0) * (drawing.x1 - drawing.x0) +
      (eraserPos.y - drawing.y0) * (drawing.y1 - drawing.y0)) /
    (lineLength * lineLength);

  if (t < 0 || t > 1) return false;

  const projX = drawing.x0 + t * (drawing.x1 - drawing.x0);
  const projY = drawing.y0 + t * (drawing.y1 - drawing.y0);

  return (
    distanceToPoint(eraserPos.x, eraserPos.y, projX, projY) <= eraserSize / 3
  );
}

function distanceToPoint(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

const useCanvas = ({ initialColor = "#f5f5f5" }: UseCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D>();
  const shapesRef = useRef<Shapes>([]);
  const shapesTillIdleRef = useRef<Shapes>([]);
  const pressedButtonRef = useRef(PressedButton.None);
  const isGrabbed = useRef<boolean>(false);

  const onIdleRef = useRef<onIdleType>();

  const colorRef = useRef<string>(initialColor!);
  const lineColor = useRef("#000");

  const isEraser = useRef<boolean>(false);
  const eraserSizeRef = useRef(20);
  const onIdle = () => {
    if (onIdleRef.current) {

      if (shapesTillIdleRef.current.length > 0) {
        let shapes = shapesTillIdleRef.current;
        shapes = shapes.map((shape) => {
          const newShape: Shape = [];
          let { offsetX, offsetY } = stateRef.current;
          for (const drawing of shape) {
            const newDrawing: Drawing = {
              x0: toScreen(drawing.x0, offsetX),
              x1: toScreen(drawing.x1, offsetX),
              y0: toScreen(drawing.y0, offsetY),
              y1: toScreen(drawing.y1, offsetY),
              lineColor: drawing.lineColor
            };
            newShape.push(newDrawing);
          }
          return newShape;
        });
        onIdleRef.current(shapes);
        shapesTillIdleRef.current = [];
      }
    }
  };
  const { remainingTime } = useIdleTimer({
    element: canvasRef.current as HTMLElement,
    onIdle,
    timeout: 3_000,
    throttle: 500
  });
  const stateRef = useRef<DrawingState>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    prevCursorX: 0,
    prevCursorY: 0
  });

  const toScreen = (True, offset) => {
    const scale = stateRef.current.scale;
    return (True + offset) * scale;
  };
  const toTrue = (screen, offset) => {
    const scale = stateRef.current.scale;
    return screen / scale - offset;
  };

  const redrawCanvas = () => {
    clearCanvas();
    //

    const { offsetX, offsetY } = stateRef.current;
    const canvasWidth = canvasRef.current!.clientWidth;
    const canvasHeight = canvasRef.current!.clientHeight;
    for (const drawings of shapesRef.current) {
      for (const drawing of drawings) {
        const newDrawing: Drawing = {
          x0: toScreen(drawing.x0, offsetX),
          x1: toScreen(drawing.x1, offsetX),
          y0: toScreen(drawing.y0, offsetY),
          y1: toScreen(drawing.y1, offsetY),
          lineColor: drawing.lineColor,
          type: drawing.type,
          value: drawing.value
        };
        // to gain performance
        if (
          (newDrawing.x0 < 0 && newDrawing.x1 < 0) ||
          (newDrawing.x0 > canvasWidth && newDrawing.x1 > canvasWidth) ||
          (newDrawing.y0 < 0 && newDrawing.y1 < 0) ||
          (newDrawing.y0 > canvasHeight && newDrawing.y1 > canvasHeight)
        ) {
          continue;
        }
        drawLine(newDrawing);
      }
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current!;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    const context = contextRef.current!;
    context.fillStyle = colorRef.current;
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawGrid();
  };
  const drawGrid = () => {
    const { offsetX, offsetY, scale } = stateRef.current;
    let spacing = 20 * scale;
    const canvas = canvasRef.current!;
    const context = contextRef.current!;
    context.fillStyle = "#e0e0e0"; // Color of the grid points

    for (let x = spacing; x < canvas.clientWidth; x += spacing) {
      for (let y = spacing; y < canvas.clientHeight; y += spacing) {
        let realX = toTrue(x, offsetX);
        let realY = toTrue(y, offsetY);
        drawPoint(context, x, y, scale); // Draw point at (x, y)
      }
    }
  };
  const drawLine = (drawing: Drawing) => {
    const context = contextRef.current!;
    context.strokeStyle = drawing.lineColor;
    if (drawing.type === "text") {
      context.fillStyle = drawing.lineColor;
      context.font = Math.min(drawing.x1 - drawing.x0, drawing.y1 - drawing.y0) + "px serif";
      context.fillText(drawing.value!, drawing.x0, drawing.y0);
      return;
    }

    context.beginPath();

    context.lineWidth = 3;
    context.moveTo(drawing.x0, drawing.y0);
    context.lineTo(drawing.x1, drawing.y1);

    context.stroke();
  };

  const eraseDrawings = (x: number, y: number) => {
    const { offsetX, offsetY, scale } = stateRef.current;
    const trueX = toTrue(x, offsetX);
    const trueY = toTrue(y, offsetY);

    // Shared eraser check logic
    const isNotUnderEraser = (drawing: Drawing, x: number, y: number) =>
      !isDrawingUnderEraser(drawing, { x, y }, eraserSizeRef.current);

    // Set to track erased drawings
    const erasedShapesSet = new Set<Drawing>();

    const newShapes = [];
    // Filter shapesRef and track erased shapes
    for (const shape of shapesRef.current) {
      const newShape = shape.filter(drawing => {
        const shouldKeep = isNotUnderEraser(drawing, trueX, trueY);
        if (!shouldKeep) erasedShapesSet.add(drawing); // Track erased shape
        return shouldKeep;
      });
      if (newShape.length > 0) {
        newShapes.push(newShape);
      }
    }
    shapesRef.current = newShapes;
    const idleShapes = [];
    for (const shape of shapesTillIdleRef.current) {
      const newShape = shape.filter(drawing => {
        return !erasedShapesSet.has(drawing);
      });
      if (newShape.length > 0) {
        idleShapes.push(newShape);
      }
    }

    shapesTillIdleRef.current = idleShapes;
    redrawCanvas();
  };

  const onMouseDown = (event) => {
    if (event.button === 0) {
      shapesRef.current.push([]);
      pressedButtonRef.current = PressedButton.LEFT;
    } else if (event.button === 2 || event.button === 1) {
      const canvas = canvasRef.current!;
      pressedButtonRef.current = PressedButton.RIGHT;
      isGrabbed.current = true;
    }
    const pageX = event.pageX;
    const pageY = event.pageY;

    stateRef.current.prevCursorX = pageX;
    stateRef.current.prevCursorY = pageY;

  };
  const onMouseUp = (event) => {
    event.preventDefault();
    if (pressedButtonRef.current == PressedButton.LEFT && !isEraser.current) {
      const lastShape = shapesRef.current[shapesRef.current.length - 1];
      if (lastShape.length > 0) {

        shapesTillIdleRef.current.push(lastShape);
      }
    }
    pressedButtonRef.current = PressedButton.None;
    const canvas = canvasRef.current!;
    isGrabbed.current = false;

  };
  const onMouseMove = (event: MouseEvent) => {
    if (pressedButtonRef.current === PressedButton.None) {
      return;
    }
    let cursorX = event.pageX;
    let cursorY = event.pageY;
    let { scale, offsetX, offsetY, prevCursorX, prevCursorY } =
      stateRef.current;

    const scaledX = toTrue(cursorX, offsetX);
    const scaledY = toTrue(cursorY, offsetY);
    const prevScaledX = toTrue(prevCursorX, offsetX);
    const prevScaledY = toTrue(prevCursorY, offsetY);

    const dx = cursorX - prevCursorX;
    const dy = cursorY - prevCursorY;
    if (pressedButtonRef.current === PressedButton.LEFT) {
      if (isEraser.current) {
        eraseDrawings(cursorX, cursorY);
        return;
      }
      const canvas = canvasRef.current!;
      const drawing: Drawing = {
        x0: prevScaledX,
        y0: prevScaledY,
        x1: scaledX,
        y1: scaledY,
        lineColor: lineColor.current
      };
      shapesRef.current[shapesRef.current.length - 1].push(drawing);

      drawLine({
        x0: prevCursorX,
        y0: prevCursorY,
        x1: cursorX,
        y1: cursorY,
        lineColor: lineColor.current
      });
    } else {
      if (shapesRef.current.length == 0) return;

      stateRef.current.offsetX += dx;
      stateRef.current.offsetY += dy;
      redrawCanvas();
    }

    // Update previous cursor positions for the next movement
    stateRef.current.prevCursorX = cursorX;
    stateRef.current.prevCursorY = cursorY;
  };
  const onMouseWheel = (event: WheelEvent) => {
    const canvas = canvasRef.current!;
    let { scale, offsetX, offsetY } = stateRef.current;

    const deltaY = event.deltaY;
    const scaleAmount = -deltaY / 500; // Adjust the denominator for sensitivity
    scale *= 1 + scaleAmount;
    if (scale < 0.3 || scale > 3) {
      return;
    }
    stateRef.current.scale = scale; // Store the new scale

    const distX = (event.pageX - canvas.offsetLeft) / canvas.clientWidth;
    const distY = (event.pageY - canvas.offsetTop) / canvas.clientHeight;

    // Calculate how much to adjust the offsets based on zoom
    const unitsZoomedX = (canvas.clientWidth / scale) * scaleAmount;
    const unitsZoomedY = (canvas.clientHeight / scale) * scaleAmount;

    const unitsAddLeft = unitsZoomedX * distX;
    const unitsAddTop = unitsZoomedY * distY;

    // Update offsets accordingly
    stateRef.current.offsetX -= unitsAddLeft;
    stateRef.current.offsetY -= unitsAddTop;
    redrawCanvas();
  };
  useEffect(() => {
    const canvas = canvasRef.current!;
    const context = canvas.getContext("2d");
    const canvasBoundary: QuadTreeBoundary = {
      x: canvas.width / 2,
      y: canvas.height / 2,
      w: canvas.width / 2,
      h: canvas.height / 2
    };
    contextRef.current = context;
    redrawCanvas();
    window.addEventListener("resize", redrawCanvas);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp, false);
    canvas.addEventListener("mouseout", onMouseUp, false);
    canvas.addEventListener("mousemove", onMouseMove, false);
    canvas.addEventListener("wheel", onMouseWheel, { passive: true });
    document.oncontextmenu = function() {
      return false;
    };

    return () => {
      window.removeEventListener("resize", redrawCanvas);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mouseup", onMouseUp, false);
      canvas.removeEventListener("mouseout", onMouseUp, false);
      document.removeEventListener("wheel", onMouseWheel, false);
      document.oncontextmenu = function() {
        return true;
      };
    };
  }, []);
  useEffect(() => {
    const context = contextRef.current!;
    context.lineCap = "round";
    context.lineJoin = "round";

  }, []);
  useEffect(() => {
    let lastFrameTime = 0;
    let frameCount = 0;
    let fps = 0;
    let lastFpsUpdate = 0;
    const ctx = contextRef.current!;
    const canvas = canvasRef.current!;

    function updateFrameRate(timestamp) {
      // Increment frame count
      frameCount++;

      // Calculate time since the last FPS update
      const timeSinceLastUpdate = (timestamp - lastFpsUpdate) / 1000;

      // Update FPS every second (or close to it)
      if (timeSinceLastUpdate >= 1) {
        fps = frameCount / timeSinceLastUpdate; // Calculate the FPS
        lastFpsUpdate = timestamp; // Reset the time
        frameCount = 0; // Reset the frame count

        // Clear the previous FPS text
        ctx.clearRect(canvas.width - 150, 0, canvas.width, 20); // Clear a small rectangle at the top-right
        // Draw the FPS text
        ctx.font = "16px Arial";
        ctx.fillStyle = "black";
        ctx.textAlign = "right";
        ctx.fillText(`FPS: ${Math.round(fps)}`, canvas.width - 10, 20); // 10px padding from the right
      }
    }

    function animate(timestamp) {
      updateFrameRate(timestamp);
      requestAnimationFrame(animate); // Continue the animation loop
    }

    requestAnimationFrame(animate);
  });
  const api = {
    timeTillIdle: () => remainingTime,
    clear: () => {
      shapesRef.current = [];
      shapesTillIdleRef.current = [];
      clearCanvas();
    },
    onIdle: (e: onIdleType) => (onIdleRef.current = e),
    isGrabbing: () => isGrabbed.current,
    setEraser: (isEraserActive: boolean) => {
      isEraser.current = isEraserActive;
    },
    setEraserSize: (size: number) => {
      eraserSizeRef.current = size * 1.1;
    },
    putText(text: string, position: SolutionPosition) {
      const context = contextRef.current!;
      context.font = Math.max(position.width, position.height) + "px serif";
      context.fillText(text, position.x, position.y);
      let { offsetX, offsetY } = stateRef.current;
      const x = toTrue(position.x, offsetX);
      const y = toTrue(position.y, offsetY);
      const drawing: Drawing = {
        x0: x,
        y0: y,
        x1: toTrue(x + position.width, offsetX),
        y1: toTrue(y + position.height, offsetY),
        lineColor: "black",
        type: "text",
        value: text
      };
      shapesRef.current.push([drawing]);
    }
  };
  return [canvasRef, api];
};
export default useCanvas;
