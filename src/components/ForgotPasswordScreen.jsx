export default function ForgotPasswordScreen({ onBack }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-6 shadow-lg max-w-md w-full">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Forgot Password</h2>
        <p className="text-gray-600 mb-6">Enter your email to reset your password.</p>
        <button onClick={onBack} className="w-full bg-green-600 text-white py-3 rounded-lg">
          Back to Login
        </button>
      </div>
    </div>
  );
}