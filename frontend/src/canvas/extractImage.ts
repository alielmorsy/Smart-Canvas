import {NewCanvasInfo, Shape, Shapes} from "./types";

const getCanvasInfo = (shapes: Shapes): NewCanvasInfo => {

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    shapes.forEach(shape => {
        shape.forEach(({x0, y0, x1, y1}) => {
            // Update bounding box values
            minX = Math.min(minX, x0, x1);
            minY = Math.min(minY, y0, y1);
            maxX = Math.max(maxX, x0, x1);
            maxY = Math.max(maxY, y0, y1);
        });
    });

    const width = maxX - minX + 50;
    const height = maxY - minY + 50;
    minX -= 20
    minY -= 20
    minX = Math.max(minX, 0)
    minY = Math.max(minY, 0)
    return {minX, minY, maxX, maxY, width, height};
}
const Extractor = (shapes: Shapes): [string, NewCanvasInfo] => {

    const info = getCanvasInfo(shapes)
    let {minX, minY, width, height} = info

    const newCanvas = document.createElement('canvas');
    newCanvas.width = width;
    newCanvas.height = height;
    newCanvas.style.zIndex = "-100"
    newCanvas.style.position = "absolute";

    const context = newCanvas.getContext('2d');
    context.fillStyle = "#fff"
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "#000"
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 3;
// Step 4: Draw the translated lines onto the new canvas
    shapes.forEach(shape => {
        shape.forEach(({x0, y0, x1, y1, lineColor}) => {
            context.beginPath();
            context.moveTo(x0 - minX, y0 - minY);  // Translate the starting point
            context.lineTo(x1 - minX, y1 - minY);  // Translate the ending point
            context.stroke();
            context.stroke();
        });

    });

    document.body.appendChild(newCanvas);
    let imageUrl = newCanvas.toDataURL("image/png");
    let base64String = imageUrl.replace(/^data:image\/(png|jpeg);base64,/, '');

    document.body.removeChild(newCanvas)
    return [base64String, info]
}

export default Extractor