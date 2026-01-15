import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Mic, Bot, User as UserIcon, Square } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Screen } from '../App';
import { toast } from 'sonner';

interface ChatScreenProps {
  navigate: (screen: Screen) => void;
}

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'ai';
  timestamp: string;
  isVoice?: boolean;
  voiceDuration?: number;
}

export default function ChatScreen({ navigate }: ChatScreenProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: 'Hello! I\'m your AI plant disease assistant. How can I help you today?',
      sender: 'ai',
      timestamp: '10:30 AM',
    },
    {
      id: 2,
      text: 'I have a tomato plant with brown spots on the leaves. What could it be?',
      sender: 'user',
      timestamp: '10:32 AM',
    },
    {
      id: 3,
      text: 'Based on your description, it could be Early Blight or Septoria Leaf Spot. Brown spots are common symptoms. Could you upload an image for more accurate diagnosis?',
      sender: 'ai',
      timestamp: '10:32 AM',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Cleanup interval on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = () => {
    setIsRecording(true);
    setRecordingDuration(0);
    
    // Start timer
    intervalRef.current = setInterval(() => {
      setRecordingDuration(prev => prev + 1);
    }, 1000);
    
    toast.success('Recording started');
  };

  const stopRecording = () => {
    setIsRecording(false);
    
    // Stop timer
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Send voice message
    if (recordingDuration > 0) {
      const newMessage: Message = {
        id: messages.length + 1,
        text: 'Voice message',
        sender: 'user',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isVoice: true,
        voiceDuration: recordingDuration,
      };
      setMessages([...messages, newMessage]);
      
      toast.success(`Voice message sent (${recordingDuration}s)`);

      // Simulate AI response
      setTimeout(() => {
        const aiResponse: Message = {
          id: messages.length + 2,
          text: 'I received your voice message. Let me help you with that. Could you provide more details about the plant\'s condition?',
          sender: 'ai',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, aiResponse]);
      }, 1000);
    }
    
    setRecordingDuration(0);
  };

  const handleSend = () => {
    if (inputText.trim()) {
      const newMessage: Message = {
        id: messages.length + 1,
        text: inputText,
        sender: 'user',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages([...messages, newMessage]);
      setInputText('');

      // Simulate AI response
      setTimeout(() => {
        const aiResponse: Message = {
          id: messages.length + 2,
          text: 'Let me help you with that. Could you provide more details about the plant\'s condition?',
          sender: 'ai',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, aiResponse]);
      }, 1000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 flex items-center gap-3">
        <button onClick={() => navigate('home')} className="text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-gray-900">AI Assistant</h2>
            <p className="text-gray-500">Online</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto pb-24">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-2 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.sender === 'ai' && (
              <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
            )}
            <div
              className={`max-w-[75%] rounded-2xl p-4 ${
                message.sender === 'user'
                  ? 'bg-gradient-to-br from-green-600 to-green-700 text-white'
                  : 'bg-white text-gray-900 shadow-md'
              }`}
            >
              {message.isVoice ? (
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    message.sender === 'user' ? 'bg-white/20' : 'bg-green-100'
                  }`}>
                    <Mic className={`w-4 h-4 ${
                      message.sender === 'user' ? 'text-white' : 'text-green-600'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm">Voice message</p>
                    <p className={`tabular-nums ${
                      message.sender === 'user' ? 'text-white/90' : 'text-gray-600'
                    }`}>
                      {formatTime(message.voiceDuration || 0)}
                    </p>
                  </div>
                </div>
              ) : (
                <p>{message.text}</p>
              )}
              <p
                className={`mt-1 ${
                  message.sender === 'user' ? 'text-white/70' : 'text-gray-500'
                }`}
              >
                {message.timestamp}
              </p>
            </div>
            {message.sender === 'user' && (
              <div className="w-8 h-8 bg-gradient-to-br from-gray-500 to-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                <UserIcon className="w-5 h-5 text-white" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <div className="max-w-md mx-auto">
          {/* Recording Interface */}
          {isRecording && (
            <div className="bg-red-50 rounded-2xl p-4 mb-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                  <span className="text-red-600">Recording voice message...</span>
                </div>
                <span className="text-red-600 tabular-nums">
                  {formatTime(recordingDuration)}
                </span>
              </div>
              <Button
                onClick={stopRecording}
                className="w-full bg-red-600 hover:bg-red-700 gap-2"
              >
                <Square className="w-4 h-4" />
                Stop & Send
              </Button>
            </div>
          )}

          {/* Normal Input */}
          {!isRecording && (
            <div className="flex items-center gap-3">
              <button
                onClick={startRecording}
                className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 hover:shadow-lg transition-shadow"
              >
                <Mic className="w-5 h-5 text-white" />
              </button>
              <Input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type your message..."
                className="flex-1"
              />
              <Button
                onClick={handleSend}
                className="w-10 h-10 bg-gradient-to-br from-green-600 to-green-700 rounded-full p-0 flex items-center justify-center"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}