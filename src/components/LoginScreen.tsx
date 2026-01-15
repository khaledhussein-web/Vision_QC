import { useState } from 'react';
import { Mail, Lock, Leaf, Loader2, Code } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { login } from '../utils/api';
import { Screen } from '../App';

interface LoginScreenProps {
  onLogin: (isAdmin: boolean, userId: number) => void;
  onRegister: () => void;
  onForgotPassword: () => void;
  onViewDocs?: () => void;
}

export default function LoginScreen({ onLogin, onRegister, onForgotPassword, onViewDocs }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const response = await login(email, password);
      
      // Check if admin
      const isAdmin = email === 'admin@visionqc.com';
      onLogin(isAdmin, response.user_id);
    } catch (err: any) {
      setError(err.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white p-6 flex flex-col">
      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
        <div className="flex items-center justify-center mb-8">
          <Leaf className="w-12 h-12 text-green-600" />
        </div>
        
        <h2 className="text-center text-gray-900 mb-2">Welcome Back</h2>
        <p className="text-center text-gray-600 mb-8">Sign in to continue to VisionQC</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <Label htmlFor="email">Email</Label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button type="button" className="text-green-600 hover:text-green-700" onClick={onForgotPassword} disabled={loading}>
              Forgot Password?
            </button>
          </div>

          <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <span className="text-gray-600">Don't have an account? </span>
          <button onClick={onRegister} className="text-green-600 hover:text-green-700" disabled={loading}>
            Create Account
          </button>
        </div>

        {/* Admin Demo Credentials */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-gray-700 mb-2">Demo Credentials:</p>
          <p className="text-gray-600">Admin: admin@visionqc.com / admin123</p>
          <p className="text-gray-600">User: user@visionqc.com / password123</p>
        </div>
      </div>
    </div>
  );
}