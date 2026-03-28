export interface ProfileClusterInput {
  lunchTxnRate: number;
  snackTxnRate: number;
  dinnerTxnRate: number;
  avgWeeklySpend: number;
}

type Vector4 = [number, number, number, number];

const MAX_KMEANS_ITERATIONS = 12;

function toVector(input: ProfileClusterInput): Vector4 {
  return [
    input.lunchTxnRate,
    input.snackTxnRate,
    input.dinnerTxnRate,
    input.avgWeeklySpend,
  ];
}

function euclideanDistance(a: Vector4, b: Vector4): number {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 +
      (a[1] - b[1]) ** 2 +
      (a[2] - b[2]) ** 2 +
      (a[3] - b[3]) ** 2,
  );
}

function normalizeVectors(vectors: Vector4[]): Vector4[] {
  const mins: Vector4 = [Infinity, Infinity, Infinity, Infinity];
  const maxs: Vector4 = [-Infinity, -Infinity, -Infinity, -Infinity];

  vectors.forEach((v) => {
    for (let i = 0; i < 4; i += 1) {
      mins[i] = Math.min(mins[i], v[i]);
      maxs[i] = Math.max(maxs[i], v[i]);
    }
  });

  return vectors.map((v) => {
    const normalized: Vector4 = [0, 0, 0, 0];
    for (let i = 0; i < 4; i += 1) {
      const denom = maxs[i] - mins[i];
      normalized[i] = denom === 0 ? 0 : (v[i] - mins[i]) / denom;
    }
    return normalized;
  });
}

function assignClosestCentroid(point: Vector4, centroids: Vector4[]): number {
  let bestIndex = 0;
  let bestDistance = Infinity;
  centroids.forEach((centroid, idx) => {
    const d = euclideanDistance(point, centroid);
    if (d < bestDistance) {
      bestDistance = d;
      bestIndex = idx;
    }
  });
  return bestIndex;
}

function kmeans(points: Vector4[], k: number): { labels: number[]; centroids: Vector4[] } {
  const centroids = points.slice(0, k).map((v) => [...v] as Vector4);
  let labels = new Array(points.length).fill(0);

  for (let iter = 0; iter < MAX_KMEANS_ITERATIONS; iter += 1) {
    labels = points.map((p) => assignClosestCentroid(p, centroids));
    const nextCentroids: Vector4[] = centroids.map(() => [0, 0, 0, 0]);
    const counts = new Array(k).fill(0);

    labels.forEach((label, idx) => {
      counts[label] += 1;
      for (let d = 0; d < 4; d += 1) {
        nextCentroids[label][d] += points[idx][d];
      }
    });

    for (let c = 0; c < k; c += 1) {
      if (counts[c] === 0) continue;
      for (let d = 0; d < 4; d += 1) {
        nextCentroids[c][d] /= counts[c];
      }
    }

    let moved = false;
    for (let c = 0; c < k; c += 1) {
      if (euclideanDistance(centroids[c], nextCentroids[c]) > 1e-6) {
        moved = true;
        centroids[c] = nextCentroids[c];
      }
    }
    if (!moved) break;
  }

  return { labels, centroids };
}

function mapCentroidToLabel(centroid: Vector4): string {
  const [lunch, snack, dinner, spend] = centroid;
  if (spend < 0.28 && Math.max(lunch, snack, dinner) < 0.52) {
    return "Balanced / Low-Variance";
  }
  if (snack >= lunch && snack >= dinner) return "Frequent Afternoon Snacker";
  if (dinner >= lunch && dinner >= snack) return "Evening-On-Campus Diner";
  return "Lunch-Driven";
}

export function clusterProfileLabel(input: ProfileClusterInput): string | null {
  try {
    // Deterministic reference points anchor clusters for single-user inference.
    const reference: Vector4[] = [
      [4.8, 1.3, 2.2, 120],
      [2.1, 5.2, 1.8, 130],
      [2.0, 1.5, 4.9, 145],
      [1.6, 1.2, 1.4, 60],
      [3.2, 2.4, 2.9, 110],
      [5.5, 2.0, 1.8, 150],
      [1.9, 4.3, 2.0, 100],
      [2.2, 1.9, 4.1, 125],
    ];

    const user = toVector(input);
    const allPoints = normalizeVectors([...reference, user]);
    const { labels, centroids } = kmeans(allPoints, 4);
    const userLabel = labels[allPoints.length - 1];
    return mapCentroidToLabel(centroids[userLabel]);
  } catch {
    return null;
  }
}
