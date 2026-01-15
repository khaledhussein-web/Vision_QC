import { ArrowLeft, User, Mail, Edit, LogOut, CreditCard, Leaf, Save, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Screen } from '../App';
import { useState } from 'react';
import { toast } from 'sonner';

interface ProfileScreenProps {
  navigate: (screen: Screen) => void;
}

export default function ProfileScreen({ navigate }: ProfileScreenProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [userData, setUserData] = useState({
    name: 'John Doe',
    email: 'john.doe@example.com',
    subscription: 'Free Plan',
  });

  const [editedData, setEditedData] = useState({ ...userData });

  const handleEdit = () => {
    setIsEditing(true);
    setEditedData({ ...userData });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedData({ ...userData });
  };

  const handleSave = () => {
    setUserData({ ...editedData });
    setIsEditing(false);
    toast.success('Profile updated successfully!');
  };

  const handleChange = (field: string, value: string) => {
    setEditedData({ ...editedData, [field]: value });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex flex-col pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 p-6 rounded-b-3xl shadow-lg">
        <button onClick={() => navigate('home')} className="text-white hover:text-white/80 mb-4">
          <ArrowLeft className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center">
            <User className="w-10 h-10 text-green-600" />
          </div>
          <div>
            <h2 className="text-white mb-1">{userData.name}</h2>
            <p className="text-white/80">{userData.subscription}</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 space-y-4">
        {/* Personal Information */}
        <div className="bg-white rounded-2xl p-6 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-900">Personal Information</h3>
            {isEditing && (
              <div className="flex gap-2">
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  size="sm"
                  className="gap-2 bg-green-600 hover:bg-green-700"
                >
                  <Save className="w-4 h-4" />
                  Save
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {/* Full Name */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                {isEditing ? (
                  <div className="space-y-1">
                    <Label htmlFor="name" className="text-gray-500">Full Name</Label>
                    <Input
                      id="name"
                      value={editedData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      className="h-9"
                    />
                  </div>
                ) : (
                  <>
                    <p className="text-gray-500">Full Name</p>
                    <p className="text-gray-900">{userData.name}</p>
                  </>
                )}
              </div>
            </div>

            {/* Email */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-gray-500">Email</p>
                <p className="text-gray-900">{userData.email}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {!isEditing && (
            <Button
              onClick={handleEdit}
              variant="outline"
              className="w-full bg-white justify-start gap-3 h-auto py-4"
            >
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <Edit className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-gray-900">Edit Profile</span>
            </Button>
          )}

          <Button
            onClick={() => navigate('payment')}
            variant="outline"
            className="w-full bg-white justify-start gap-3 h-auto py-4"
          >
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-gray-900">Subscription</p>
              <p className="text-gray-500">Upgrade to Pro</p>
            </div>
          </Button>

          <Button
            variant="outline"
            onClick={() => navigate('login')}
            className="w-full bg-white justify-start gap-3 h-auto py-4 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
              <LogOut className="w-5 h-5 text-red-600" />
            </div>
            <span>Logout</span>
          </Button>
        </div>

        {/* App Version */}
        <div className="text-center pt-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Leaf className="w-4 h-4 text-green-600" />
            <p className="text-gray-500">VisionQC v1.0.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}