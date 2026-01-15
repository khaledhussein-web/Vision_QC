import { useState } from 'react';
import { ArrowLeft, Save, Edit, Award, User, Calendar, BarChart3 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Screen } from '../../App';
import { ImageWithFallback } from '../figma/ImageWithFallback';

interface ImageDetailProps {
  navigate: (screen: Screen) => void;
  imageId: number | null;
}

export default function ImageDetail({ navigate, imageId }: ImageDetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [disease, setDisease] = useState('Early Blight');
  const [confidence, setConfidence] = useState('94.3');
  const [notes, setNotes] = useState('Moderate severity with clear symptoms visible on leaves.');
  const [showSuccess, setShowSuccess] = useState(false);

  const imageData = {
    id: imageId || 1,
    image: 'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=800',
    originalDisease: 'Early Blight',
    confidence: 94.3,
    date: '2025-11-12',
    time: '14:30:25',
    user: 'john@example.com',
    verified: true,
    severity: 'Moderate',
    affectedArea: '35%',
  };

  const handleSave = () => {
    setIsEditing(false);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex flex-col pb-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('admin-images')} className="text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h2 className="text-gray-900">Image #{imageData.id}</h2>
          </div>
          {!isEditing ? (
            <Button
              onClick={() => setIsEditing(true)}
              variant="outline"
              className="gap-2"
            >
              <Edit className="w-4 h-4" />
              Edit
            </Button>
          ) : (
            <Button
              onClick={handleSave}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <Save className="w-4 h-4" />
              Save
            </Button>
          )}
        </div>

        {showSuccess && (
          <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg text-green-700 text-center">
            ✓ Label updated and added to training set
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {/* Image */}
        <div className="bg-white rounded-2xl p-4 shadow-md">
          <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-gray-100">
            <ImageWithFallback
              src={imageData.image}
              alt={imageData.originalDisease}
              className="w-full h-full object-cover"
            />
            {imageData.verified && (
              <div className="absolute top-3 right-3 flex items-center gap-2 bg-green-500 text-white px-3 py-1 rounded-full">
                <Award className="w-4 h-4" />
                <span>Verified</span>
              </div>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="bg-white rounded-2xl p-5 shadow-md">
          <h3 className="text-gray-900 mb-4">Image Metadata</h3>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-gray-500">Uploaded by</p>
                <p className="text-gray-900">{imageData.user}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-gray-500">Date & Time</p>
                <p className="text-gray-900">{imageData.date} at {imageData.time}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-gray-500">Affected Area</p>
                <p className="text-gray-900">{imageData.affectedArea}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Disease Information */}
        <div className="bg-white rounded-2xl p-5 shadow-md">
          <h3 className="text-gray-900 mb-4">Disease Information</h3>

          <div className="space-y-4">
            <div>
              <Label htmlFor="disease">Disease Type</Label>
              {isEditing ? (
                <Select value={disease} onValueChange={setDisease}>
                  <SelectTrigger id="disease" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Early Blight">Early Blight</SelectItem>
                    <SelectItem value="Late Blight">Late Blight</SelectItem>
                    <SelectItem value="Powdery Mildew">Powdery Mildew</SelectItem>
                    <SelectItem value="Leaf Spot">Leaf Spot</SelectItem>
                    <SelectItem value="Bacterial Blight">Bacterial Blight</SelectItem>
                    <SelectItem value="Rust Disease">Rust Disease</SelectItem>
                    <SelectItem value="Healthy">Healthy</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="mt-1 text-gray-900">{disease}</p>
              )}
            </div>

            <div>
              <Label htmlFor="confidence">Confidence Score (%)</Label>
              {isEditing ? (
                <Input
                  id="confidence"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={confidence}
                  onChange={(e) => setConfidence(e.target.value)}
                  className="mt-1"
                />
              ) : (
                <div className="mt-1">
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-700 border-green-200"
                  >
                    {confidence}%
                  </Badge>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="severity">Severity</Label>
              {isEditing ? (
                <Select defaultValue={imageData.severity}>
                  <SelectTrigger id="severity" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mild">Mild</SelectItem>
                    <SelectItem value="Moderate">Moderate</SelectItem>
                    <SelectItem value="Severe">Severe</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="mt-1 text-gray-900">{imageData.severity}</p>
              )}
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              {isEditing ? (
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
                  rows={3}
                />
              ) : (
                <p className="mt-1 text-gray-900">{notes}</p>
              )}
            </div>
          </div>
        </div>

        {/* Training Set Status */}
        <div className="bg-gradient-to-br from-blue-50 to-white rounded-2xl p-5 shadow-md border border-blue-100">
          <h3 className="text-gray-900 mb-2">Training Set Status</h3>
          <p className="text-gray-700">
            {isEditing 
              ? '⚠️ Changes will be saved to the training dataset after clicking Save.'
              : '✓ This image is included in the training dataset.'
            }
          </p>
        </div>
      </div>
    </div>
  );
}
