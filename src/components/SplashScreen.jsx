import { ArrowRight, Brain, Leaf } from 'lucide-react';

export default function SplashScreen({ onContinue }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-600 to-green-700 p-6 flex items-center justify-center">
      <style>{`
        @keyframes splashFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="max-w-xl w-full text-center text-white">
        <div
          className="inline-flex items-center justify-center gap-3 mb-6"
          style={{ animation: 'splashFadeUp 500ms ease-out both' }}
        >
          <Leaf className="w-14 h-14" />
          <Brain className="w-12 h-12" />
        </div>

        <p
          className="text-white/95 mb-2"
          style={{ animation: 'splashFadeUp 550ms ease-out both', animationDelay: '80ms' }}
        >
          VisionQC
        </p>
        <h1
          className="text-white mb-4"
          style={{ animation: 'splashFadeUp 600ms ease-out both', animationDelay: '140ms' }}
        >
          AI-powered crop analysis and treatment guidance
        </h1>
        <p
          className="text-white/85 mb-8"
          style={{ animation: 'splashFadeUp 650ms ease-out both', animationDelay: '200ms' }}
        >
          Sign in to start your analysis workflow.
        </p>

        <button
          onClick={onContinue}
          className="mx-auto flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-green-700 hover:bg-green-50"
          style={{ animation: 'splashFadeUp 700ms ease-out both', animationDelay: '280ms' }}
        >
          Continue to Login
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
