import { ArrowLeft, Bookmark, MessageSquare, Save, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Screen, PredictionResult } from '../App';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Badge } from './ui/badge';
import { useState } from 'react';
import { toast } from 'sonner';
import { toggleBookmark } from '../utils/api';

interface ResultScreenProps {
  navigate: (screen: Screen) => void;
  selectedImage: string | null;
  currentPrediction: PredictionResult | null;
}

export default function ResultScreen({ navigate, selectedImage, currentPrediction }: ResultScreenProps) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isBookmarking, setIsBookmarking] = useState(false);

  // Use current prediction if available, otherwise show default data
  const result = currentPrediction ? {
    disease: currentPrediction.label,
    confidence: currentPrediction.confidence,
    severity: currentPrediction.confidence >= 90 ? 'High' : currentPrediction.confidence >= 75 ? 'Moderate' : 'Low',
    solution: currentPrediction.suggested_solution,
    heatmap_url: currentPrediction.heatmap_url,
    prediction_id: currentPrediction.prediction_id
  } : {
    disease: 'Early Blight',
    confidence: 94.3,
    severity: 'Moderate',
    solution: 'Apply fungicide containing chlorothalonil or copper-based compounds. Remove and destroy infected leaves. Ensure proper spacing between plants for air circulation. Water at the base of plants to avoid wetting foliage.',
    heatmap_url: null,
    prediction_id: 0
  };

  const handleBookmark = async () => {
    if (isBookmarking) return;
    
    setIsBookmarking(true);
    try {
      const action = isBookmarked ? 'remove' : 'add';
      const response = await toggleBookmark(result.prediction_id, 1, action);
      setIsBookmarked(response.bookmarked);
      toast.success(response.bookmarked ? 'Bookmarked successfully!' : 'Bookmark removed');
    } catch (error) {
      toast.error('Failed to update bookmark');
      console.error('Bookmark error:', error);
    } finally {
      setIsBookmarking(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex flex-col pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
        <button onClick={() => navigate('upload')} className="text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h2 className="text-gray-900">Analysis Result</h2>
        <div className="w-6" />
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 space-y-6">
        {/* Image with Heatmap Overlay */}
        <div className="bg-white rounded-2xl p-4 shadow-md">
          <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-gray-100">
            <ImageWithFallback
              src={selectedImage || result.heatmap_url || 'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=800'}
              alt="Analyzed plant"
              className="w-full h-full object-cover"
            />
            {/* Heatmap Overlay Simulation */}
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 via-transparent to-transparent" />
            <div className="absolute top-3 right-3 bg-black/70 text-white px-3 py-1 rounded-full">
              Heatmap
            </div>
          </div>
        </div>

        {/* Prediction Details */}
        <div className="bg-white rounded-2xl p-6 shadow-md">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-gray-900 mb-1">{result.disease}</h3>
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                {result.severity} Severity
              </Badge>
            </div>
            <div className="text-right">
              <div className="text-green-600 mb-1">{result.confidence}%</div>
              <p className="text-gray-500">Confidence</p>
            </div>
          </div>

          {/* Confidence Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div
              className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all"
              style={{ width: `${result.confidence}%` }}
            />
          </div>
        </div>

        {/* Suggested Solution */}
        <div className="bg-gradient-to-br from-green-50 to-white rounded-2xl p-6 shadow-md border border-green-100">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-green-600" />
            <h3 className="text-gray-900">Suggested Solution</h3>
          </div>
          <p className="text-gray-700 leading-relaxed">{result.solution}</p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-3">
          <Button
            variant="outline"
            onClick={() => navigate('history')}
            className="flex flex-col items-center gap-2 h-auto py-4 bg-white hover:bg-gray-50"
          >
            <Save className="w-5 h-5" />
            <span className="text-xs">Save</span>
          </Button>

          <Button
            variant="outline"
            onClick={handleBookmark}
            disabled={isBookmarking}
            className="flex flex-col items-center gap-2 h-auto py-4 bg-white hover:bg-gray-50"
          >
            <Bookmark className={`w-5 h-5 ${isBookmarked ? 'fill-green-600 text-green-600' : 'text-gray-600'}`} />
            <span className="text-xs">{isBookmarking ? 'Saving...' : isBookmarked ? 'Bookmarked' : 'Bookmark'}</span>
          </Button>

          <Button
            onClick={() => navigate('chat')}
            className="flex flex-col items-center gap-2 h-auto py-4 bg-gradient-to-br from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-xs">Chat AI</span>
          </Button>
        </div>

        {/* Additional Info */}
        <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
          <p className="text-gray-700">
            💡 Want more detailed advice? Chat with our AI assistant for personalized recommendations.
          </p>
        </div>
      </div>
    </div>
  );
}