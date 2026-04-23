import { ArrowLeft, AlertTriangle, Camera, CheckCircle2, Flag, Loader2, MessageSquare, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { flagPredictionForRetraining } from '../utils/api';
import { evaluatePredictionDecision, formatPredictionLabel, getExplainabilityOverlay } from '../utils/predictionDecision';

export default function ResultScreen({ navigate, selectedImage, currentPrediction, currentUser }) {
  const prediction = currentPrediction || null;
  const decision = evaluatePredictionDecision(prediction);
  const explainability = getExplainabilityOverlay(prediction);
  const topPredictions = Array.isArray(prediction?.top_predictions) ? prediction.top_predictions : [];
  const cropContext = prediction?.crop || prediction?.crop_hint || prediction?.inferred_crop_hint || null;
  
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [isFlagging, setIsFlagging] = useState(false);
  const [flagStatus, setFlagStatus] = useState(prediction?.flagged_for_retraining ? 'flagged' : null);
  const [flagError, setFlagError] = useState(null);

  const isRetrainingEligible = decision.confidencePercent !== null && decision.confidencePercent < 70 && !decision.isWrongCrop;
  const userId = currentUser?.id || currentUser?.user_id;
  const predictionId = prediction?.prediction_id;

  const toneStyles = {
    success: {
      badge: 'bg-emerald-50 text-emerald-700',
      panel: 'border-emerald-200 bg-emerald-50',
      panelTitle: 'text-emerald-900',
      panelText: 'text-emerald-800',
      panelIcon: 'text-emerald-600',
      panelButton: 'bg-emerald-600 hover:bg-emerald-700'
    },
    warning: {
      badge: 'bg-amber-50 text-amber-700',
      panel: 'border-amber-200 bg-amber-50',
      panelTitle: 'text-amber-900',
      panelText: 'text-amber-800',
      panelIcon: 'text-amber-600',
      panelButton: 'bg-amber-600 hover:bg-amber-700'
    },
    danger: {
      badge: 'bg-red-50 text-red-700',
      panel: 'border-red-200 bg-red-50',
      panelTitle: 'text-red-900',
      panelText: 'text-red-800',
      panelIcon: 'text-red-600',
      panelButton: 'bg-red-600 hover:bg-red-700'
    },
    neutral: {
      badge: 'bg-slate-100 text-slate-700',
      panel: 'border-slate-200 bg-slate-50',
      panelTitle: 'text-slate-900',
      panelText: 'text-slate-700',
      panelIcon: 'text-slate-600',
      panelButton: 'bg-slate-700 hover:bg-slate-800'
    }
  };
  const tone = toneStyles[decision.badgeTone] || toneStyles.neutral;
  const explainabilityTone = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    danger: 'border-red-200 bg-red-50 text-red-900'
  }[explainability.tone] || 'border-slate-200 bg-slate-50 text-slate-900';

  const handleFlagClick = () => {
    setShowFlagModal(true);
    setFlagError(null);
  };

  const handleConfirmFlag = async () => {
    if (!userId || !predictionId) {
      setFlagError('User or prediction information missing');
      return;
    }

    setIsFlagging(true);
    setFlagError(null);

    try {
      const result = await flagPredictionForRetraining(
        predictionId,
        userId,
        flagReason || null
      );

      if (result.success) {
        setFlagStatus('flagged');
        setShowFlagModal(false);
        setFlagReason('');
      }
    } catch (error) {
      setFlagError(error.detail || error.error || 'Failed to flag prediction');
      console.error('Flag error:', error);
    } finally {
      setIsFlagging(false);
    }
  };

  const renderConfidenceBadge = () => {
    if (!decision.badgeText) return null;
    const Icon = decision.badgeTone === 'success' ? CheckCircle2 : AlertTriangle;
    return (
      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${tone.badge}`}>
        <Icon className="h-4 w-4" />
        {decision.badgeText}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex flex-col">
      <div className="bg-white border-b border-gray-200 p-4 flex items-center gap-3">
        <button onClick={() => navigate('upload', { replace: true })} className="text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h2 className="text-gray-900">Analysis Result</h2>
      </div>

      <div className="flex-1 p-6 space-y-6">
        <div className="bg-white rounded-2xl p-4 shadow-md">
          <p className="text-gray-600 mb-3">Uploaded Image</p>
          {selectedImage ? (
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-gray-100">
              <ImageWithFallback
                src={selectedImage}
                alt="Uploaded plant"
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <p className="text-gray-500">No image available</p>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-md space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-gray-500 text-sm">Prediction</p>
              <h3 className="text-2xl text-gray-900 capitalize">
                {formatPredictionLabel(prediction?.label)}
              </h3>
            </div>
            {renderConfidenceBadge()}
          </div>

          {!decision.isAccepted && (
            <div className={`rounded-xl border-2 p-4 ${tone.panel}`}>
              <div className="flex items-start gap-3">
                <AlertTriangle className={`h-5 w-5 flex-shrink-0 mt-0.5 ${tone.panelIcon}`} />
                <div className="flex-1">
                  <p className={`font-semibold ${tone.panelTitle}`}>{decision.title}</p>
                  <p className={`text-sm mt-1 ${tone.panelText}`}>{decision.message}</p>
                  {decision.suggestions.length > 0 && (
                    <ul className={`mt-2 list-disc pl-5 text-sm space-y-1 ${tone.panelText}`}>
                      {decision.suggestions.map((tip) => (
                        <li key={tip}>{tip}</li>
                      ))}
                    </ul>
                  )}
                  {decision.requiresRetake && (
                    <button
                      onClick={() => navigate('upload', { replace: true })}
                      className={`mt-3 inline-flex items-center gap-2 px-4 py-2 text-white rounded-lg font-medium transition-colors ${tone.panelButton}`}
                    >
                      <Camera className="h-4 w-4" />
                      Capture New Image
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-gray-500 text-xs uppercase">Prediction ID</p>
              <p className="text-gray-900 break-all">{prediction?.prediction_id || '-'}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-gray-500 text-xs uppercase">Image ID</p>
              <p className="text-gray-900 break-all">{prediction?.image_id || '-'}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-gray-500 text-xs uppercase">Created At</p>
              <p className="text-gray-900">
                {prediction?.created_at ? new Date(prediction.created_at).toLocaleString() : '-'}
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-gray-500 text-xs uppercase">Updated At</p>
              <p className="text-gray-900">
                {prediction?.updated_at ? new Date(prediction.updated_at).toLocaleString() : '-'}
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-gray-500 text-xs uppercase">Crop Context</p>
              <p className="text-gray-900 capitalize">{cropContext || 'Not provided'}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-gray-500 text-xs uppercase">Inference Mode</p>
              <p className="text-gray-900 break-all">{prediction?.mode || 'standard'}</p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-gray-500 text-xs uppercase">Suggested Solution</p>
            <p className="text-gray-900">
              {prediction?.suggested_sc || 'No suggestion provided'}
            </p>
          </div>

          {topPredictions.length > 0 && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-gray-500 text-xs uppercase">Top Candidates</p>
              <div className="mt-3 space-y-2">
                {topPredictions.map((item) => (
                  <div key={`${item.label}-${item.confidence}`} className="flex items-center justify-between gap-3">
                    <span className="text-gray-900 break-words">{item.label}</span>
                    <span className="text-sm text-gray-500">{Math.round(Number(item.confidence || 0) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-gray-500 text-xs uppercase">Heatmap</p>
            {explainability ? (
              <div className={`mt-3 rounded-xl border px-3 py-2 ${explainabilityTone}`}>
                <div className="flex items-start gap-2">
                  {explainability.focusAssessment === 'lesion_area' ? (
                    <CheckCircle2 className="h-4 w-4 mt-0.5" />
                  ) : explainability.focusAssessment === 'background' ? (
                    <XCircle className="h-4 w-4 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 mt-0.5" />
                  )}
                  <div>
                    <p className="text-sm font-semibold">{explainability.focusMessage}</p>
                    <p className="text-xs mt-1">{explainability.reliabilityMessage}</p>
                  </div>
                </div>
              </div>
            ) : null}
            {prediction?.gradcam_png_base64 ? (
              <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
                <img
                  src={`data:image/png;base64,${prediction.gradcam_png_base64}`}
                  alt="Grad-CAM heatmap"
                  className="h-auto w-full"
                />
              </div>
            ) : prediction?.heatmap_url ? (
              <a
                href={prediction.heatmap_url}
                target="_blank"
                rel="noreferrer"
                className="text-green-700 hover:text-green-800 underline"
              >
                View heatmap
              </a>
            ) : (
              <p className="text-gray-900">No heatmap available</p>
            )}
          </div>

          {/* Retraining Alert & Flag Button */}
          {isRetrainingEligible && (
            <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-red-900">Low Confidence For Retraining</p>
                  <p className="text-sm text-red-800 mt-1">
                    Confidence is below 70%. You can flag this result for model retraining review.
                  </p>
                  {flagStatus === 'flagged' ? (
                    <div className="mt-3 flex items-center gap-2 text-green-700 bg-green-100 px-3 py-2 rounded-lg">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-sm font-medium">Already flagged for retraining</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleFlagClick}
                      className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                    >
                      <Flag className="h-4 w-4" />
                      Flag for Model Retraining
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <Button
          onClick={() => navigate('chat')}
          variant="outline"
          className="w-full border-green-200 text-green-700 hover:bg-green-50 py-6"
        >
          <MessageSquare className="w-5 h-5 mr-2" />
          Ask AI About This Result
        </Button>

        <Button
          onClick={() => navigate('upload', { replace: true })}
          className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-lg py-6"
        >
          Analyze Another Image
        </Button>
      </div>

      {/* Flag Modal */}
      {showFlagModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Flag for Retraining</h3>
            <p className="text-gray-600 mb-4">
              Help us improve accuracy by flagging this low-confidence prediction. Our team will review and retrain the model accordingly.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason (Optional)
              </label>
              <textarea
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                placeholder="e.g., The photo was too blurry, wrong crop category, etc."
                className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
                rows="3"
              />
            </div>

            {flagError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-700">{flagError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowFlagModal(false)}
                disabled={isFlagging}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmFlag}
                disabled={isFlagging}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
              >
                {isFlagging ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Flagging...
                  </>
                ) : (
                  <>
                    <Flag className="h-4 w-4" />
                    Confirm Flag
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
