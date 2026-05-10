import cv2
import numpy as np
from PIL import Image
import io
import os

def preprocess_image(image_input):
    """Convert uploaded file or PIL image to OpenCV format."""
    if isinstance(image_input, np.ndarray):
        img = image_input
    elif isinstance(image_input, Image.Image):
        img = np.array(image_input)
        if len(img.shape) == 3 and img.shape[2] == 4:
            img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
        elif len(img.shape) == 3:
            img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
    elif isinstance(image_input, str):
        img = cv2.imread(image_input)
    else:
        file_bytes = np.asarray(bytearray(image_input.read()), dtype=np.uint8)
        img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    return img

def detect_bubbles_in_column(img, col_x, col_y, col_w, col_h, num_rows=50, num_options=4, allow_multi=False):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    col_region = gray[col_y:col_y+col_h, col_x:col_x+col_w]
    
    row_h = col_h / num_rows
    bubble_w = col_w / num_options
    
    answers = []
    
    for row in range(num_rows):
        row_start = int(row * row_h)
        row_end = int((row + 1) * row_h)
        
        darknesses = []
        for opt in range(num_options):
            opt_start = int(opt * bubble_w)
            opt_end = int((opt + 1) * bubble_w)
            
            cell = col_region[row_start:row_end, opt_start:opt_end]
            if cell.size == 0:
                darknesses.append(0)
                continue
            
            pad_y = max(1, int(cell.shape[0] * 0.15))
            pad_x = max(1, int(cell.shape[1] * 0.15))
            inner = cell[pad_y:-pad_y, pad_x:-pad_x]
            if inner.size == 0: inner = cell

            _, cell_thresh = cv2.threshold(inner, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
            filled_ratio = float(np.sum(cell_thresh > 0)) / float(cell_thresh.size)
            darknesses.append(filled_ratio)
        
        ranked = sorted(enumerate(darknesses), key=lambda x: x[1], reverse=True)
        (best_idx, best_val) = ranked[0]
        second_val = ranked[1][1] if len(ranked) > 1 else 0.0

        min_fill = 0.10
        multi_similarity = 0.97  # Only flag as MULTI if two bubbles are nearly identical darkness

        if best_val < min_fill:
            answers.append(-1)
        elif allow_multi and second_val >= best_val * multi_similarity and second_val >= min_fill:
            answers.append(-2)
        else:
            answers.append(best_idx)
    return answers

def process_omr_image(image_path, num_rows=50, num_options=4, allow_multi=False):
    img = preprocess_image(image_path)
    if img is None: return None
    
    h, w = img.shape[:2]
    
    # These margins are calibrated for the specific NEET OMR template from the repo
    top_margin = int(h * 0.37)
    bottom_margin = int(h * 0.98)
    left_margin = int(w * 0.06)
    right_margin = int(w * 0.95)
    
    usable_w = right_margin - left_margin
    col_w = usable_w // 4
    
    results = {}
    for col_idx in range(4):
        col_x = left_margin + col_idx * col_w
        col_y = top_margin
        col_h = bottom_margin - top_margin
        
        answers = detect_bubbles_in_column(img, col_x, col_y, col_w, col_h, num_rows=num_rows, num_options=num_options, allow_multi=allow_multi)
        results[f"col_{col_idx + 1}"] = answers
    
    return results
