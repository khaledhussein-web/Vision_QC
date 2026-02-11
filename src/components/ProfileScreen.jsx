import { ArrowLeft, Mail, Shield, CreditCard, User } from 'lucide-react';
import { Button } from './ui/button';

export default function ProfileScreen({ navigate, userId, userEmail }) {
  const resolvedUserId = userId || '—';
  const resolvedEmail = userEmail || 'Not available';

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex flex-col">
      <div className="bg-white border-b border-gray-200 p-4 flex items-center gap-3">
        <button onClick={() => navigate('home')} className="text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <User className="w-6 h-6 text-green-600" />
          <h2 className="text-gray-900">Profile</h2>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-6">
        <div className="bg-white rounded-2xl p-6 shadow-md flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <User className="w-8 h-8 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm uppercase text-gray-500">Account</p>
            <p className="text-lg text-gray-900">VisionQC User</p>
            <p className="text-sm text-gray-600">User ID: {resolvedUserId}</p>
          </div>
          <span className="text-sm text-green-700 bg-green-50 px-3 py-1 rounded-full">
            Free Plan
          </span>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-md space-y-4">
          <h3 className="text-gray-900">Account Details</h3>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs uppercase text-gray-500">Email</p>
              <p className="text-gray-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                {resolvedEmail}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs uppercase text-gray-500">Security</p>
              <p className="text-gray-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-gray-400" />
                Password protected
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-md space-y-4">
          <h3 className="text-gray-900">Subscription</h3>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm text-gray-600">Current plan</p>
              <p className="text-lg text-gray-900">Free</p>
            </div>
            <Button onClick={() => navigate('payment')} className="bg-green-600 hover:bg-green-700">
              <CreditCard className="w-4 h-4 mr-2" />
              Upgrade Plan
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-md space-y-4">
          <h3 className="text-gray-900">Quick Actions</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={() => navigate('forgot-password')}>
              Reset Password
            </Button>
            <Button variant="outline" onClick={() => navigate('history')}>
              View History
            </Button>
            <Button variant="outline" onClick={() => navigate('home')}>
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
