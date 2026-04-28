import { Upload, History, MessageSquare, User, Leaf, Brain, Bookmark, Bot, ScanSearch, ArrowRight, LogOut } from 'lucide-react';

export default function HomeScreen({ navigate, onLogout }) {
  const menuItems = [
    { icon: Upload, label: 'Upload Image', screen: 'upload', color: 'from-green-500 to-green-600' },
    { icon: History, label: 'My History', screen: 'history', color: 'from-blue-500 to-blue-600' },
    { icon: Bookmark, label: 'Bookmarks', screen: 'bookmarks', color: 'from-pink-500 to-pink-600' },
    { icon: MessageSquare, label: 'AI Chat', screen: 'chat', color: 'from-purple-500 to-purple-600' },
    { icon: User, label: 'Profile', screen: 'profile', color: 'from-gray-500 to-gray-600' },
  ];
  const quickSteps = [
    {
      icon: Upload,
      title: '1. Upload a photo',
      description: 'Capture a clear close-up image of the affected leaf.',
      color: 'text-green-600'
    },
    {
      icon: ScanSearch,
      title: '2. Run prediction',
      description: 'Get disease class and confidence score in seconds.',
      color: 'text-blue-600'
    },
    {
      icon: Bot,
      title: '3. Ask the AI agent',
      description: 'Request treatment plans and prevention guidance.',
      color: 'text-purple-600'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white">
      <style>{`
        @keyframes homeFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes homePulse {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
      `}</style>

      {/* Header */}
      <div
        className="bg-gradient-to-r from-green-600 to-green-700 p-6 rounded-b-3xl shadow-lg"
        style={{ animation: 'homeFadeUp 500ms ease-out both' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Leaf className="w-8 h-8 text-white" />
            <h1 className="text-white">VisionQC</h1>
          </div>
          <div className="flex items-center gap-2">
            <Brain className="w-6 h-6 text-white" />
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1 rounded-lg border border-white/40 bg-white/10 px-3 py-1.5 text-white transition-colors hover:bg-white/20"
              aria-label="Log out"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
        <p className="text-white/90">Welcome back! Ready to analyze?</p>
      </div>

      {/* Main Content */}
      <div className="p-6 pb-28">
        <div style={{ animation: 'homeFadeUp 560ms ease-out both', animationDelay: '80ms' }}>
          <h2 className="text-gray-900 mb-2">How It Works</h2>
          <p className="text-gray-600 mb-4">
            After login, follow this quick workflow before starting deeper analysis.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {quickSteps.map((step, index) => (
            <div
              key={step.title}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              style={{
                animation: 'homeFadeUp 600ms ease-out both',
                animationDelay: `${140 + index * 90}ms`
              }}
            >
              <div className={`mb-2 flex items-center gap-2 ${step.color}`}>
                <step.icon className="w-5 h-5" style={{ animation: 'homePulse 2s ease-in-out infinite' }} />
                <h3>{step.title}</h3>
              </div>
              <p className="text-sm text-gray-600">{step.description}</p>
            </div>
          ))}
        </div>

        <button
          onClick={() => navigate('upload')}
          className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-white transition-all duration-300 hover:bg-green-700 hover:shadow-lg"
          style={{ animation: 'homeFadeUp 620ms ease-out both', animationDelay: '360ms' }}
        >
          Start the analysis
          <ArrowRight className="w-5 h-5" />
        </button>

        <h2 className="text-gray-900 mb-6">Dashboard</h2>

        <div className="grid grid-cols-2 gap-4">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={() => navigate(item.screen)}
              className="bg-white rounded-2xl p-6 shadow-md hover:shadow-lg transition-all active:scale-95 flex flex-col items-center gap-3"
              style={{
                animation: 'homeFadeUp 620ms ease-out both',
                animationDelay: `${420 + index * 40}ms`
              }}
            >
              <div className={`w-16 h-16 bg-gradient-to-br ${item.color} rounded-2xl flex items-center justify-center`}>
                <item.icon className="w-8 h-8 text-white" />
              </div>
              <span className="text-gray-900 text-center">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Stats Card */}
        <div className="mt-6 bg-white rounded-2xl p-6 shadow-md">
          <h3 className="text-gray-900 mb-4">Your Activity</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-green-600 mb-1">24</div>
              <div className="text-gray-600">Scans</div>
            </div>
            <div className="text-center">
              <div className="text-green-600 mb-1">12</div>
              <div className="text-gray-600">Saved</div>
            </div>
            <div className="text-center">
              <div className="text-green-600 mb-1">8</div>
              <div className="text-gray-600">Chats</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-md mx-auto flex justify-around p-4">
          <button onClick={() => navigate('home')} className="flex flex-col items-center gap-1 text-green-600">
            <Leaf className="w-6 h-6" />
            <span className="text-xs">Home</span>
          </button>
          <button onClick={() => navigate('upload')} className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600">
            <Upload className="w-6 h-6" />
            <span className="text-xs">Upload</span>
          </button>
          <button onClick={() => navigate('history')} className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600">
            <History className="w-6 h-6" />
            <span className="text-xs">History</span>
          </button>
          <button onClick={() => navigate('profile')} className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600">
            <User className="w-6 h-6" />
            <span className="text-xs">Profile</span>
          </button>
        </div>
      </div>
    </div>
  );
}
