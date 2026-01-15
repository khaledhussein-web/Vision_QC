import { useState } from 'react';
import { ArrowLeft, Mail, Leaf, Send, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { forgotPassword } from '../utils/api';

interface ForgotPasswordScreenProps {
  onBack: () => void;
}

export default function ForgotPasswordScreen({ onBack }: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await forgotPassword(email);
      setIsSubmitted(true);
    } catch (err: any) {
      setError(err.error || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-white p-6 flex flex-col">
        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>

          <h2 className="text-gray-900 mb-3">Check Your Email</h2>
          <p className="text-gray-600 mb-6">
            We've sent a password reset link to <strong>{email}</strong>
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-left">
            <p className="text-gray-700 mb-2">Next Steps:</p>
            <ul className="space-y-2 text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">•</span>
                <span>Check your inbox and spam folder</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">•</span>
                <span>Click the reset link in the email</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">•</span>
                <span>Create a new password</span>
              </li>
            </ul>
          </div>

          <Button
            onClick={onBack}
            className="w-full bg-green-600 hover:bg-green-700 mb-4"
          >
            Back to Login
          </Button>

          <button
            onClick={() => setIsSubmitted(false)}
            className="text-green-600 hover:text-green-700"
          >
            Didn't receive the email? Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white p-6 flex flex-col">
      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Login
        </button>

        <div className="flex items-center justify-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <Leaf className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <h2 className="text-center text-gray-900 mb-2">Forgot Password?</h2>
        <p className="text-center text-gray-600 mb-8">
          No worries! Enter your email and we'll send you reset instructions.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="email">Email Address</Label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700 gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Send Reset Link
          </Button>
        </form>

        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-gray-700">
            Remember your password?{' '}
            <button onClick={onBack} className="text-green-600 hover:text-green-700">
              Sign In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}