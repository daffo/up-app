#!/usr/bin/env python3
"""
Hold Detection Script using Roboflow Hosted API

Uses a pre-trained instance segmentation model to detect climbing holds.
Outputs JSON file with polygon coordinates for each detected hold.

Usage:
    python detect_holds.py <image_path> [--output output.json] [--preview] [--confidence 0.5]

Requirements:
    pip install opencv-python numpy requests

Setup:
    export ROBOFLOW_API_KEY=<your_api_key>
"""

import cv2
import numpy as np
import json
import argparse
import os
import base64
import time
import requests
from pathlib import Path
from typing import List, Dict

# Roboflow model details
MODEL_ENDPOINT = "hold-detector-rnvkl/2"
API_URL = f"https://serverless.roboflow.com/{MODEL_ENDPOINT}"


def deduplicate_predictions(predictions: List[Dict], threshold: float = 20) -> List[Dict]:
    """Remove duplicate detections based on center proximity."""
    if not predictions:
        return []

    # Filter out predictions with empty points
    predictions = [p for p in predictions if not ("points" in p and len(p["points"]) == 0)]

    # Calculate centers for all predictions
    centers = []
    for pred in predictions:
        if "points" in pred:
            cx = sum(p["x"] for p in pred["points"]) / len(pred["points"])
            cy = sum(p["y"] for p in pred["points"]) / len(pred["points"])
        else:
            cx, cy = pred.get("x", 0), pred.get("y", 0)
        centers.append((cx, cy))

    # Keep track of which predictions to keep
    keep = [True] * len(predictions)

    for i in range(len(predictions)):
        if not keep[i]:
            continue
        for j in range(i + 1, len(predictions)):
            if not keep[j]:
                continue
            # Calculate distance between centers
            dist = ((centers[i][0] - centers[j][0]) ** 2 +
                   (centers[i][1] - centers[j][1]) ** 2) ** 0.5
            if dist < threshold:
                # Keep the one with higher confidence
                if predictions[i].get("confidence", 0) >= predictions[j].get("confidence", 0):
                    keep[j] = False
                else:
                    keep[i] = False
                    break

    return [p for p, k in zip(predictions, keep) if k]


def call_api(image: np.ndarray, api_key: str, confidence: float, max_retries: int = 3) -> List[Dict]:
    """Call Roboflow API for a single image tile with retries."""
    _, buffer = cv2.imencode('.jpg', image)
    img_base64 = base64.b64encode(buffer).decode('utf-8')

    for attempt in range(max_retries):
        response = requests.post(
            API_URL,
            params={
                "api_key": api_key,
                "confidence": int(confidence * 100),
            },
            data=img_base64,
            headers={
                "Content-Type": "application/x-www-form-urlencoded"
            }
        )

        if response.status_code == 200:
            return response.json().get("predictions", [])

        if response.status_code >= 500 and attempt < max_retries - 1:
            wait = 2 ** attempt
            print(f"    API returned {response.status_code}, retrying in {wait}s...")
            time.sleep(wait)
            continue

        raise Exception(f"API error: {response.status_code} - {response.text}")

    return []


