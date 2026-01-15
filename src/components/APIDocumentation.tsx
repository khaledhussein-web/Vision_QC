import { Code, Copy, Check, ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';
import { Screen } from '../App';

interface APIDocumentationProps {
  navigate?: (screen: Screen) => void;
}

interface APIEndpoint {
  title: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  description: string;
  request?: any;
  response: any;
  error: any;
}

export default function APIDocumentation({ navigate }: APIDocumentationProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const endpoints: APIEndpoint[] = [
    {
      title: 'Login Authentication',
      method: 'POST',
      url: '/api/login',
      description: 'First time usage, user must login to use the app',
      request: {
        username: 'varchar',
        password: 'varchar'
      },
      response: {
        token: 'varchar',
        user_id: 'int'
      },
      error: {
        status: 'int',
        error: 'varchar'
      }
    },
    {
      title: 'User Registration',
      method: 'POST',
      url: '/api/register',
      description: 'Creates a new user account for accessing the mobile application.',
      request: {
        email: 'varchar',
        password: 'varchar',
        password_confirm: 'varchar'
      },
      response: {
        status: 'success',
        user_id: 'int'
      },
      error: {
        status: 'int',
        error: 'varchar'
      }
    },
    {
      title: 'Forgot Password',
      method: 'POST',
      url: '/api/auth/forgot-password',
      description: 'Request password reset — system sends a reset link to user email.',
      request: {
        email: 'varchar'
      },
      response: {
        status: 'string',
        message: 'string'
      },
      error: {
        status: 'int',
        error: 'varchar'
      }
    },
    {
      title: 'Reset Password',
      method: 'POST',
      url: '/api/auth/reset-password',
      description: 'Use token from reset email to set a new password.',
      request: {
        token: 'varchar',
        password: 'varchar',
        password_confirmation: 'varchar'
      },
      response: {
        status: 'string',
        message: 'string'
      },
      error: {
        status: 'int',
        error: 'varchar'
      }
    },
    {
      title: 'Upload Image',
      method: 'POST',
      url: '/api/images/upload',
      description: 'Upload an image (camera or gallery). Returns image metadata and stored image id. Requires Authorization header: Bearer <token>.',
      request: {
        image_file: 'file (jpg/png/webp)',
        metadata: 'json (optional)'
      },
      response: {
        image_id: 'int',
        image_url: 'varchar',
        uploaded_at: 'timestamp'
      },
      error: {
        status: 'int',
        error: 'varchar'
      }
    },
    {
      title: 'Get Prediction Details',
      method: 'GET',
      url: '/api/predictions/{prediction_id}',
      description: 'Fetch detailed prediction result including heatmap and suggested solution.',
      response: {
        prediction_id: 'int',
        image_id: 'int',
        label: 'varchar',
        confidence: 'decimal',
        heatmap_url: 'varchar',
        suggested_solution: 'text'
      },
      error: {
        status: 'int',
        error: 'varchar'
      }
    },
    {
      title: 'User History / Predictions List',
      method: 'GET',
      url: '/api/users/{user_id}/history?page=1&per_page=20',
      description: 'Return paginated list of the user past predictions and related metadata (supports filtering). Requires Authorization.',
      response: {
        page: 'int',
        per_page: 'int',
        total: 'int',
        items: [
          {
            prediction_id: 'int',
            image_url: 'varchar',
            label: 'varchar',
            confidence: 'decimal',
            suggested_solution: 'text',
            heatmap_url: 'varchar',
            created_at: 'timestamp',
            bookmarked: 'boolean'
          }
        ]
      },
      error: {
        status: 'int',
        error: 'varchar'
      }
    },
    {
      title: 'Bookmark / Unbookmark Prediction',
      method: 'POST',
      url: '/api/predictions/{prediction_id}/bookmark',
      description: 'Mark a prediction as favorite/bookmark or remove bookmark. Requires Authorization.',
      request: {
        user_id: 'int',
        action: 'varchar' // "add" or "remove"
      },
      response: {
        status: 'string',
        bookmarked: 'boolean'
      },
      error: {
        status: 'int',
        error: 'varchar'
      }
    },
    {
      title: 'Get Chat History',
      method: 'GET',
      url: '/api/chat/{chat_id}',
      description: 'Retrieve the conversation history for a given chat or user. Requires Authorization.',
      response: {
        chat_id: 'int',
        user_id: 'int',
        messages: [
          {
            message_id: 'int',
            sender: 'varchar',
            content: 'text',
            created_at: 'timestamp'
          }
        ]
      },
      error: {
        status: 'int',
        error: 'varchar'
      }
    },
    {
      title: 'AI Chat Message',
      method: 'POST',
      url: '/api/chat',
      description: 'Send a user message to the AI assistant (contextual to an image/prediction). Requires Authorization.',
      request: {
        user_id: 'int',
        message: 'text'
      },
      response: {
        chat_id: 'int',
        message_id: 'int',
        sender: 'varchar',    // the sender here is the user
        content: 'text',
        created_at: 'timestamp'
      },
      error: {
        status: 'int',
        error: 'varchar'
      }
    },
    {
      title: 'Prototype Payment / Subscription (Fake)',
      method: 'POST',
      url: '/api/payments/fake',
      description: 'Simulate a payment/subscription flow for demo purpose. No real charges. Requires Authorization.',
      request: {
        user_id: 'int',
        plan: 'varchar',        // e.g. "basic", "pro"
        payment_method: 'varchar'
      },
      response: {
        status: 'string',
        transaction_id: 'varchar',
        plan: 'varchar',
        starts_at: 'timestamp',
        ends_at: 'timestamp'
      },
      error: {
        status: 'int',
        error: 'varchar'
      }
    }
  ];

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'POST':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'PUT':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'DELETE':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Code className="w-8 h-8 text-green-600" />
            <h1 className="text-gray-900">VisionQC API Documentation</h1>
          </div>
          <p className="text-gray-600">
            Complete API reference for VisionQC Plant Disease Detection Platform
          </p>
        </div>

        <div className="space-y-6">
          {endpoints.map((endpoint, index) => (
            <div key={index} className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-gray-900 mb-2">{endpoint.title}</h3>
                    <p className="text-gray-600 mb-3">{endpoint.description}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-lg border ${getMethodColor(endpoint.method)}`}>
                    {endpoint.method}
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-3">
                  <code className="flex-1 text-gray-800">{endpoint.url}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(endpoint.url, index)}
                  >
                    {copiedIndex === index ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {endpoint.request && (
                  <div>
                    <h4 className="text-gray-900 mb-2">Request Body</h4>
                    <pre className="bg-gray-50 rounded-lg p-4 overflow-x-auto text-gray-800">
                      <code>{JSON.stringify(endpoint.request, null, 2)}</code>
                    </pre>
                  </div>
                )}

                <div>
                  <h4 className="text-gray-900 mb-2">Response (Success)</h4>
                  <pre className="bg-green-50 rounded-lg p-4 overflow-x-auto text-gray-800">
                    <code>{JSON.stringify(endpoint.response, null, 2)}</code>
                  </pre>
                </div>

                <div>
                  <h4 className="text-gray-900 mb-2">Error Response</h4>
                  <pre className="bg-red-50 rounded-lg p-4 overflow-x-auto text-gray-800">
                    <code>{JSON.stringify(endpoint.error, null, 2)}</code>
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-2xl">
          <h3 className="text-gray-900 mb-3">Authentication</h3>
          <p className="text-gray-700 mb-2">
            Most endpoints require authentication. Include the JWT token in the Authorization header:
          </p>
          <pre className="bg-white rounded-lg p-4 overflow-x-auto">
            <code className="text-gray-800">Authorization: Bearer {'<token>'}</code>
          </pre>
        </div>

        <div className="mt-6 p-6 bg-amber-50 border border-amber-200 rounded-2xl">
          <h3 className="text-gray-900 mb-3">Demo Credentials</h3>
          <div className="space-y-2 text-gray-700">
            <p><strong>Admin:</strong> admin@visionqc.com / admin123</p>
            <p><strong>User:</strong> user@visionqc.com / password123</p>
          </div>
        </div>

        <div className="mt-8">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate && navigate('home')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}