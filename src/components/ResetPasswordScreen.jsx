import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, KeyRound, Loader2, Lock } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { resetPassword, validateResetToken } from '../utils/api';

export default function ResetPasswordScreen({ initialToken = '', onBack }) {
  const [token, setToken] = useState(String(initialToken || '').trim());
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [validatingToken, setValidatingToken] = useState(false);
  const [tokenValidationError, setTokenValidationError] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const hasToken = useMemo(() => String(token || '').trim().length > 0, [token]);

  useEffect(() => {
    setToken(String(initialToken || '').trim());
  }, [initialToken]);

  useEffect(() => {
    const urlToken = String(initialToken || '').trim();
    if (!urlToken) {
      setTokenValidationError('');
      setValidatingToken(false);
      return;
    }

    let active = true;
    setValidatingToken(true);
    setTokenValidationError('');

    validateResetToken(urlToken)
      .catch((apiError) => {
        if (!active) return;
        setTokenValidationError(apiError?.error || 'Invalid or expired reset token.');
      })
      .finally(() => {
        if (active) {
          setValidatingToken(false);
        }
      });

    return () => {
      active = false;
    };
  }, [initialToken]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    const trimmedToken = String(token || '').trim();
    if (!trimmedToken) {
      setError('Reset token is required.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await validateResetToken(trimmedToken);
      const response = await resetPassword(trimmedToken, password, confirmPassword);
      setSuccessMessage(
        response?.message || 'Password reset successful. You can now sign in with your new password.'
      );
      setPassword('');
      setConfirmPassword('');
    } catch (apiError) {
      setError(apiError?.error || 'Failed to reset password. Please try again.');
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
        <h2 className="text-center text-gray-900 mb-2">Reset Password</h2>
        <p className="text-center text-gray-600 mb-8">Set a new password for your VisionQC account.</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center">
            {error}
          </div>
        )}

        {tokenValidationError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center">
            {tokenValidationError}
          </div>
        )}

        {validatingToken && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-center">
            Validating reset token...
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-center">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="reset-token">Reset Token</Label>
            <div className="relative mt-1">
              <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                id="reset-token"
                type="text"
                placeholder="Paste reset token"
                value={token}
                onChange={(event) => {
                  setToken(event.target.value);
                  setTokenValidationError('');
                }}
                className="pl-10"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="reset-password">New Password</Label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                id="reset-password"
                type="password"
                placeholder="********"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="pl-10"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="reset-confirm-password">Confirm Password</Label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                id="reset-confirm-password"
                type="password"
                placeholder="********"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="pl-10"
                required
                disabled={loading}
              />
            </div>
          </div>

          <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={loading || validatingToken || !hasToken}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Resetting...
              </>
            ) : (
              'Reset Password'
            )}
          </Button>
        </form>

        {successMessage && (
          <Button
            type="button"
            variant="outline"
            className="w-full mt-4"
            onClick={onBack}
            disabled={loading}
          >
            Back to Login
          </Button>
        )}
      </div>
    </div>
  );
}