def detect_holds(
    image_path: str,
    api_key: str,
    confidence: float = 0.5,
    preview: bool = False
) -> List[Dict]:
    """
    Detect climbing holds using Roboflow hosted API with tiling.

    Args:
        image_path: Path to the input image
        api_key: Roboflow API key
        confidence: Minimum confidence threshold (0-1)
        preview: If True, display detected holds overlay

    Returns:
        List of detected holds with polygon coordinates
    """
    # Load image
    original_image = cv2.imread(image_path)
    if original_image is None:
        raise ValueError(f"Could not read image: {image_path}")

    orig_height, orig_width = original_image.shape[:2]

    # Resize for processing (keep reasonable size)
    max_dimension = 4096
    if max(orig_height, orig_width) > max_dimension:
        scale = max_dimension / max(orig_height, orig_width)
        new_width = int(orig_width * scale)
        new_height = int(orig_height * scale)
        image = cv2.resize(original_image, (new_width, new_height), interpolation=cv2.INTER_AREA)
        print(f"Resized image from {orig_width}x{orig_height} to {new_width}x{new_height}")
    else:
        image = original_image
        new_width, new_height = orig_width, orig_height

    height, width = image.shape[:2]

    # Use tiling to overcome 300 detection limit
    # Split into 3x3 grid with overlap
    tile_cols, tile_rows = 3, 3
    overlap = 0.3  # 30% overlap to catch holds on borders

    tile_width = width // tile_cols
    tile_height = height // tile_rows
    overlap_x = int(tile_width * overlap)
    overlap_y = int(tile_height * overlap)

    all_predictions = []

    print(f"Processing {tile_cols}x{tile_rows} tiles...")
    for row in range(tile_rows):
        for col in range(tile_cols):
            # Calculate tile boundaries with overlap
            x1 = max(0, col * tile_width - overlap_x)
            y1 = max(0, row * tile_height - overlap_y)
            x2 = min(width, (col + 1) * tile_width + overlap_x)
            y2 = min(height, (row + 1) * tile_height + overlap_y)

            tile = image[y1:y2, x1:x2]
            tile_h, tile_w = tile.shape[:2]

            print(f"  Tile ({row},{col}): {tile_w}x{tile_h}...")
            predictions = call_api(tile, api_key, confidence)
            print(f"    Found {len(predictions)} holds")

            # Adjust coordinates to full image space
            for pred in predictions:
                if "points" in pred:
                    for point in pred["points"]:
                        point["x"] = point["x"] + x1
                        point["y"] = point["y"] + y1
                else:
                    pred["x"] = pred["x"] + x1
                    pred["y"] = pred["y"] + y1

            all_predictions.extend(predictions)

    # Remove duplicates from overlap regions (based on center proximity)
    print(f"Total before dedup: {len(all_predictions)}")
    predictions = deduplicate_predictions(all_predictions, threshold=20)
    print(f"After dedup: {len(predictions)}")

    detected_holds = []
    preview_image = image.copy() if preview else None

    for pred in predictions:
        # Get confidence
        conf = pred.get("confidence", 0)
        if conf < confidence:
            continue

        # Check for segmentation points
        if "points" in pred:
            # Instance segmentation with polygon points
            polygon = []
            for point in pred["points"]:
                x_percent = (point["x"] / width) * 100
                y_percent = (point["y"] / height) * 100
                polygon.append({"x": round(x_percent, 2), "y": round(y_percent, 2)})

            # Calculate center from polygon
            if polygon:
                center_x = sum(p["x"] for p in polygon) / len(polygon)
                center_y = sum(p["y"] for p in polygon) / len(polygon)
            else:
                continue
        else:
            # Fallback to bounding box
            x = pred.get("x", 0)
            y = pred.get("y", 0)
            w = pred.get("width", 0)
            h = pred.get("height", 0)

            # Convert bbox center coords to polygon corners
            polygon = [
                {"x": round(((x - w/2) / width) * 100, 2), "y": round(((y - h/2) / height) * 100, 2)},
                {"x": round(((x + w/2) / width) * 100, 2), "y": round(((y - h/2) / height) * 100, 2)},
                {"x": round(((x + w/2) / width) * 100, 2), "y": round(((y + h/2) / height) * 100, 2)},
                {"x": round(((x - w/2) / width) * 100, 2), "y": round(((y + h/2) / height) * 100, 2)},
            ]
            center_x = round((x / width) * 100, 2)
            center_y = round((y / height) * 100, 2)

        # Get class name
        class_name = pred.get("class", "hold")

        # Sample dominant color from center
        cx_px = int((center_x / 100) * width)
        cy_px = int((center_y / 100) * height)

        sample_size = 5
        x1 = max(0, cx_px - sample_size)
        x2 = min(width, cx_px + sample_size)
        y1 = max(0, cy_px - sample_size)
        y2 = min(height, cy_px + sample_size)

        region = image[y1:y2, x1:x2]
        if region.size > 0:
            mean_color = region.mean(axis=(0, 1))
            dominant_color = "#{:02x}{:02x}{:02x}".format(
                int(mean_color[2]), int(mean_color[1]), int(mean_color[0])
            )
        else:
            dominant_color = "#888888"

        hold = {
            "polygon": polygon,
            "center": {"x": round(center_x, 2), "y": round(center_y, 2)},
            "dominant_color": dominant_color,
            "confidence": round(conf, 3),
            "class": class_name
        }
        detected_holds.append(hold)

        # Draw on preview
        if preview and polygon:
            pts = np.array([
                [int(p["x"] / 100 * width), int(p["y"] / 100 * height)]
                for p in polygon
            ], np.int32)
            cv2.polylines(preview_image, [pts], True, (0, 255, 0), 1)
            cv2.circle(preview_image, (cx_px, cy_px), 3, (255, 0, 0), -1)

    if preview:
        cv2.imshow('Detected Holds', preview_image)
        cv2.waitKey(0)
        cv2.destroyAllWindows()

    print(f"Detected {len(detected_holds)} holds")
    return detected_holds


def main():
    parser = argparse.ArgumentParser(description='Detect climbing holds using Roboflow ML model')
    parser.add_argument('image', help='Path to input image')
    parser.add_argument('--output', '-o', help='Output JSON file path', default=None)
    parser.add_argument('--preview', '-p', action='store_true',
                       help='Show preview window with detections')
    parser.add_argument('--confidence', '-c', type=float, default=0.5,
                       help='Minimum confidence threshold (0-1, default: 0.5)')

    args = parser.parse_args()

    # Get API key
    api_key = os.environ.get('ROBOFLOW_API_KEY')
    if not api_key:
        print("Error: ROBOFLOW_API_KEY environment variable not set")
        print("Get your API key from https://app.roboflow.com/settings/api")
        exit(1)

    # Detect holds
    holds = detect_holds(
        args.image,
        api_key=api_key,
        confidence=args.confidence,
        preview=args.preview
    )

    # Determine output path
    if args.output:
        output_path = args.output
    else:
        input_path = Path(args.image)
        output_path = input_path.parent / f"{input_path.stem}-detected-holds.json"

    # Write JSON output
    with open(output_path, 'w') as f:
        json.dump(holds, f, indent=2)

    print(f"Saved {len(holds)} detected holds to {output_path}")


if __name__ == '__main__':
    main()
