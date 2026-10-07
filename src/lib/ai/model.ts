/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🌲 SMARTRIDE (COMMUTESYNC) — MACHINE LEARNING RANDOM FOREST REGRESSOR
 * ══════════════════════════════════════════════════════════════════════════════
 * Layer 3: ML Model Architecture & Ensemble Learning
 *
 * An academically genuine, self-contained Random Forest Regressor.
 *
 * Key Concepts:
 * 1. DecisionTreeRegressor: Binary tree with MSE / Variance Reduction split criteria.
 * 2. Bootstrap Aggregation (Bagging): Trains trees on random samples with replacement.
 * 3. Feature Subsampling: At each split, considers a random subset of m features (decorrelation).
 * 4. Feature Importance: Tracks cumulative variance reduction per feature.
 * 5. Ensemble Averaging: Combines predictions across trees to minimize variance.
 */

export interface TreeNode {
  isLeaf: boolean;
  value: number; // Prediction value for leaf node
  featureIndex?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
  samplesCount?: number;
  varianceReduction?: number;
}

export interface RandomForestConfig {
  nEstimators: number;    // Number of trees in forest (default: 25)
  maxDepth: number;       // Max depth per tree (default: 6)
  minSamplesSplit: number;// Min samples to attempt split (default: 4)
  subsampleRatio: number; // Bootstrap sample size ratio (default: 1.0)
  maxFeatures?: number;   // Number of features to consider per split (default: ceil(sqrt(p)) + 1)
  seed?: number;
}

export class DecisionTreeRegressor {
  root: TreeNode | null = null;
  maxDepth: number;
  minSamplesSplit: number;
  maxFeatures: number;
  featureImportances: number[] = [];

  constructor(maxDepth = 6, minSamplesSplit = 4, maxFeatures = 4) {
    this.maxDepth = maxDepth;
    this.minSamplesSplit = minSamplesSplit;
    this.maxFeatures = maxFeatures;
  }

  fit(X: number[][], y: number[], rand: () => number): void {
    const numFeatures = X[0]?.length || 0;
    this.featureImportances = new Array(numFeatures).fill(0);
    this.root = this.buildTree(X, y, 0, rand);
  }

  private calculateVariance(y: number[]): number {
    if (y.length <= 1) return 0;
    const mean = y.reduce((a, b) => a + b, 0) / y.length;
    return y.reduce((sum, val) => sum + (val - mean) ** 2, 0) / y.length;
  }

  private buildTree(
    X: number[][],
    y: number[],
    depth: number,
    rand: () => number
  ): TreeNode {
    const numSamples = y.length;
    const meanValue = y.reduce((a, b) => a + b, 0) / numSamples;

    // Base cases: Max depth reached, too few samples, or zero variance
    if (
      depth >= this.maxDepth ||
      numSamples < this.minSamplesSplit ||
      this.calculateVariance(y) < 1e-6
    ) {
      return { isLeaf: true, value: parseFloat(meanValue.toFixed(3)) };
    }

    const numFeatures = X[0].length;
    // Subsample candidate features randomly (Random Forest decorrelation)
    const allFeatureIndices = Array.from({ length: numFeatures }, (_, i) => i);
    // Shuffle indices
    for (let i = allFeatureIndices.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [allFeatureIndices[i], allFeatureIndices[j]] = [
        allFeatureIndices[j],
        allFeatureIndices[i],
      ];
    }
    const candidateFeatures = allFeatureIndices.slice(
      0,
      Math.min(this.maxFeatures, numFeatures)
    );

    let bestGain = -1;
    let bestFeature = -1;
    let bestThreshold = 0;
    let bestLeftIndices: number[] = [];
    let bestRightIndices: number[] = [];

    const currentVar = this.calculateVariance(y);

    for (const featIdx of candidateFeatures) {
      // Gather unique values as split candidates
      const values = X.map((row) => row[featIdx]);
      const uniqueVals = Array.from(new Set(values)).sort((a, b) => a - b);
      if (uniqueVals.length <= 1) continue;

      // Test midpoint thresholds
      const maxSplitsToTest = Math.min(uniqueVals.length - 1, 15);
      const step = Math.max(1, Math.floor((uniqueVals.length - 1) / maxSplitsToTest));

      for (let i = 0; i < uniqueVals.length - 1; i += step) {
        const threshold = (uniqueVals[i] + uniqueVals[i + 1]) / 2;

        const leftIdx: number[] = [];
        const rightIdx: number[] = [];

        for (let s = 0; s < numSamples; s++) {
          if (X[s][featIdx] <= threshold) {
            leftIdx.push(s);
          } else {
            rightIdx.push(s);
          }
        }

        if (leftIdx.length === 0 || rightIdx.length === 0) continue;

        const leftY = leftIdx.map((idx) => y[idx]);
        const rightY = rightIdx.map((idx) => y[idx]);

        const leftVar = this.calculateVariance(leftY);
        const rightVar = this.calculateVariance(rightY);

        // Variance reduction (Mean Squared Error reduction)
        const weightedVar =
          (leftIdx.length / numSamples) * leftVar +
          (rightIdx.length / numSamples) * rightVar;
        const gain = currentVar - weightedVar;

        if (gain > bestGain) {
          bestGain = gain;
          bestFeature = featIdx;
          bestThreshold = threshold;
          bestLeftIndices = leftIdx;
          bestRightIndices = rightIdx;
        }
      }
    }

    if (bestGain <= 1e-6 || bestFeature === -1) {
      return { isLeaf: true, value: parseFloat(meanValue.toFixed(3)) };
    }

    // Accumulate feature importance
    const importanceContribution = bestGain * numSamples;
    this.featureImportances[bestFeature] =
      (this.featureImportances[bestFeature] || 0) + importanceContribution;

    const leftX = bestLeftIndices.map((i) => X[i]);
    const leftY = bestLeftIndices.map((i) => y[i]);
    const rightX = bestRightIndices.map((i) => X[i]);
    const rightY = bestRightIndices.map((i) => y[i]);

    return {
      isLeaf: false,
      value: parseFloat(meanValue.toFixed(3)),
      featureIndex: bestFeature,
      threshold: bestThreshold,
      samplesCount: numSamples,
      varianceReduction: parseFloat(bestGain.toFixed(4)),
      left: this.buildTree(leftX, leftY, depth + 1, rand),
      right: this.buildTree(rightX, rightY, depth + 1, rand),
    };
  }

