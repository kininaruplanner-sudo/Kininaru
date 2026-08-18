/**
 * Kininaru Adaptive Intelligence Module
 *
 * Provides learning from user behavior to improve suggestions.
 *
 * Architecture:
 *   Action History + Feedback + Explicit Preferences
 *         ↓
 *   Signal Extraction
 *         ↓
 *   Preference Model (with confidence scores)
 *         ↓
 *   Adaptive Score (extends Next Action Engine)
 *         ↓
 *   Better Recommendations
 *
 * Privacy-first:
 * - All data stored locally (localStorage)
 * - No sensitive data collected
 * - User can opt out completely
 * - User can view, reset, or delete any learned preference
 */

export {
  type SignalType,
  type Signal,
  recordSignal,
  getSignalsByType,
  getRecentSignals,
  clearSignals,
} from "./signals";

export {
  type LearnedPreference,
  type PreferenceSource,
  type AdaptationPrefs,
  isAdaptationEnabled,
  setAdaptationEnabled,
  getPreference,
  getAllPreferences,
  updatePreference,
  deletePreference,
  resetAllPreferences,
  getRelevantPreferences,
} from "./preferences";

export {
  MIN_CONFIDENCE,
  CONFIDENCE_INCREMENT,
  CONFIDENCE_DECREMENT,
  MAX_CONFIDENCE,
  EXPLICIT_INITIAL,
  INFERRED_INITIAL,
  calculateIncrease,
  calculateDecrease,
  isConfident,
  confidenceLabel,
  confidencePercent,
} from "./confidence";

export {
  type FeedbackType,
  type FeedbackContext,
  processFeedback,
  getFeedbackStats,
} from "./feedback";

export {
  scorePreferenceFit,
  scoreHistoricalSuccess,
  extendScore,
  getAdaptiveExplanationFactors,
} from "./adaptive-score";
