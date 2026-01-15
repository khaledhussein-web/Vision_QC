import { useEffect } from 'react';
import { Leaf, Brain, Eye } from 'lucide-react';

interface SplashScreenProps {
  onContinue: () => void;
}

export default function SplashScreen({ onContinue }: SplashScreenProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onContinue();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onContinue]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-500 to-green-600 flex flex-col items-center justify-center p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="relative">
          <Leaf className="w-16 h-16 text-white" />
          <Eye className="w-8 h-8 text-white absolute -top-2 -right-2" />
        </div>
        <Brain className="w-12 h-12 text-white" />
      </div>
      
      <h1 className="text-white text-center mb-4">VisionQC</h1>
      
      <p className="text-white/90 text-center max-w-xs">
        Detect, Learn, and Heal with VisionQC
      </p>
      
      <div className="mt-12 flex gap-2">
        <div className="w-2 h-2 bg-white/50 rounded-full animate-pulse" />
        <div className="w-2 h-2 bg-white/50 rounded-full animate-pulse delay-100" />
        <div className="w-2 h-2 bg-white/50 rounded-full animate-pulse delay-200" />
      </div>
    </div>
  );
}
