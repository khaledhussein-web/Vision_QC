import { useEffect, useState } from 'react';
import SplashScreen from './components/SplashScreen';
import LoginScreen from './components/LoginScreen';
import RegisterScreen from './components/RegisterScreen';
import ForgotPasswordScreen from './components/ForgotPasswordScreen';
import ResetPasswordScreen from './components/ResetPasswordScreen';
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
import { createAdminUser, updateAdminUser, deleteAdminUser } from './utils/api';

const getResetTokenFromLocation = () => {
  if (typeof window === 'undefined') return '';
  const searchParams = new URLSearchParams(window.location.search);
  return String(searchParams.get('token') || '').trim();
};

const getInitialScreenFromLocation = () => {
  if (typeof window === 'undefined') return 'splash';

  const normalizedPath = String(window.location.pathname || '/').replace(/\/+$/, '') || '/';
  if (normalizedPath === '/reset-password') return 'reset-password';
  if (normalizedPath === '/forgot-password') return 'forgot-password';
  return 'splash';
};

export default function App() {
  const [currentScreen, setCurrentScreen] = useState(getInitialScreenFromLocation);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedImageId, setSelectedImageId] = useState(null);
  const [selectedAdminImage, setSelectedAdminImage] = useState(null);
  const [currentPrediction, setCurrentPrediction] = useState(null);
  const [uploadResetToken, setUploadResetToken] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [resetToken, setResetToken] = useState(getResetTokenFromLocation);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handlePopState = () => {
      setCurrentScreen(getInitialScreenFromLocation());
      setResetToken(getResetTokenFromLocation());
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const updateAddressBar = (screen, token = '') => {
    if (typeof window === 'undefined') return;

    if (screen === 'reset-password') {
      const query = new URLSearchParams();
      const safeToken = String(token || '').trim();
      if (safeToken) {
        query.set('token', safeToken);
      }
      const nextPath = `/reset-password${query.toString() ? `?${query.toString()}` : ''}`;
      window.history.replaceState(null, '', nextPath);
      return;
    }

    if (screen === 'forgot-password') {
      window.history.replaceState(null, '', '/forgot-password');
      return;
    }

    window.history.replaceState(null, '', '/');
  };

  const navigate = (screen, options = {}) => {
    let targetScreen = screen;

    // admin users should not be redirected to the regular user dashboard.
    if (isAdmin && screen === 'home') {
      targetScreen = 'admin-dashboard';
    }

    if (targetScreen === 'upload') {
      setSelectedImage(null);
      setCurrentPrediction(null);
      setUploadResetToken(prev => prev + 1);
    }
    if (targetScreen === 'admin-images') {
      setSelectedAdminImage(null);
    }

    if (targetScreen === 'reset-password') {
      const nextToken = String(options?.token || resetToken || '').trim();
      setResetToken(nextToken);
      updateAddressBar('reset-password', nextToken);
    } else if (targetScreen === 'forgot-password') {
      const nextEmail = String(options?.email || userEmail || '').trim();
      setForgotPasswordEmail(nextEmail);
      updateAddressBar('forgot-password');
    } else {
      if (resetToken) {
        setResetToken('');
      }
      if (forgotPasswordEmail) {
        setForgotPasswordEmail('');
      }
      updateAddressBar(targetScreen);
    }

    setCurrentScreen(targetScreen);
  };

  const handleLogin = (isAdminUser, userId, email, fullName) => {
    setIsAdmin(isAdminUser);
    setUserId(userId);
    setUserEmail(email || '');
    setUserName(fullName || '');
    if (isAdminUser) {
      navigate('admin-dashboard');
    } else {
      navigate('home');
    }
  };

  const handleAddUser = async (user) => {
    const fullName = String(user?.full_name || user?.name || '').trim();
    const email = String(user?.email || '').trim().toLowerCase();
    const password = String(user?.password || '');
    const passwordConfirm = String(user?.password_confirm || user?.passwordConfirm || password);
    const role = String(user?.role || 'user').toLowerCase();
    const status = String(user?.status || 'ACTIVE').trim().toUpperCase();

    return createAdminUser({
      full_name: fullName,
      email,
      password,
      password_confirm: passwordConfirm,
      role,
      status
    });
  };

  const handleUpdateUser = async (id, updates) => {
    return updateAdminUser(id, updates || {});
  };

  const handleDeleteUser = async (id) => {
    return deleteAdminUser(id);
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
      case 'reset-password':
        return {
          title: 'VisionQC - Reset Password | Set a New Password',
          description: 'Set a new password securely to regain access to your VisionQC account.'
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
          onForgotPassword={(email) => navigate('forgot-password', { email })} 
          onViewDocs={() => navigate('api-docs')}
        />; 
      case 'register':
        return <RegisterScreen onRegister={() => navigate('login')} onBack={() => navigate('login')} />;
      case 'forgot-password':
        return <ForgotPasswordScreen initialEmail={forgotPasswordEmail} onBack={() => navigate('login')} />;
      case 'reset-password':
        return <ResetPasswordScreen initialToken={resetToken} onBack={() => navigate('login')} />;
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
        return <ResultScreen navigate={navigate} selectedImage={selectedImage} currentPrediction={currentPrediction} currentUser={{ id: userId, name: userName, email: userEmail }} />;
      case 'chat':
        return <ChatScreen navigate={navigate} currentPrediction={currentPrediction} />;
      case 'history':
        return <HistoryScreen navigate={navigate} userId={userId} />;
      case 'bookmarks':
        return <BookmarksScreen navigate={navigate} userId={userId} />;
      case 'profile':
        return <ProfileScreen navigate={navigate} userId={userId} userEmail={userEmail} userName={userName} />;
      case 'payment':
        return <PaymentScreen navigate={navigate} userId={userId} userEmail={userEmail} />;
      case 'admin-dashboard':
        return <AdminDashboard navigate={navigate} />;
      case 'admin-images':
        return (
          <ImageManagement
            navigate={navigate}
            onSelectImage={(image) => {
              setSelectedImageId(image?.image_id ?? null);
              setSelectedAdminImage(image || null);
              navigate('admin-image-detail');
            }}
          />
        );
      case 'admin-image-detail':
        return (
          <ImageDetail
            navigate={navigate}
            imageId={selectedImageId}
            image={selectedAdminImage}
          />
        );
      case 'admin-reports':
        return <ReportsScreen navigate={navigate} />;
      case 'admin-access':
        return (
          <AccessControl
            navigate={navigate}
            onAddUser={handleAddUser}
            onUpdateUser={handleUpdateUser}
            onDeleteUser={handleDeleteUser}
          />
        ); 
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
