import { useState, useEffect } from 'react';
import type { ScheduleParams } from '../types/schedule';
import { generateSchedule } from './useScheduleGenerator';

// 設定定数
const BENCHMARK_CONFIG: ScheduleParams = {
  courtsCount: 1,
  playersCount: 4,
  roundsCount: 2,
  weights: { w1: 1.0, w2: 0.5 },
};

const FALLBACK_COEFFICIENT = 0.002; // キャリブレーション失敗時のデフォルト係数
const MIN_COEFF = 0.0001; // 下限（高速ハードウェア向け）
const MAX_COEFF = 0.1; // 上限（低速ハードウェア向け）
const CACHE_KEY = 'tennis-scheduler-calibration';
const CACHE_EXPIRY_DAYS = 7;

// キャッシュスキーマ
interface CalibrationCache {
  coefficient: number;
  timestamp: number;
  version: string;
}

/**
 * localStorage からキャリブレーション係数を読み込む
 */
function loadFromCache(): CalibrationCache | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    return JSON.parse(cached) as CalibrationCache;
  } catch (error) {
    console.debug('キャリブレーションキャッシュの読み込みに失敗:', error);
    return null;
  }
}

/**
 * キャリブレーション係数を localStorage に保存する
 */
function saveToCache(coefficient: number): void {
  try {
    const cache: CalibrationCache = {
      coefficient,
      timestamp: Date.now(),
      version: '1.0',
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.debug('localStorage が利用できないため、毎回キャリブレーションを実行します');
  }
}

/**
 * キャッシュされたキャリブレーションが有効かどうかを確認する
 */
function isCacheValid(cache: CalibrationCache): boolean {
  const ageMs = Date.now() - cache.timestamp;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  return (
    cache.version === '1.0' &&
    ageDays < CACHE_EXPIRY_DAYS &&
    cache.coefficient >= MIN_COEFF &&
    cache.coefficient <= MAX_COEFF
  );
}

/**
 * ベンチマークを実行し、実行時間を計測する
 */
function measureBenchmark(): number {
  const startTime = performance.now();
  generateSchedule(BENCHMARK_CONFIG);
  return performance.now() - startTime;
}

/**
 * 計測時間からキャリブレーション係数を計算する
 */
function calculateCoefficient(actualTimeMs: number): number {
  // estimateTime() と同じ式で予測計算量を算出
  const baseComplexity = Math.pow(
    BENCHMARK_CONFIG.playersCount / 4,
    BENCHMARK_CONFIG.courtsCount * 1.5
  ); // 1c/4p の場合 = 1
  const roundFactor = Math.max(BENCHMARK_CONFIG.roundsCount - 1, 1); // 2r の場合 = 1

  const predictedComplexity = baseComplexity * roundFactor; // = 1

  // 実測時間から係数を導出
  const actualTimeSeconds = actualTimeMs / 1000;
  const coefficient = actualTimeSeconds / predictedComplexity;

  return coefficient;
}

/**
 * 極端な値を防ぐために係数に上下限を適用する
 */
function applyBounds(coefficient: number): number {
  return Math.max(MIN_COEFF, Math.min(MAX_COEFF, coefficient));
}

/**
 * ベンチマークキャリブレーション用 React フック
 *
 * コンポーネントのマウント時に最小限のベンチマークを実行してハードウェア性能を計測し、
 * 時間推定用の動的キャリブレーション係数を計算する。
 *
 * @returns キャリブレーション状態と係数
 *
 * @example
 * const { coefficient, isCalibrating } = useBenchmarkCalibration();
 * const estimatedSeconds = baseComplexity * roundFactor * coefficient;
 */
export function useBenchmarkCalibration() {
  const [coefficient, setCoefficient] = useState<number | null>(null);
  const [isCalibrating, setIsCalibrating] = useState(true);

  useEffect(() => {
    // ステップ1: キャッシュからの読み込みを試みる
    const cached = loadFromCache();
    if (cached && isCacheValid(cached)) {
      setCoefficient(cached.coefficient);
      setIsCalibrating(false);
      return;
    }

    // ステップ2: UIブロッキングを避けるため非同期でベンチマークを実行
    setTimeout(() => {
      try {
        // ウォームアップ実行（JITコンパイルの安定化）
        generateSchedule(BENCHMARK_CONFIG);

        // 実際の計測
        const timeMs = measureBenchmark();

        // 係数を計算し上下限を適用
        const rawCoeff = calculateCoefficient(timeMs);
        const boundedCoeff = applyBounds(rawCoeff);

        // 次回使用のためにキャッシュ
        saveToCache(boundedCoeff);
        setCoefficient(boundedCoeff);

        // デバッグログ
        console.debug(
          `キャリブレーション完了: ${timeMs.toFixed(2)}ms → 係数 ${boundedCoeff.toFixed(6)}`
        );
      } catch (error) {
        console.warn('キャリブレーションベンチマークに失敗:', error);
        setCoefficient(FALLBACK_COEFFICIENT);
      } finally {
        setIsCalibrating(false);
      }
    }, 0);
  }, []);

  return {
    coefficient: coefficient ?? FALLBACK_COEFFICIENT,
    isCalibrating,
    isCalibrated: coefficient !== null,
  };
}
