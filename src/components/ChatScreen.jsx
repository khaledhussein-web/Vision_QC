import { useRef, useState } from 'react';
import { getCurrentUserId, sendChatMessage } from '../utils/api';

export default function ChatScreen({ navigate }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState([]);
  const [attachedFile, setAttachedFile] = useState(null);
  const [attachedPreview, setAttachedPreview] = useState('');
  const fileInputRef = useRef(null);

  const clearAttachment = () => {
    setAttachedFile(null);
    setAttachedPreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAttachClick = () => {
    if (!isSending) {
      fileInputRef.current?.click();
    }
  };

  const handleAttachmentChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type?.startsWith('image/')) {
      setError('Please select a valid image file.');
      clearAttachment();
      return;
    }
    if (file.size === 0) {
      setError('Selected image is empty. Please choose another file.');
      clearAttachment();
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image is too large. Maximum allowed size is 10 MB.');
      clearAttachment();
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const imageData = String(loadEvent.target?.result || '');
      setAttachedFile(file);
      setAttachedPreview(imageData);
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed && !attachedFile) return;
    setError('');
    setIsSending(true);
    const nextId = Math.max(0, ...messages.map(m => m.id)) + 1;
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const fileToSend = attachedFile;
    const previewToShow = attachedPreview;
    const userText = trimmed || 'Please analyze this uploaded plant photo.';
    const updatedMessages = [
      ...messages,
      { id: nextId, role: 'user', text: userText, time, imagePreview: previewToShow || null },
    ];
    setMessages(updatedMessages);
    setInput('');

    try {
      const history = messages.slice(-6).map(m => ({
        role: m.role,
        content: m.text,
      }));
      const userId = getCurrentUserId();
      const response = await sendChatMessage(userId, trimmed, history, { imageFile: fileToSend });
      const replyText = String(response.reply || 'Sorry, I could not generate a response.');
      const imageAnalysisLabel = String(response?.image_analysis?.label || '').trim();
      const imageAnalysisConfidence = Number(response?.image_analysis?.confidence);
      const hasConfidence = Number.isFinite(imageAnalysisConfidence);
      const imageAnalysisLine = imageAnalysisLabel
        ? `\n\nImage analysis: ${imageAnalysisLabel}${hasConfidence ? ` (${Math.round(imageAnalysisConfidence * 100)}%)` : ''}.`
        : '';
      const imageAnalysisWarning = response?.image_analysis_error?.error
        ? `\n\nImage analysis warning: ${response.image_analysis_error.error}.`
        : '';
      setMessages(prev => [
        ...prev,
        {
          id: nextId + 1,
          role: 'assistant',
          text: `${replyText}${imageAnalysisLine}${imageAnalysisWarning}`,
          time
        },
      ]);
      clearAttachment();
    } catch (err) {
      if (err?.status === 401) {
        setError('Your session expired. Please sign in again.');
        navigate('login');
        return;
      }
      setError(err?.error || err?.message || 'Chat service error. Please try again.');
      setMessages(prev => [
        ...prev,
        {
          id: nextId + 1,
          role: 'assistant',
          text: 'I ran into an error. Please try again in a moment.',
          time,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-6 pt-8 pb-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-green-700 font-semibold">VisionQC Assistant</p>
            <h1 className="text-2xl font-bold text-gray-900">Chat AI</h1>
            <p className="text-sm text-gray-500">Ask questions about plant health, symptoms, and treatments.</p>
          </div>
          <button
            onClick={() => navigate('home')}
            className="text-sm font-semibold text-green-700 border border-green-600 px-3 py-2 rounded-lg hover:bg-green-50"
          >
            Back to Home
          </button>
        </div>
      </div>

      <div className="px-6 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
              <div className="space-y-4 max-h-[52vh] overflow-y-auto pr-1">
                {messages.length === 0 && (
                  <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
                    Start a conversation by asking a question or uploading a plant photo.
                  </div>
                )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-green-600 text-white rounded-br-sm'
                          : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                      }`}
                    >
                      {msg.imagePreview && (
                        <img
                          src={msg.imagePreview}
                          alt="Uploaded plant"
                          className="mb-3 max-h-56 w-full rounded-lg object-cover"
                        />
                      )}
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                      <p
                        className={`mt-2 text-xs ${
                          msg.role === 'user' ? 'text-green-100' : 'text-gray-400'
                        }`}
                      >
                        {msg.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500">Message</label>
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    rows={3}
                    placeholder="Describe symptoms, plant type, or ask a question..."
                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAttachmentChange}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAttachClick}
                    disabled={isSending}
                    className="h-10 px-4 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Attach Photo
                  </button>
                  {attachedFile && (
                    <span className="text-xs text-gray-500">{attachedFile.name}</span>
                  )}
                  {attachedFile && (
                    <button
                      type="button"
                      onClick={clearAttachment}
                      disabled={isSending}
                      className="h-10 px-3 rounded-xl border border-red-300 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {attachedPreview && (
                  <div className="max-w-xs rounded-xl border border-gray-200 p-2">
                    <img
                      src={attachedPreview}
                      alt="Attachment preview"
                      className="max-h-44 w-full rounded-lg object-cover"
                    />
                  </div>
                )}
                <button
                  onClick={handleSend}
                  disabled={isSending || (!input.trim() && !attachedFile)}
                  className="w-full sm:w-auto h-12 px-5 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4" />
        </div>
      </div>
    </div>
  );
}
