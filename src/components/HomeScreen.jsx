import { Upload, History, MessageSquare, Lightbulb, User, Leaf, Brain, Bookmark } from 'lucide-react';

export default function HomeScreen({ navigate }) {
  const menuItems = [
    { icon: Upload, label: 'Upload Image', screen: 'upload', color: 'from-green-500 to-green-600' },
    { icon: History, label: 'My History', screen: 'history', color: 'from-blue-500 to-blue-600' },
    { icon: Bookmark, label: 'Bookmarks', screen: 'bookmarks', color: 'from-pink-500 to-pink-600' },
    { icon: MessageSquare, label: 'AI Chat', screen: 'chat', color: 'from-purple-500 to-purple-600' },
    { icon: Lightbulb, label: 'Solutions', screen: 'history', color: 'from-amber-500 to-amber-600' },
    { icon: User, label: 'Profile', screen: 'profile', color: 'from-gray-500 to-gray-600' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 p-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Leaf className="w-8 h-8 text-white" />
            <h1 className="text-white">VisionQC</h1>
          </div>
          <Brain className="w-6 h-6 text-white" />
        </div>
        <p className="text-white/90">Welcome back! Ready to analyze?</p>
      </div>

      {/* Main Content */}
      <div className="p-6">
        <h2 className="text-gray-900 mb-6">Dashboard</h2>

        <div className="grid grid-cols-2 gap-4">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={() => navigate(item.screen)}
              className="bg-white rounded-2xl p-6 shadow-md hover:shadow-lg transition-all active:scale-95 flex flex-col items-center gap-3"
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
