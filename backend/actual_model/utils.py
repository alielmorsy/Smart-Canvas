import cv2


def transform_image(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Apply Gaussian blur to smooth the image
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Apply adaptive threshold to binarize the image
    image = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV, 11, 2
    )

    return image


def is_contour_in_box(rect, box_rect, threshold=20):
    x, y, w, h = rect
    box_x, box_y, box_w, box_h = box_rect
    box_x -= threshold
    box_y -= threshold
    box_w += threshold
    box_h += threshold
    if w > box_w or h > box_h:
        return False
    return (x >= box_x and y >= box_y and
            x + w <= box_x + box_w and
            y + h <= box_y + box_h)


def sort_dict_by_y_with_x_threshold(input_dict, threshold=100):
    items = sorted(input_dict.items(), key=lambda item: item[1]['pos'][1])  # Sort by y-coordinate

    # Step 2: Group items based on the y-values with the threshold
    sorted_rows = []
    current_row = []
    previous_y = None

    for key, value in items:
        x, y = value['pos']

        # If it's the first element or the difference in y exceeds the threshold, start a new row
        if previous_y is None or abs(y - previous_y) > threshold:
            if current_row:
                # Sort the current row by x-values and append to the result
                sorted_rows.append(sorted(current_row, key=lambda item: item[1]['pos'][0]))
            current_row = [(key, value)]
        else:
            current_row.append((key, value))

        previous_y = y

    # Append the last row
    if current_row:
        sorted_rows.append(sorted(current_row, key=lambda item: item[1]['pos'][0]))

    final = [dict(s) for s in sorted_rows]

    return final
