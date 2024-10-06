import base64
from typing import Dict, Any

import cv2
from PIL import Image
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
        # TODO: Maybe remove this
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


