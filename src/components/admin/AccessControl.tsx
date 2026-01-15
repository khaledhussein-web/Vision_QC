import { useState } from 'react';
import { ArrowLeft, Plus, Trash2, Edit, Shield, User, CheckCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Screen } from '../../App';
import { UserData } from '../../App';
import { toast } from 'sonner';

interface AccessControlProps {
  navigate: (screen: Screen) => void;
  users: UserData[];
  onAddUser: (user: Omit<UserData, 'id' | 'joinDate'>) => void;
  onUpdateUser: (id: number, updates: Partial<UserData>) => void;
  onDeleteUser: (id: number) => void;
}

export default function AccessControl({ navigate, users, onAddUser, onUpdateUser, onDeleteUser }: AccessControlProps) {
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin'>('user');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editUserName, setEditUserName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserRole, setEditUserRole] = useState<'admin' | 'user'>('user');

  const handleAddUser = () => {
    const userData = newUserRole === 'admin' 
      ? {
          name: 'Administrator',
          email: 'admin@visionqc.com',
          role: newUserRole,
        }
      : {
          name: newUserName,
          email: newUserEmail,
          role: newUserRole,
        };
    
    onAddUser(userData);
    
    setNewUserName('');
    setNewUserEmail('');
    setNewUserRole('user');
    setIsDialogOpen(false);
    toast.success('User added successfully!');
  };

  const handleEditClick = (user: UserData) => {
    setEditingUser(user);
    setEditUserName(user.name);
    setEditUserEmail(user.email);
    setEditUserRole(user.role);
    setIsEditDialogOpen(true);
  };

  const handleUpdateUser = () => {
    if (editingUser) {
      onUpdateUser(editingUser.id, {
        name: editUserName,
        email: editUserEmail,
        role: editUserRole,
      });
      setIsEditDialogOpen(false);
      setEditingUser(null);
      toast.success('User updated successfully!');
    }
  };

  const handleDeleteUser = (id: number) => {
    onDeleteUser(id);
    toast.success('User deleted successfully!');
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'annotator':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const roleStats = [
    { role: 'Admins', count: users.filter(u => u.role === 'admin').length, color: 'text-red-600', bg: 'bg-red-50' },
    { role: 'Users', count: users.filter(u => u.role === 'user').length, color: 'text-gray-600', bg: 'bg-gray-50' },
  ];

  const regularUsers = users.filter(u => u.role === 'user');
  const admins = users.filter(u => u.role === 'admin');

  const renderUserCard = (user: UserData) => (
    <div
      key={user.id}
      className="p-4 bg-gray-50 rounded-xl"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
            {user.role === 'admin' ? (
              <Shield className="w-5 h-5 text-white" />
            ) : (
              <User className="w-5 h-5 text-white" />
            )}
          </div>
          <div>
            <h4 className="text-gray-900 mb-1">{user.name}</h4>
            <p className="text-gray-600">{user.email}</p>
            <p className="text-gray-500 mt-1">Joined: {user.joinDate}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Badge variant="outline" className={getRoleColor(user.role)}>
          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
        </Badge>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleEditClick(user)}
          disabled={user.role === 'admin'}
          className="flex-1"
        >
          <Edit className="w-4 h-4 mr-1" />
          Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleDeleteUser(user.id)}
          disabled={user.role === 'admin'}
          className="text-red-600 hover:text-red-700"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex flex-col pb-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('admin-dashboard')} className="text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h2 className="text-gray-900">Access Control</h2>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-green-600 hover:bg-green-700">
                <Plus className="w-4 h-4" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
                <DialogDescription>Enter the user's details to add them to the system.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="userRole">Role</Label>
                  <Select value={newUserRole} onValueChange={(value: 'user' | 'admin') => setNewUserRole(value)}>
                    <SelectTrigger id="userRole" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newUserRole === 'user' && (
                  <>
                    <div>
                      <Label htmlFor="userName">Full Name</Label>
                      <Input
                        id="userName"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        placeholder="John Doe"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="userEmail">Email</Label>
                      <Input
                        id="userEmail"
                        type="email"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        placeholder="john@example.com"
                        className="mt-1"
                      />
                    </div>
                  </>
                )}
                {newUserRole === 'admin' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-gray-700 mb-2">Admin account details:</p>
                    <p className="text-gray-600"><span>Email:</span> admin@visionqc.com</p>
                    <p className="text-gray-600"><span>Name:</span> Administrator</p>
                  </div>
                )}
                <Button
                  onClick={handleAddUser}
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={newUserRole === 'user' && (!newUserName || !newUserEmail)}
                >
                  Add {newUserRole === 'admin' ? 'Admin' : 'User'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit User</DialogTitle>
                <DialogDescription>Update the user's details.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="editUserName">Full Name</Label>
                  <Input
                    id="editUserName"
                    value={editUserName}
                    onChange={(e) => setEditUserName(e.target.value)}
                    placeholder="John Doe"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="editUserEmail">Email</Label>
                  <Input
                    id="editUserEmail"
                    type="email"
                    value={editUserEmail}
                    onChange={(e) => setEditUserEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="editUserRole">Role</Label>
                  <Select value={editUserRole} onValueChange={(value: 'admin' | 'user') => setEditUserRole(value)}>
                    <SelectTrigger id="editUserRole" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleUpdateUser}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={!editUserName || !editUserEmail}
                >
                  Update User
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {/* Role Statistics */}
        <div className="grid grid-cols-2 gap-3">
          {roleStats.map((stat, index) => (
            <div key={index} className="bg-white rounded-2xl p-4 shadow-md text-center">
              <div className={`w-10 h-10 ${stat.bg} rounded-xl flex items-center justify-center mx-auto mb-2`}>
                <Shield className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className={`${stat.color} mb-1`}>{stat.count}</div>
              <div className="text-gray-600">{stat.role}</div>
            </div>
          ))}
        </div>

        {/* Admins Section */}
        {admins.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-md">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-red-600" />
              <h3 className="text-gray-900">Administrators</h3>
              <Badge className="bg-red-50 text-red-700 border-red-200">{admins.length}</Badge>
            </div>
            <div className="space-y-3">
              {admins.map(renderUserCard)}
            </div>
          </div>
        )}

        {/* Regular Users Section */}
        <div className="bg-white rounded-2xl p-4 shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-gray-600" />
            <h3 className="text-gray-900">Users</h3>
            <Badge className="bg-gray-50 text-gray-700 border-gray-200">{regularUsers.length}</Badge>
          </div>
          {regularUsers.length > 0 ? (
            <div className="space-y-3">
              {regularUsers.map(renderUserCard)}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No users found</p>
              <p className="text-sm">Users will appear here once they register</p>
            </div>
          )}
        </div>

        {/* Permissions Info */}
        <div className="bg-gradient-to-br from-blue-50 to-white rounded-2xl p-5 shadow-md border border-blue-100">
          <h3 className="text-gray-900 mb-3">Role Permissions</h3>
          <div className="space-y-2 text-gray-700">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-red-600">Admin:</span> Full access to all features
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-gray-600">User:</span> Can upload and analyze images
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}