import base64
from typing import Dict, Any

import cv2
import imutils.contours
import numpy as np

from actual_model.model import predict
from actual_model.solver import evaluate
from actual_model.utils import transform_image, is_contour_in_box, sort_dict_by_y_with_x_threshold


class PredictManager:

    def __init__(self, on_msg, on_error, on_calculation, variables):
        self.on_msg = on_msg
        self.on_error = on_error
        self.on_calculation = on_calculation
        self.variables = variables

    def predict(self, image: str):
        image_data = base64.b64decode(image)
        image_buffer = io.BytesIO(image_data)

        # Open the image using PIL
        image = Image.open(image_buffer)
        image = np.array(image, dtype=np.uint8)

        shape = image.shape
        # TODO: Maybe remove these
        new_image = np.full((shape[0] + 50, shape[1] + 50, shape[-1]), 255, dtype=np.uint8)
        new_image[:shape[0], :shape[1], :] = image
        image = new_image
        cv2.imwrite("received.png", image)
        gray_image = transform_image(image)
        contours, _ = cv2.findContours(gray_image, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        contours, rects = imutils.contours.sort_contours(contours)
        features: Dict[str, Any] = {}
        lines = []
        visited = []

        for i, (contour, rect) in enumerate(zip(contours, rects)):
            if i in visited:
                continue
            x, y, w, h = rect

            if cv2.contourArea(contour) < 20:
                continue
            if x == 0 and y == 0 and w == image.shape[1]:
                continue

            # cv2.putText(image, str(i), (x, y), 1, cv2.FONT_HERSHEY_COMPLEX, (255, 0, 0), 1)
            # cv2.rectangle(image, (x, y), (x + w, h + y), 1)
            visited.append(i)
            aspect_ratio = w / h
            if aspect_ratio > 2 and h < 50:
                lines.append((i, rect))
            else:
                # Capture non-wide contours (e.g., part of other symbols)

                if w < 20 and aspect_ratio <= 0.5:
                    captured = image[y:h + y, x:w + x]
                    shape = captured.shape
                    print("Possible One")
                    self.on_msg("a small shape. Maybe one")
                    new_image = np.ones((shape[0] + 30, shape[1] + 30, shape[-1]), dtype=np.uint8) * 255
                    new_image[15:shape[0] + 15, 15:shape[1] + 15, :] = captured
                    features[i] = {"image": new_image, "pos": (x, y)}
                else:
                    captured = image[y:h + y, max(x - 6, 0):w + x + 12].copy()
                    # captured = image[y:h + y, x:w + x]
                    feature_info = features[i] = {"pos": (x, y)}
                    children = {}
                    for other_i, other_rect in enumerate(rects):
                        if i == other_i or other_i in visited:
                            continue
                        if is_contour_in_box(other_rect, rect):
                            self.on_msg(f"Found a colliding contours at {(i, other_i)} ")
                            other_x, other_y, other_w, other_h = other_rect
                            captured = captured.copy()
                            start_y = other_y - y
                            start_x = max(other_x - x - 6, 0)
                            other_captured = captured[start_y:start_y + other_h, start_x:other_w + start_x + 12,
                                             :].copy()
                            captured[start_y:start_y + other_h, start_x:other_w + start_x + 12, :] = 255
                            children[other_i] = {"image": other_captured, "pos": (other_x, other_y)}
                            visited.append(other_i)

                    feature_info["image"] = captured
                    feature_info["children"] = sort_dict_by_y_with_x_threshold(children)

        self.update_lines(image, features, lines)
        sorted_features = sort_dict_by_y_with_x_threshold(features, threshold=80)
        return self.evaluate(image, sorted_features)

    def update_lines(self, image, features, lines):
        handled = {}
        for index, (key, line) in enumerate(lines):
            if index in handled:
                continue
            c_x, c_y, c_w, c_h = line
            found = False
            for next_index in range(index + 1, len(lines)):
                if next_index in handled:
                    continue
                next_key, next_line = lines[next_index]
                n_x, n_y, n_w, n_h = next_line
                vertical_distance = abs(c_y - n_y)
                horizontal_distance = abs(c_x - n_x)
                print(horizontal_distance)
                if vertical_distance < 80 and horizontal_distance < 50:
                    self.on_msg(f"Found a possible equal at indicis{(key, next_key)}")
                    w = max(c_w, n_w)
                    h = max(c_h, n_h)

                    min_x = min(c_x, n_x)
                    max_x = max(c_x, n_x)

                    min_y = min(c_y, n_y)
                    max_y = max(c_y, n_y)

                    captured = image[min_y:h + max_y, min_x:w + max_x]
                    shape = captured.shape
                    new_image = np.ones((shape[0] + 30, shape[1] + 30, shape[-1]), dtype=np.uint8) * 255
                    new_image[15:shape[0] + 15, 15:shape[1] + 15, :] = captured
                    handled[next_index] = features[key] = {"image": new_image, "pos": (min_x, min_y)}
                    found = True

                    break

            if not found:
                handled[index] = features[key] = {"type": "minus", "pos": (c_x, c_y)}

    def evaluate(self, image, sorted_features, depth=0):
        self.on_msg("Evaluating the extracted expression")
        results = []
        founds = []
        for s in sorted_features:
            symbols = []
            position = None
            last = None
            for index, (key, value) in enumerate(s.items()):

                last = value
                if "type" in value:
                    if value["type"] == "minus":
                        symbols.append("-")
                        continue

                feature = value["image"]
                cv2.imwrite(f"images/{index}.png", feature)
                result = predict(feature, threshold=0.4)
                if result == "unknown":
                    self.on_error(f"Failed to evaluate {index}")
                    return
                if result == "=":
                    position = {
                        "x": value["pos"][0] + feature.shape[1] + 40,
                        "y": value["pos"][1] + feature.shape[0],
                        "width": feature.shape[0],
                        "height": feature.shape[1]
                    }
                    print("Equal")
                symbols.append(result)
                if "children" in value and len(value["children"]) > 0:
                    children_result = self.evaluate(image, value["children"], depth + 1)
                    symbols.append("(")
                    symbols.extend(str(_) for _ in children_result)
                    symbols.append(")")

                founds.append((key, value["pos"], result))

            result = evaluate(symbols, self.variables)
            results.append(result)
            if result:
                if position is None and depth == 0:
                    pos = last["pos"]
                    last_image = last["image"]

                    position = {
                        "x": pos[0] + last_image.shape[1] + 30,
                        "y": pos[1] + last_image.shape[0] + 30,
                        "width": last_image.shape[0],
                        "height": last_image.shape[1]
                    }
                if isinstance(result, float):
                    result = f"{result:.2f}"
                else:
                    result = str(result)
                self.on_calculation(result, position)
                founds.append((102, position, result))

        # for key, value, result in founds:
        #     cv2.putText(image, result, value, cv2.FONT_HERSHEY_COMPLEX, 2, (0, 255, 0), 2)
        cv2.imwrite("wtf.png", image)
        return results


from PIL import Image
import io

if __name__ == '__main__':
    # load_model()
    # manager = PredictManager(print, print)
    image = "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"
    image_data = base64.b64decode(image)
    image_buffer = io.BytesIO(image_data)

    # Open the image using PIL
    image = Image.open(image_buffer)

    # Display image information
    print(f"Image size: {image.size}")
    print(f"Image mode: {image.mode}")
    image.show()
    # Display the image