  predictSample(x: number[]): number {
    let node = this.root;
    while (node && !node.isLeaf) {
      if (node.featureIndex === undefined || node.threshold === undefined) {
        break;
      }
      if (x[node.featureIndex] <= node.threshold) {
        node = node.left || null;
      } else {
        node = node.right || null;
      }
    }
    return node ? node.value : 0;
  }
}

export class RandomForestRegressor {
  trees: DecisionTreeRegressor[] = [];
  config: Required<RandomForestConfig>;
  featureImportances: number[] = [];
  numFeatures = 0;
  isTrained = false;

  constructor(config: Partial<RandomForestConfig> = {}) {
    this.config = {
      nEstimators: config.nEstimators ?? 25,
      maxDepth: config.maxDepth ?? 6,
      minSamplesSplit: config.minSamplesSplit ?? 4,
      subsampleRatio: config.subsampleRatio ?? 1.0,
      maxFeatures: config.maxFeatures ?? 0, // Auto-computed during fit
      seed: config.seed ?? 101,
    };
  }

  private makeRng(seed: number): () => number {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  fit(X: number[][], y: number[]): void {
    if (!X.length || !y.length) {
      throw new Error('Cannot train RandomForestRegressor on empty dataset.');
    }

    this.numFeatures = X[0].length;
    const p = this.numFeatures;
    const maxFeats =
      this.config.maxFeatures > 0
        ? this.config.maxFeatures
        : Math.max(1, Math.ceil(Math.sqrt(p)) + 1);

    const rand = this.makeRng(this.config.seed);
    const nSamples = X.length;
    const sampleSize = Math.round(nSamples * this.config.subsampleRatio);

    this.trees = [];
    const aggregatedImportances = new Array(p).fill(0);

    for (let t = 0; t < this.config.nEstimators; t++) {
      // 1. Bootstrap sampling with replacement
      const bootX: number[][] = [];
      const bootY: number[] = [];

      for (let s = 0; s < sampleSize; s++) {
        const randIdx = Math.floor(rand() * nSamples);
        bootX.push(X[randIdx]);
        bootY.push(y[randIdx]);
      }

      // 2. Train Decision Tree on bootstrap sample
      const tree = new DecisionTreeRegressor(
        this.config.maxDepth,
        this.config.minSamplesSplit,
        maxFeats
      );
      tree.fit(bootX, bootY, rand);
      this.trees.push(tree);

      // 3. Accumulate variance reduction for feature importance
      tree.featureImportances.forEach((imp, i) => {
        aggregatedImportances[i] = (aggregatedImportances[i] || 0) + imp;
      });
    }

    // 4. Normalize feature importances to sum to 1.0 (or 100%)
    const totalImp = aggregatedImportances.reduce((a, b) => a + b, 0);
    this.featureImportances = aggregatedImportances.map((val) =>
      totalImp > 0 ? parseFloat((val / totalImp).toFixed(4)) : 1 / p
    );

    this.isTrained = true;
  }

  predict(X: number[][]): number[] {
    if (!this.isTrained || this.trees.length === 0) {
      throw new Error('Model is not trained yet.');
    }
    return X.map((x) => this.predictSample(x));
  }

  predictSample(x: number[]): number {
    if (!this.isTrained || this.trees.length === 0) {
      throw new Error('Model is not trained yet.');
    }
    const treePredictions = this.trees.map((t) => t.predictSample(x));
    const mean =
      treePredictions.reduce((a, b) => a + b, 0) / treePredictions.length;
    return Math.max(0, parseFloat(mean.toFixed(2)));
  }

  toJSON(): any {
    return {
      modelName: 'RandomForestRegressor',
      config: this.config,
      numFeatures: this.numFeatures,
      isTrained: this.isTrained,
      featureImportances: this.featureImportances,
      trees: this.trees.map((t) => t.root),
    };
  }
}
