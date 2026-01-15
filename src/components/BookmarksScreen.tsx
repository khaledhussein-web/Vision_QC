import { useState, useEffect } from 'react';
import { ArrowLeft, Bookmark, Trash2, Search } from 'lucide-react';
import { Input } from './ui/input';
import { Screen } from '../App';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Badge } from './ui/badge';
import { getHistory, toggleBookmark } from '../utils/api';
import { toast } from 'sonner';

interface BookmarksScreenProps {
  navigate: (screen: Screen) => void;
}

interface BookmarkedItem {
  id: number;
  image: string;
  disease: string;
  confidence: number;
  date: string;
  bookmarked: boolean;
}

export default function BookmarksScreen({ navigate }: BookmarksScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [bookmarkedItems, setBookmarkedItems] = useState<BookmarkedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookmarkedItems();
  }, []);

  const loadBookmarkedItems = async () => {
    try {
      setLoading(true);
      const response = await getHistory(1); // userId = 1
      
      // Filter only bookmarked items from the response
      const bookmarked = response.items
        .filter(p => p.bookmarked)
        .map(p => ({
          id: p.prediction_id,
          image: p.image_url || 'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=400',
          disease: p.label,
          confidence: p.confidence,
          date: new Date(p.created_at).toISOString().split('T')[0],
          bookmarked: true
        }));
      
      setBookmarkedItems(bookmarked);
    } catch (error) {
      console.error('Error loading bookmarks:', error);
      toast.error('Failed to load bookmarks');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBookmark = async (id: number) => {
    try {
      const response = await toggleBookmark(id, 1, 'remove');
      
      if (!response.bookmarked) {
        // Remove from list
        setBookmarkedItems(bookmarkedItems.filter(item => item.id !== id));
        toast.success('Bookmark removed');
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      toast.error('Failed to update bookmark');
    }
  };

  const deleteItem = async (id: number) => {
    try {
      await toggleBookmark(id, 1, 'remove');
      setBookmarkedItems(bookmarkedItems.filter(item => item.id !== id));
      toast.success('Item removed from bookmarks');
    } catch (error) {
      console.error('Error deleting bookmark:', error);
      toast.error('Failed to remove bookmark');
    }
  };

  // Apply search filtering
  const filteredItems = bookmarkedItems.filter(item =>
    item.disease.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.date.includes(searchQuery)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex flex-col pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate('home')} className="text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h2 className="text-gray-900">Bookmarks</h2>
          <div className="w-6" />
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Search bookmarked diseases..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-gray-50 border-gray-200"
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        {/* Stats */}
        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-2xl p-6 mb-6 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <Bookmark className="w-6 h-6 fill-white" />
            <h3>Your Bookmarks</h3>
          </div>
          <div className="text-3xl mb-1">{bookmarkedItems.length}</div>
          <p className="text-green-100">Saved for quick access</p>
        </div>

        {/* Bookmarked Items List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-gray-500">
              <p>Loading bookmarks...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <Bookmark className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-gray-900 mb-2">
                {searchQuery ? 'No matching bookmarks found' : 'No bookmarks yet'}
              </h3>
              <p className="text-gray-500 mb-6">
                {searchQuery ? 'Try a different search term' : 'Start bookmarking your important diagnoses'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => navigate('upload')}
                  className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-3 rounded-xl hover:from-green-700 hover:to-green-800"
                >
                  Scan a Plant
                </button>
              )}
            </div>
          ) : (
            filteredItems.map(item => (
              <div key={item.id} className="bg-white rounded-2xl p-4 shadow-md hover:shadow-lg transition-shadow">
                <div className="flex gap-4">
                  {/* Image */}
                  <div className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                    <ImageWithFallback
                      src={item.image}
                      alt={item.disease}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-gray-900">{item.disease}</h3>
                      <button
                        onClick={() => handleToggleBookmark(item.id)}
                        className="flex-shrink-0"
                      >
                        <Bookmark className="w-5 h-5 fill-green-600 text-green-600" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        {item.confidence}% confidence
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-gray-500">{item.date}</p>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="text-red-500 hover:text-red-700 p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}