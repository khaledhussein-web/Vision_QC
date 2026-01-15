import { LayoutDashboard, Image, FileBarChart, Users, LogOut, BarChart3, Database, Shield } from 'lucide-react';
import { Screen } from '../../App';

interface AdminDashboardProps {
  navigate: (screen: Screen) => void;
}

export default function AdminDashboard({ navigate }: AdminDashboardProps) {
  const menuItems = [
    { 
      icon: Image, 
      label: 'Images Management', 
      screen: 'admin-images' as Screen, 
      color: 'from-blue-500 to-blue-600',
      description: 'View, filter, and update image labels'
    },
    { 
      icon: FileBarChart, 
      label: 'Generate Reports', 
      screen: 'admin-reports' as Screen, 
      color: 'from-green-500 to-green-600',
      description: 'Export data as CSV or JSON'
    },
    { 
      icon: Users, 
      label: 'Access Control', 
      screen: 'admin-access' as Screen, 
      color: 'from-purple-500 to-purple-600',
      description: 'Manage user roles and permissions'
    },
  ];

  const stats = [
    { label: 'Total Images', value: '1,247', icon: Database, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Total Users', value: '89', icon: Users, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Admins', value: '12', icon: Shield, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Reports Generated', value: '34', icon: BarChart3, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-8 h-8 text-white" />
            <h1 className="text-white">Admin Panel</h1>
          </div>
          <button 
            onClick={() => navigate('login')}
            className="text-white/90 hover:text-white"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </div>
        <p className="text-white/90">Welcome back, Administrator</p>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {stats.map((stat, index) => (
            <div key={index} className="bg-white rounded-2xl p-4 shadow-md">
              <div className={`w-10 h-10 ${stat.bg} rounded-xl flex items-center justify-center mb-2`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className={`${stat.color} mb-1`}>{stat.value}</div>
              <div className="text-gray-600">{stat.label}</div>
            </div>
          ))}
        </div>

        <h2 className="text-gray-900 mb-4">Management</h2>

        {/* Menu Items */}
        <div className="space-y-3">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={() => navigate(item.screen)}
              className="w-full bg-white rounded-2xl p-5 shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-4"
            >
              <div className={`w-14 h-14 bg-gradient-to-br ${item.color} rounded-2xl flex items-center justify-center flex-shrink-0`}>
                <item.icon className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-gray-900 mb-1">{item.label}</div>
                <div className="text-gray-500">{item.description}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Recent Activity */}
        <div className="mt-6 bg-white rounded-2xl p-6 shadow-md">
          <h3 className="text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <div className="flex-1">
                <p className="text-gray-900">Label updated for image #1234</p>
                <p className="text-gray-500">2 hours ago</p>
              </div>
            </div>
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              <div className="flex-1">
                <p className="text-gray-900">Report generated (CSV)</p>
                <p className="text-gray-500">5 hours ago</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-purple-500 rounded-full" />
              <div className="flex-1">
                <p className="text-gray-900">New admin added</p>
                <p className="text-gray-500">1 day ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}