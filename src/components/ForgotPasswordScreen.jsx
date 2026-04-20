import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { forgotPassword } from '../utils/api';

export default function ForgotPasswordScreen({ initialEmail = '', onBack }) {
  const [email, setEmail] = useState(String(initialEmail || '').trim());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [resetUrl, setResetUrl] = useState('');
  const [deliveryWarning, setDeliveryWarning] = useState('');

  useEffect(() => {
    setEmail(String(initialEmail || '').trim());
  }, [initialEmail]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');
    setResetUrl('');
    setDeliveryWarning('');
    setLoading(true);

    try {
      const response = await forgotPassword(email);
      setSuccessMessage(
        response?.message || 'If the email is registered, a password reset link has been sent.'
      );
      if (response?.reset_url) {
        setResetUrl(String(response.reset_url));
      }
      if (response?.email_delivery === 'not_sent') {
        const reason = String(response?.email_reason || 'delivery_failed').trim();
        const providerError = String(response?.email_error || '').trim();
        setDeliveryWarning(
          providerError
            ? `Email delivery failed (${reason}): ${providerError}`
            : `Email delivery failed (${reason}).`
        );
      }
    } catch (apiError) {
      setError(apiError?.error || 'Failed to send reset request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white p-6 flex flex-col">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        disabled={loading}
      >
        <ArrowLeft className="w-5 h-5" />
        Back
      </button>

      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
        <h2 className="text-center text-gray-900 mb-2">Forgot Password</h2>
        <p className="text-center text-gray-600 mb-8">
          Enter your email and we will send a reset link.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-center">
            {successMessage}
          </div>
        )}

        {deliveryWarning && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
            {deliveryWarning}
          </div>
        )}

        {resetUrl && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm break-all">
            Reset URL (dev):{' '}
            <a
              href={resetUrl}
              className="underline"
            >
              {resetUrl}
            </a>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="forgot-email">Email</Label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                id="forgot-email"
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="pl-10"
                required
                disabled={loading}
              />
            </div>
          </div>

          <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              'Send Reset Link'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
