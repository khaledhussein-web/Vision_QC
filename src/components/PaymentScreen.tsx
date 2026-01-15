import { ArrowLeft, CreditCard } from 'lucide-react';
import { Button } from './ui/button';
import { Screen } from '../App';

interface PaymentScreenProps {
  navigate: (screen: Screen) => void;
}

export default function PaymentScreen({ navigate }: PaymentScreenProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex flex-col pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 flex items-center gap-3">
        <button onClick={() => navigate('profile')} className="text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h2 className="text-gray-900">Subscription</h2>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 flex flex-col justify-center max-w-md mx-auto w-full">
        {/* Current Plan */}
        <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-gray-900">Current Plan</h3>
              <p className="text-gray-600">Free Plan</p>
            </div>
          </div>

          <div className="py-4 border-t border-gray-100">
            <p className="text-gray-600 text-center">
              You are currently on the Free Plan
            </p>
          </div>
        </div>

        {/* Info Message */}
        <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
          <p className="text-gray-700 text-center mb-2">
            💳 Subscription Feature
          </p>
          <p className="text-gray-600 text-center">
            This is a demo subscription page. Upgrade options will be available in the full version.
          </p>
        </div>

        {/* Placeholder Button */}
        <Button
          className="w-full mt-6 bg-gray-300 text-gray-600 cursor-not-allowed"
          disabled
        >
          Upgrade (Coming Soon)
        </Button>
      </div>
    </div>
  );
}
