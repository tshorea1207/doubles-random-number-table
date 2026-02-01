import { useState, useEffect } from 'react';
import type { ScheduleParams } from '../types/schedule';
import { generateSchedule } from './useScheduleGenerator';

// Configuration constants
const BENCHMARK_CONFIG: ScheduleParams = {
  courtsCount: 1,
  playersCount: 4,
  roundsCount: 2,
  weights: { w1: 1.0, w2: 0.5 },
};

const FALLBACK_COEFFICIENT = 0.002; // Default coefficient if calibration fails
const MIN_COEFF = 0.0001; // Lower bound (very fast hardware)
const MAX_COEFF = 0.1; // Upper bound (very slow hardware)
const CACHE_KEY = 'tennis-scheduler-calibration';
const CACHE_EXPIRY_DAYS = 7;

// Cache schema
interface CalibrationCache {
  coefficient: number;
  timestamp: number;
  version: string;
}

/**
 * Loads calibration coefficient from localStorage
 */
function loadFromCache(): CalibrationCache | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    return JSON.parse(cached) as CalibrationCache;
  } catch (error) {
    console.debug('Failed to load calibration cache:', error);
    return null;
  }
}

/**
 * Saves calibration coefficient to localStorage
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
    console.debug('localStorage unavailable, calibration will run on each load');
  }
}

/**
 * Checks if cached calibration is still valid
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
 * Runs benchmark and measures execution time
 */
function measureBenchmark(): number {
  const startTime = performance.now();
  generateSchedule(BENCHMARK_CONFIG);
  return performance.now() - startTime;
}

/**
 * Calculates calibration coefficient from measured time
 */
function calculateCoefficient(actualTimeMs: number): number {
  // Calculate predicted complexity using the same formula as estimateTime()
  const baseComplexity = Math.pow(
    BENCHMARK_CONFIG.playersCount / 4,
    BENCHMARK_CONFIG.courtsCount * 1.5
  ); // = 1 for 1c/4p
  const roundFactor = Math.max(BENCHMARK_CONFIG.roundsCount - 1, 1); // = 1 for 2r

  const predictedComplexity = baseComplexity * roundFactor; // = 1

  // Derive coefficient from actual time
  const actualTimeSeconds = actualTimeMs / 1000;
  const coefficient = actualTimeSeconds / predictedComplexity;

  return coefficient;
}

/**
 * Applies bounds to coefficient to prevent extreme values
 */
function applyBounds(coefficient: number): number {
  return Math.max(MIN_COEFF, Math.min(MAX_COEFF, coefficient));
}

/**
 * React hook for benchmark calibration
 *
 * Runs a minimal benchmark on component mount to measure hardware performance
 * and calculates a dynamic calibration coefficient for time estimation.
 *
 * @returns Calibration state and coefficient
 *
 * @example
 * const { coefficient, isCalibrating } = useBenchmarkCalibration();
 * const estimatedSeconds = baseComplexity * roundFactor * coefficient;
 */
export function useBenchmarkCalibration() {
  const [coefficient, setCoefficient] = useState<number | null>(null);
  const [isCalibrating, setIsCalibrating] = useState(true);

  useEffect(() => {
    // Step 1: Try to load from cache
    const cached = loadFromCache();
    if (cached && isCacheValid(cached)) {
      setCoefficient(cached.coefficient);
      setIsCalibrating(false);
      return;
    }

    // Step 2: Run benchmark asynchronously to avoid UI blocking
    setTimeout(() => {
      try {
        // Warmup run (JIT compilation stabilization)
        generateSchedule(BENCHMARK_CONFIG);

        // Actual measurement
        const timeMs = measureBenchmark();

        // Calculate and bound coefficient
        const rawCoeff = calculateCoefficient(timeMs);
        const boundedCoeff = applyBounds(rawCoeff);

        // Cache for future use
        saveToCache(boundedCoeff);
        setCoefficient(boundedCoeff);

        // Debug logging
        console.debug(
          `Calibration complete: ${timeMs.toFixed(2)}ms → coefficient ${boundedCoeff.toFixed(6)}`
        );
      } catch (error) {
        console.warn('Calibration benchmark failed:', error);
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
