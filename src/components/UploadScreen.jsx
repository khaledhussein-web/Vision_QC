import { useState, useEffect, useRef } from 'react';
import { Camera, Upload, ArrowLeft, Leaf, Image as ImageIcon, X, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { toast } from 'sonner';
import { analyzeImage } from '../utils/api';

export default function UploadScreen({ navigate, setSelectedImage, selectedImage, onPredictionComplete }) {
  const [cameraMode, setCameraMode] = useState(false);
  const [stream, setStream] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setCameraMode(true);
      toast.success('Camera opened');
    } catch (error) {
      // Handle camera errors gracefully
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          toast.error('Camera permission denied. Please allow camera access in your browser settings.');
        } else if (error.name === 'NotFoundError') {
          toast.error('No camera found on this device.');
        } else if (error.name === 'NotReadableError') {
          toast.error('Camera is already in use by another application.');
        } else {
          toast.error('Could not access camera. Please try selecting from gallery instead.');
        }
      } else {
        toast.error('Could not access camera');
      }
      // Only log non-permission errors to avoid cluttering console with expected user denials
      if (error instanceof Error && error.name !== 'NotAllowedError') {
        console.error('Camera error:', error);
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraMode(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        canvas.toBlob((blob) => {
          if (!blob) {
            toast.error('Failed to capture photo');
            return;
          }
          const imageData = canvas.toDataURL('image/jpeg');
          const file = new File([blob], `camera-${Date.now()}.jpg`, {
            type: blob.type || 'image/jpeg'
          });
          setSelectedFile(file);
          setSelectedImage(imageData);
          stopCamera();
          toast.success('Photo captured');
        }, 'image/jpeg', 0.92);
      }
    }
  };

  const handleImageSelect = (type) => {
    if (type === 'camera') {
      startCamera();
    } else {
      // Trigger file input for gallery selection
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageData = event.target?.result;
        setSelectedImage(imageData);
        setSelectedFile(file);
        toast.success('Image selected from gallery');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile || uploading) {
      if (!selectedFile) {
        toast.error('Please select or capture an image first');
      }
      return;
    }

    setUploading(true);
    console.log('Selected file:', selectedFile);
    console.log('Sending to backend...');

    try {
      const response = await analyzeImage(selectedFile);
      console.log('AI result:', response);
      if (onPredictionComplete && response?.label) {
        onPredictionComplete(response);
        navigate('result');
      } else {
        toast.error('Prediction service returned no label');
      }
    } catch (error) {
      toast.error('Failed to analyze image');
      console.error('Analyze error:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 flex items-center gap-3">
        <button onClick={() => cameraMode ? stopCamera() : navigate('home')} className="text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <Leaf className="w-6 h-6 text-green-600" />
          <h2 className="text-gray-900">{cameraMode ? 'Camera' : 'Upload Image'}</h2>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 flex flex-col">
        {/* Camera View */}
        {cameraMode && (
          <div className="flex-1 flex flex-col">
            <p className="text-gray-600 mb-4 text-center">
              Position the camera to capture the plant
            </p>
            <div className="flex-1 bg-black rounded-2xl overflow-hidden shadow-lg relative mb-4">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              {/* Camera overlay grid */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="w-full h-full grid grid-cols-3 grid-rows-3">
                  {[...Array(9)].map((_, i) => (
                    <div key={i} className="border border-white/20" />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={stopCamera}
                variant="outline"
                className="flex-1 gap-2"
              >
                <X className="w-5 h-5" />
                Cancel
              </Button>
              <Button
                onClick={capturePhoto}
                className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 gap-2"
              >
                <Camera className="w-5 h-5" />
                Capture Photo
              </Button>
            </div>
            {/* Hidden canvas for capturing */}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}

        {/* Upload Options */}
        {!cameraMode && !selectedImage && (
          <>
            <p className="text-gray-600 mb-6 text-center">
              Choose an image to analyze for plant diseases or defects
            </p>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button
                onClick={() => handleImageSelect('camera')}
                className="bg-white rounded-2xl p-8 shadow-md hover:shadow-lg transition-all active:scale-95 flex flex-col items-center gap-3"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center">
                  <Camera className="w-8 h-8 text-white" />
                </div>
                <span className="text-gray-900">Camera</span>
              </button>

              <button
                onClick={() => handleImageSelect('gallery')}
                className="bg-white rounded-2xl p-8 shadow-md hover:shadow-lg transition-all active:scale-95 flex flex-col items-center gap-3"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-white" />
                </div>
                <span className="text-gray-900">Gallery</span>
              </button>
            </div>
            {/* Hidden file input for gallery selection */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </>
        )}

        {/* Image Preview */}
        {selectedImage && (
          <div className="mb-6">
            <div className="bg-white rounded-2xl p-4 shadow-md">
              <p className="text-gray-600 mb-3">Selected Image</p>
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-gray-100">
                <ImageWithFallback
                  src={selectedImage}
                  alt="Selected plant"
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                onClick={() => {
                  setSelectedImage(null);
                  setSelectedFile(null);
                }}
                className="mt-3 text-red-600 hover:text-red-700"
              >
                Remove Image
              </button>
            </div>
          </div>
        )}

        {/* Notes Input */}
        {selectedImage && (
          <div className="mb-6">
            <div className="bg-white rounded-2xl p-4 shadow-md">
              <Label htmlFor="notes" className="text-gray-900 mb-2">Additional Notes (Optional)</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Describe what you see..."
                className="mt-1"
              />
            </div>
          </div>
        )}

        {/* Analyze Button */}
        {selectedImage && (
          <Button
            onClick={handleAnalyze}
            disabled={uploading}
            className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-lg py-6"
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Upload className="w-5 h-5 mr-2" />
            )}
            {uploading ? 'Analyzing...' : 'View Result'}
          </Button>
        )}

        {/* Instructions */}
        {!cameraMode && !selectedImage && (
          <div className="mt-6 bg-green-50 rounded-2xl p-4">
            <h3 className="text-gray-900 mb-2">Tips for Best Results</h3>
            <ul className="space-y-1 text-gray-600">
              <li>• Ensure good lighting</li>
              <li>• Focus on the affected area</li>
              <li>• Keep the image clear and sharp</li>
              <li>• Avoid shadows if possible</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
