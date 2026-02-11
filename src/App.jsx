import { useState } from 'react';
import SplashScreen from './components/SplashScreen';
import LoginScreen from './components/LoginScreen';
import RegisterScreen from './components/RegisterScreen';
import ForgotPasswordScreen from './components/ForgotPasswordScreen';
import HomeScreen from './components/HomeScreen';
import UploadScreen from './components/UploadScreen';
import ResultScreen from './components/ResultScreen';
import ChatScreen from './components/ChatScreen';
import HistoryScreen from './components/HistoryScreen';
import BookmarksScreen from './components/BookmarksScreen';
import ProfileScreen from './components/ProfileScreen';
import PaymentScreen from './components/PaymentScreen';
import AdminDashboard from './components/admin/AdminDashboard';
import ImageManagement from './components/admin/ImageManagement';
import ImageDetail from './components/admin/ImageDetail';
import ReportsScreen from './components/admin/ReportsScreen';
import AccessControl from './components/admin/AccessControl';
import APIDocumentation from './components/APIDocumentation';
import SEOHead from './components/SEOHead';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('splash');
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedImageId, setSelectedImageId] = useState(null);
  const [currentPrediction, setCurrentPrediction] = useState(null);
  const [uploadResetToken, setUploadResetToken] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [users, setUsers] = useState([
    {
      id: 1,
      name: 'Admin User',
      email: 'admin@visionqc.com',
      role: 'admin',
      joinDate: '2025-01-01',
    },
    {
      id: 2,
      name: 'Sarah Johnson',
      email: 'sarah@visionqc.com',
      role: 'annotator',
      joinDate: '2025-02-15',
    },
    {
      id: 3,
      name: 'Mike Chen',
      email: 'mike@visionqc.com',
      role: 'annotator',
      joinDate: '2025-03-10',
    },
    {
      id: 4,
      name: 'Emily Davis',
      email: 'emily@visionqc.com',
      role: 'user',
      joinDate: '2025-05-20',
    },
    {
      id: 5,
      name: 'John Smith',
      email: 'john@example.com',
      role: 'user',
      joinDate: '2025-06-01',
    },
  ]);

  const navigate = (screen, options = {}) => {
    if (screen === 'upload') {
      setSelectedImage(null);
      setCurrentPrediction(null);
      setUploadResetToken(prev => prev + 1);
    }
    setCurrentScreen(screen);
  };

  const handleLogin = (isAdminUser, userId, email) => {
    setIsAdmin(isAdminUser);
    setUserId(userId);
    setUserEmail(email || '');
    if (isAdminUser) {
      navigate('admin-dashboard');
    } else {
      navigate('home');
    }
  };

  const handleAddUser = (user) => {
    const newUser = {
      ...user,
      id: Math.max(...users.map(u => u.id), 0) + 1,
      joinDate: new Date().toISOString().split('T')[0],
    };
    setUsers([...users, newUser]);
  };

  const handleUpdateUser = (id, updates) => {
    setUsers(users.map(user => 
      user.id === id ? { ...user, ...updates } : user
    ));
  };

  const handleDeleteUser = (id) => {
    setUsers(users.filter(user => user.id !== id));
  };

  // Get SEO data based on current screen
  const getSEOData = () => {
    switch (currentScreen) {
      case 'splash':
      case 'login':
        return {
          title: 'VisionQC - Login | AI Plant Disease Detection',
          description: 'Sign in to VisionQC to access AI-powered plant disease detection and analysis tools.'
        };
      case 'register':
        return {
          title: 'VisionQC - Sign Up | Create Your Account',
          description: 'Create a VisionQC account to start detecting and analyzing plant diseases with AI technology.'
        };
      case 'forgot-password':
        return {
          title: 'VisionQC - Forgot Password | Reset Your Account',
          description: 'Reset your VisionQC account password to regain access to your plant disease analysis tools.'
        };
      case 'home':
        return {
          title: 'VisionQC - Dashboard | AI Plant Disease Detection',
          description: 'Access your VisionQC dashboard to upload images, view history, chat with AI, and manage your plant disease analysis.'
        };
      case 'upload':
        return {
          title: 'VisionQC - Upload Image | Detect Plant Diseases',
          description: 'Upload or capture plant images to detect diseases using advanced AI technology.'
        };
      case 'result':
        return {
          title: 'VisionQC - Analysis Results | Disease Detection',
          description: 'View detailed AI analysis results including disease identification, confidence scores, and treatment recommendations.'
        };
      case 'chat':
        return {
          title: 'VisionQC - AI Chat | Plant Disease Assistant',
          description: 'Chat with our AI assistant for personalized plant disease diagnosis and treatment recommendations.'
        };
      case 'history':
        return {
          title: 'VisionQC - Analysis History | Your Scans',
          description: 'View and manage your plant disease analysis history and bookmarked results.'
        };
      case 'bookmarks':
        return {
          title: 'VisionQC - Bookmarks | Saved Results',
          description: 'Access your saved plant disease analysis results for quick reference.'
        };
      case 'profile':
        return {
          title: 'VisionQC - Profile | Account Settings',
          description: 'Manage your VisionQC profile, subscription, and account settings.'
        };
      case 'payment':
        return {
          title: 'VisionQC - Subscription Plans | Upgrade',
          description: 'Choose the best VisionQC subscription plan for your plant disease detection needs.'
        };
      case 'admin-dashboard':
        return {
          title: 'VisionQC - Admin Dashboard | Management Panel',
          description: 'Admin dashboard for managing images, users, and generating reports for VisionQC.'
        };
      case 'admin-images':
        return {
          title: 'VisionQC - Image Management | Admin Panel',
          description: 'View, filter, and manage all uploaded plant disease images with advanced search and filtering.'
        };
      case 'admin-image-detail':
        return {
          title: 'VisionQC - Image Details | Admin Panel',
          description: 'View and update image labels and annotations for training dataset improvement.'
        };
      case 'admin-reports':
        return {
          title: 'VisionQC - Reports | Generate Analytics',
          description: 'Generate and export comprehensive reports in CSV or JSON format based on various criteria.'
        };
      case 'admin-access':
        return {
          title: 'VisionQC - Access Control | User Management',
          description: 'Manage user roles, permissions, and access control for VisionQC platform.'
        };
      case 'api-docs':
        return {
          title: 'VisionQC - API Documentation | Developer Resources',
          description: 'Access detailed API documentation for integrating VisionQC into your applications.'
        };
      default:
        return {
          title: 'VisionQC - AI-Powered Plant Disease Detection',
          description: 'VisionQC uses advanced AI to detect, analyze, and provide solutions for plant diseases.'
        };
    }
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'splash':
        return <SplashScreen onContinue={() => navigate('login')} />;
      case 'login':
        return <LoginScreen 
          onLogin={handleLogin} 
          onRegister={() => navigate('register')} 
          onForgotPassword={() => navigate('forgot-password')} 
          onViewDocs={() => navigate('api-docs')}
        />; 
      case 'register':
        return <RegisterScreen onRegister={() => navigate('login')} onBack={() => navigate('login')} />;
      case 'forgot-password':
        return <ForgotPasswordScreen onBack={() => navigate('login')} />;
      case 'home':
        return <HomeScreen navigate={navigate} />;
      case 'upload':
        return <UploadScreen 
          navigate={navigate} 
          setSelectedImage={setSelectedImage} 
          selectedImage={selectedImage} 
          resetKey={uploadResetToken}
          onPredictionComplete={(prediction) => setCurrentPrediction(prediction)}
        />; 
      case 'result':
        return <ResultScreen navigate={navigate} selectedImage={selectedImage} currentPrediction={currentPrediction} />;
      case 'chat':
        return <ChatScreen navigate={navigate} />;
      case 'history':
        return <HistoryScreen navigate={navigate} userId={userId} />;
      case 'bookmarks':
        return <BookmarksScreen navigate={navigate} userId={userId} />;
      case 'profile':
        return <ProfileScreen navigate={navigate} userId={userId} userEmail={userEmail} />;
      case 'payment':
        return <PaymentScreen navigate={navigate} userId={userId} userEmail={userEmail} />;
      case 'admin-dashboard':
        return <AdminDashboard navigate={navigate} />;
      case 'admin-images':
        return <ImageManagement navigate={navigate} onSelectImage={(id) => { setSelectedImageId(id); navigate('admin-image-detail'); }} />;
      case 'admin-image-detail':
        return <ImageDetail navigate={navigate} imageId={selectedImageId} />;
      case 'admin-reports':
        return <ReportsScreen navigate={navigate} />;
      case 'admin-access':
        return <AccessControl 
          navigate={navigate} 
          users={users}
          onAddUser={handleAddUser}
          onUpdateUser={handleUpdateUser}
          onDeleteUser={handleDeleteUser}
        />; 
      case 'api-docs':
        return <APIDocumentation navigate={navigate} />;
      default:
        return <HomeScreen navigate={navigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Responsive container: mobile-first with max-width on larger screens */}
      <div className="mx-auto lg:max-w-7xl max-w-md min-h-screen bg-white lg:shadow-xl shadow-lg">
        <SEOHead {...getSEOData()} />
        {renderScreen()}
      </div>
    </div>
  );
}
