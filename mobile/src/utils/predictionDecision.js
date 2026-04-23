const ACCEPT_THRESHOLD = 90;
const RETAKE_THRESHOLD = 60;

const WRONG_CROP_LABELS = new Set([
  'unknown_crop',
  'unsupported_crop',
  'invalid_crop_hint'
]);

const WRONG_CROP_MODES = new Set([
  'crop_gate_unknown',
  'unsupported_crop',
  'crop_hint_invalid'
]);

const FRIENDLY_LABELS = {
  uncertain_prediction: 'Uncertain prediction',
  retake_photo: 'Retake required',
  unknown_crop: 'Unknown crop',
  unsupported_crop: 'Unsupported crop',
  invalid_crop_hint: 'Invalid crop hint',
  invalid_image: 'Invalid image'
};

const normalize = (value) => String(value || '').trim().toLowerCase();

const toTitleCase = (value) =>
  String(value || '')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const addSuggestion = (list, message) => {
  const normalized = String(message || '').trim();
  if (!normalized || list.includes(normalized)) return;
  list.push(normalized);
};

export const getConfidencePercent = (confidence) => {
  const parsed = Number(confidence);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
};

export const formatPredictionLabel = (label) => {
  const normalized = normalize(label);
  if (FRIENDLY_LABELS[normalized]) return FRIENDLY_LABELS[normalized];
  if (!normalized) return 'No prediction';
  return toTitleCase(normalized.replace(/_/g, ' '));
};

const buildCaptureSuggestions = (prediction, emphasizeCrop) => {
  const suggestions = [];
  const quality = prediction && typeof prediction === 'object' ? prediction.quality : null;
  const brightness = Number(quality?.brightness);
  const blurVar = Number(quality?.blur_var);
  const width = Number(quality?.width);
  const height = Number(quality?.height);

  if (emphasizeCrop) {
    addSuggestion(suggestions, 'Capture one crop leaf and keep it centered.');
    addSuggestion(suggestions, 'Set the crop name before running prediction again.');
  }
  if (Number.isFinite(brightness) && brightness < 55) {
    addSuggestion(suggestions, 'Increase lighting or move to daylight.');
  }
  if (Number.isFinite(brightness) && brightness > 210) {
    addSuggestion(suggestions, 'Avoid glare and direct flash on the leaf.');
  }
  if (Number.isFinite(blurVar) && blurVar < 120) {
    addSuggestion(suggestions, 'Tap to focus and keep your hand steady.');
  }
  if (Number.isFinite(width) && Number.isFinite(height) && Math.min(width, height) < 420) {
    addSuggestion(suggestions, 'Move closer so the leaf fills most of the frame.');
  }

  addSuggestion(suggestions, 'Keep background clutter out of the shot.');
  addSuggestion(suggestions, 'Retake from a slight angle if reflections hide symptoms.');

  return suggestions.slice(0, 4);
};

export const evaluatePredictionDecision = (prediction) => {
  const label = normalize(prediction?.label);
  const mode = normalize(prediction?.mode);
  const confidencePercent = getConfidencePercent(prediction?.confidence);
  const isWrongCrop = WRONG_CROP_LABELS.has(label) || WRONG_CROP_MODES.has(mode);

  if (isWrongCrop) {
    return {
      status: 'wrong_crop',
      title: 'Wrong crop detected',
      message: 'This crop is unsupported or mismatched, so prediction is rejected.',
      badgeTone: 'danger',
      badgeText: 'Wrong crop detected',
      confidencePercent,
      isAccepted: false,
      isRejected: true,
      requiresRetake: true,
      isWrongCrop: true,
      suggestions: buildCaptureSuggestions(prediction, true)
    };
  }

  if (label === 'retake_photo' || mode === 'quality_gate') {
    return {
      status: 'retake_required',
      title: 'Retake required',
      message: 'Image quality is too low for a reliable diagnosis.',
      badgeTone: 'danger',
      badgeText:
        confidencePercent === null ? 'Retake required' : `Retake required • ${confidencePercent}%`,
      confidencePercent,
      isAccepted: false,
      isRejected: true,
      requiresRetake: true,
      isWrongCrop: false,
      suggestions: buildCaptureSuggestions(prediction, false)
    };
  }

  if (confidencePercent === null) {
    return {
      status: 'no_confidence',
      title: 'Confidence unavailable',
      message: 'The model did not return a reliable confidence score.',
      badgeTone: 'neutral',
      badgeText: 'Confidence unavailable',
      confidencePercent,
      isAccepted: false,
      isRejected: false,
      requiresRetake: true,
      isWrongCrop: false,
      suggestions: buildCaptureSuggestions(prediction, false)
    };
  }

  if (confidencePercent >= ACCEPT_THRESHOLD) {
    return {
      status: 'accepted',
      title: 'Accepted prediction',
      message: 'Prediction confidence is strong enough to accept.',
      badgeTone: 'success',
      badgeText: `Accepted • ${confidencePercent}%`,
      confidencePercent,
      isAccepted: true,
      isRejected: false,
      requiresRetake: false,
      isWrongCrop: false,
      suggestions: []
    };
  }

  if (confidencePercent >= RETAKE_THRESHOLD) {
    return {
      status: 'retake_suggested',
      title: 'Retake suggested',
      message: 'Prediction is usable, but a clearer image could improve reliability.',
      badgeTone: 'warning',
      badgeText: `Retake suggested • ${confidencePercent}%`,
      confidencePercent,
      isAccepted: false,
      isRejected: false,
      requiresRetake: true,
      isWrongCrop: false,
      suggestions: buildCaptureSuggestions(prediction, false)
    };
  }

  return {
    status: 'rejected',
    title: 'Prediction rejected',
    message: 'Confidence is below 60%, so this result should not be trusted.',
    badgeTone: 'danger',
    badgeText: `Rejected • ${confidencePercent}%`,
    confidencePercent,
    isAccepted: false,
    isRejected: true,
    requiresRetake: true,
    isWrongCrop: false,
    suggestions: buildCaptureSuggestions(prediction, false)
  };
};

