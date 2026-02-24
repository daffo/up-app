import {
  deduplicatePredictions,
  RoboflowPrediction,
} from '../../lib/holdDetection';

describe('deduplicatePredictions', () => {
  const imageWidth = 1000;
  const imageHeight = 1000;
  const threshold = 2; // 2% distance

  it('returns empty array for empty input', () => {
    expect(deduplicatePredictions([], threshold, imageWidth, imageHeight)).toEqual([]);
  });

  it('returns single prediction as-is', () => {
    const pred: RoboflowPrediction = { x: 500, y: 500, confidence: 0.9 };
    const result = deduplicatePredictions([pred], threshold, imageWidth, imageHeight);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(pred);
  });

  it('keeps two predictions that are far apart', () => {
    const a: RoboflowPrediction = { x: 100, y: 100, confidence: 0.9 };
    const b: RoboflowPrediction = { x: 900, y: 900, confidence: 0.8 };
    const result = deduplicatePredictions([a, b], threshold, imageWidth, imageHeight);
    expect(result).toHaveLength(2);
  });

  it('keeps higher confidence when two predictions are close (first higher)', () => {
    const a: RoboflowPrediction = { x: 500, y: 500, confidence: 0.95 };
    const b: RoboflowPrediction = { x: 505, y: 505, confidence: 0.8 };
    const result = deduplicatePredictions([a, b], threshold, imageWidth, imageHeight);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(a);
  });

  it('keeps higher confidence when two predictions are close (second higher)', () => {
    const a: RoboflowPrediction = { x: 500, y: 500, confidence: 0.7 };
    const b: RoboflowPrediction = { x: 505, y: 505, confidence: 0.95 };
    const result = deduplicatePredictions([a, b], threshold, imageWidth, imageHeight);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(b);
  });

  it('handles mix of close and far predictions', () => {
    const a: RoboflowPrediction = { x: 100, y: 100, confidence: 0.9 };
    const b: RoboflowPrediction = { x: 105, y: 105, confidence: 0.8 }; // close to a
    const c: RoboflowPrediction = { x: 900, y: 900, confidence: 0.85 }; // far from both
    const result = deduplicatePredictions([a, b, c], threshold, imageWidth, imageHeight);
    expect(result).toHaveLength(2);
    expect(result).toContain(a);
    expect(result).toContain(c);
  });

  it('calculates center from points array', () => {
    const a: RoboflowPrediction = {
      points: [
        { x: 490, y: 490 },
        { x: 510, y: 490 },
        { x: 510, y: 510 },
        { x: 490, y: 510 },
      ],
      confidence: 0.9,
    };
    const b: RoboflowPrediction = {
      points: [
        { x: 495, y: 495 },
        { x: 515, y: 495 },
        { x: 515, y: 515 },
        { x: 495, y: 515 },
      ],
      confidence: 0.8,
    };
    const result = deduplicatePredictions([a, b], threshold, imageWidth, imageHeight);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(a);
  });

  it('uses x/y fallback for bounding box centers', () => {
    const a: RoboflowPrediction = { x: 500, y: 500, width: 50, height: 50, confidence: 0.9 };
    const b: RoboflowPrediction = { x: 510, y: 510, width: 50, height: 50, confidence: 0.8 };
    const result = deduplicatePredictions([a, b], threshold, imageWidth, imageHeight);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(a);
  });

  it('filters out prediction with empty points array', () => {
    const a: RoboflowPrediction = { x: 500, y: 500, confidence: 0.9 };
    const b: RoboflowPrediction = { points: [], confidence: 0.95 };
    const result = deduplicatePredictions([a, b], threshold, imageWidth, imageHeight);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(a);
  });

  it('handles three predictions where A~B and B~C but A is far from C', () => {
    // A at 10%, B at 11.5%, C at 13% (threshold 2%)
    // A-B distance: 2.12% (~within threshold? let's be precise)
    // Use exact positions: A(100,100), B(115,115), C(130,130)
    // Centers in %: A(10,10), B(11.5,11.5), C(13,13)
    // A-B dist: sqrt(1.5^2 + 1.5^2) = 2.12 -> just over 2% threshold, both kept
    // Let's use tighter spacing:
    // A(100,100) -> 10%, B(110,110) -> 11%, C(125,125) -> 12.5%
    // A-B dist: sqrt(1^2 + 1^2) = 1.41 -> within 2%
    // B-C dist: sqrt(1.5^2 + 1.5^2) = 2.12 -> just over 2%
    // A-C dist: sqrt(2.5^2 + 2.5^2) = 3.54 -> over 2%
    const a: RoboflowPrediction = { x: 100, y: 100, confidence: 0.7 };
    const b: RoboflowPrediction = { x: 110, y: 110, confidence: 0.9 };
    const c: RoboflowPrediction = { x: 125, y: 125, confidence: 0.8 };

    const result = deduplicatePredictions([a, b, c], threshold, imageWidth, imageHeight);
    // A and B are close -> B wins (higher confidence), A removed
    // B and C are just over threshold -> both kept
    expect(result).toHaveLength(2);
    expect(result).toContain(b);
    expect(result).toContain(c);
  });
});
