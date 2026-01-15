import { useState } from 'react';
import { ArrowLeft, Search, Filter, Bookmark, Trash2, X } from 'lucide-react';
import { Input } from './ui/input';
import { Screen } from '../App';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Slider } from './ui/slider';
import { toast } from 'sonner';

interface HistoryScreenProps {
  navigate: (screen: Screen) => void;
}

interface HistoryItem {
  id: number;
  image: string;
  disease: string;
  confidence: number;
  date: string;
  bookmarked: boolean;
}

type FilterType = 'all' | 'bookmarked' | 'recent';

export default function HistoryScreen({ navigate }: HistoryScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [minConfidence, setMinConfidence] = useState(0);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([
    {
      id: 1,
      image: 'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=400',
      disease: 'Early Blight',
      confidence: 94.3,
      date: '2025-11-12',
      bookmarked: true,
    },
    {
      id: 2,
      image: 'https://images.unsplash.com/photo-1592150621744-aca4f9dbd4c3?w=400',
      disease: 'Powdery Mildew',
      confidence: 89.7,
      date: '2025-11-10',
      bookmarked: false,
    },
    {
      id: 3,
      image: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=400',
      disease: 'Leaf Spot',
      confidence: 92.1,
      date: '2025-11-08',
      bookmarked: true,
    },
    {
      id: 4,
      image: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=400',
      disease: 'Healthy Plant',
      confidence: 97.5,
      date: '2025-11-05',
      bookmarked: false,
    },
  ]);

  const toggleBookmark = (id: number) => {
    const item = historyItems.find(item => item.id === id);
    const wasBookmarked = item?.bookmarked;
    
    setHistoryItems(
      historyItems.map(item =>
        item.id === id ? { ...item, bookmarked: !item.bookmarked } : item
      )
    );
    
    toast.success(wasBookmarked ? 'Bookmark removed' : 'Bookmarked successfully!');
  };

  const deleteItem = (id: number) => {
    setHistoryItems(historyItems.filter(item => item.id !== id));
    toast.success('Item deleted successfully');
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterType('all');
    setMinConfidence(0);
  };

  // Apply filtering logic
  const filteredItems = historyItems.filter(item => {
    // Search filter
    const matchesSearch = item.disease.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.date.includes(searchQuery);
    
    // Type filter
    let matchesType = true;
    if (filterType === 'bookmarked') {
      matchesType = item.bookmarked;
    } else if (filterType === 'recent') {
      const itemDate = new Date(item.date);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      matchesType = itemDate >= sevenDaysAgo;
    }
    
    // Confidence filter
    const matchesConfidence = item.confidence >= minConfidence;
    
    return matchesSearch && matchesType && matchesConfidence;
  });

  const activeFilterCount = 
    (filterType !== 'all' ? 1 : 0) + 
    (minConfidence > 0 ? 1 : 0) +
    (searchQuery ? 1 : 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex flex-col pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('home')} className="text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h2 className="text-gray-900">My History</h2>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search analyses..."
              className="pl-10"
            />
          </div>
          
          <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <SheetTrigger asChild>
              <button className="relative w-10 h-10 bg-white border border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-50">
                <Filter className="w-5 h-5 text-gray-600" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-xs">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Filter Results</SheetTitle>
                <SheetDescription>
                  Refine your search with these filters
                </SheetDescription>
              </SheetHeader>
              
              <div className="py-6 space-y-6">
                {/* Filter Type */}
                <div className="space-y-3">
                  <Label>Show Items</Label>
                  <RadioGroup value={filterType} onValueChange={(value) => setFilterType(value as FilterType)}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="all" id="all" />
                      <Label htmlFor="all" className="cursor-pointer">All items</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="bookmarked" id="bookmarked" />
                      <Label htmlFor="bookmarked" className="cursor-pointer">Bookmarked only</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="recent" id="recent" />
                      <Label htmlFor="recent" className="cursor-pointer">Last 7 days</Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Confidence Filter */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Minimum Confidence</Label>
                    <span className="text-green-600">{minConfidence}%</span>
                  </div>
                  <Slider
                    value={[minConfidence]}
                    onValueChange={(value) => setMinConfidence(value[0])}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>

                {/* Clear Filters */}
                <Button
                  onClick={clearFilters}
                  variant="outline"
                  className="w-full gap-2"
                >
                  <X className="w-4 h-4" />
                  Clear All Filters
                </Button>

                {/* Apply Button */}
                <Button
                  onClick={() => setIsFilterOpen(false)}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  Apply Filters
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Active Filters Display */}
        {activeFilterCount > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {searchQuery && (
              <Badge variant="secondary" className="gap-1">
                Search: {searchQuery}
                <X
                  className="w-3 h-3 cursor-pointer"
                  onClick={() => setSearchQuery('')}
                />
              </Badge>
            )}
            {filterType !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                {filterType === 'bookmarked' ? 'Bookmarked' : 'Recent'}
                <X
                  className="w-3 h-3 cursor-pointer"
                  onClick={() => setFilterType('all')}
                />
              </Badge>
            )}
            {minConfidence > 0 && (
              <Badge variant="secondary" className="gap-1">
                Min: {minConfidence}%
                <X
                  className="w-3 h-3 cursor-pointer"
                  onClick={() => setMinConfidence(0)}
                />
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* History List */}
      <div className="flex-1 p-4 space-y-3">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-gray-900 mb-2">No results found</h3>
            <p className="text-gray-500">
              Try adjusting your filters or search terms
            </p>
            {activeFilterCount > 0 && (
              <Button
                onClick={clearFilters}
                variant="outline"
                className="mt-4"
              >
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          filteredItems.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl shadow-md overflow-hidden">
              <div className="flex gap-4 p-4">
                {/* Thumbnail */}
                <div className="w-24 h-24 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                  <ImageWithFallback
                    src={item.image}
                    alt={item.disease}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-gray-900">{item.disease}</h3>
                    <button
                      onClick={() => toggleBookmark(item.id)}
                      className="flex-shrink-0 ml-2"
                    >
                      <Bookmark
                        className={`w-5 h-5 ${
                          item.bookmarked
                            ? 'fill-green-600 text-green-600'
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <Badge
                      variant="outline"
                      className={`${
                        item.confidence >= 90
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {item.confidence}% confidence
                    </Badge>
                  </div>

                  <p className="text-gray-500 mb-2">{item.date}</p>

                  <button
                    onClick={() => deleteItem(item.id)}
                    className="flex items-center gap-1 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}