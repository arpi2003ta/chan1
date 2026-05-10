import argparse
import json
import os
import sys
from PIL import Image
from omr_processor import process_omr_image

INDEX_TO_LETTER = {0: "A", 1: "B", 2: "C", 3: "D", -1: None, -2: "MULTI"}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True)
    parser.add_argument("--mode", choices=["student", "instructor"], default="student")
    args = parser.parse_args()

    if not os.path.exists(args.image):
        print(f"File not found: {args.image}", file=sys.stderr)
        sys.exit(1)

    try:
        try:
            pil_img = Image.open(args.image)
        except Exception:
            print(f"Error: {args.image} is not a valid image file. OMR detection requires JPG or PNG.", file=sys.stderr)
            sys.exit(1)
            
        detected = process_omr_image(args.image, allow_multi=True)

        if detected is None:
            print("Error: Could not process image", file=sys.stderr)
            sys.exit(1)

        answers = []
        # NEET has 200 questions across 4 columns of 50
        for col_num in range(1, 5):
            col_answers = detected.get(f"col_{col_num}", [-1] * 50)
            for q_idx, ans_idx in enumerate(col_answers):
                question_num = (col_num - 1) * 50 + q_idx + 1
                answers.append({
                    "questionNumber": question_num,
                    "selectedOption": INDEX_TO_LETTER.get(ans_idx)
                })

        print(json.dumps(answers))
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
