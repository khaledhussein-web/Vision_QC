import { useState } from 'react';
import { ArrowLeft, Search, Filter, Calendar, Award } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Screen } from '../../App';
import { ImageWithFallback } from '../figma/ImageWithFallback';

interface ImageManagementProps {
  navigate: (screen: Screen) => void;
  onSelectImage: (id: number) => void;
}

interface ImageData {
  id: number;
  image: string;
  disease: string;
  confidence: number;
  date: string;
  user: string;
  verified: boolean;
}

export default function ImageManagement({ navigate, onSelectImage }: ImageManagementProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [diseaseFilter, setDiseaseFilter] = useState('all');
  const [confidenceFilter, setConfidenceFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  const [images] = useState<ImageData[]>([
    {
      id: 1,
      image: 'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=400',
      disease: 'Early Blight',
      confidence: 94.3,
      date: '2025-11-12',
      user: 'john@example.com',
      verified: true,
    },
    {
      id: 2,
      image: 'https://images.unsplash.com/photo-1592150621744-aca4f9dbd4c3?w=400',
      disease: 'Powdery Mildew',
      confidence: 89.7,
      date: '2025-11-11',
      user: 'jane@example.com',
      verified: false,
    },
    {
      id: 3,
      image: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=400',
      disease: 'Leaf Spot',
      confidence: 92.1,
      date: '2025-11-10',
      user: 'bob@example.com',
      verified: true,
    },
    {
      id: 4,
      image: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=400',
      disease: 'Bacterial Blight',
      confidence: 87.5,
      date: '2025-11-09',
      user: 'alice@example.com',
      verified: false,
    },
    {
      id: 5,
      image: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=400',
      disease: 'Rust Disease',
      confidence: 96.2,
      date: '2025-11-08',
      user: 'john@example.com',
      verified: true,
    },
  ]);

  const filteredImages = images.filter(img => {
    const matchesSearch = img.disease.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          img.user.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDisease = diseaseFilter === 'all' || img.disease === diseaseFilter;
    const matchesConfidence = confidenceFilter === 'all' || 
                              (confidenceFilter === 'high' && img.confidence >= 90) ||
                              (confidenceFilter === 'medium' && img.confidence >= 80 && img.confidence < 90) ||
                              (confidenceFilter === 'low' && img.confidence < 80);
    const matchesDate = dateFilter === 'all' || 
                        (dateFilter === 'today' && img.date === '2025-11-12') ||
                        (dateFilter === 'week' && new Date(img.date) >= new Date('2025-11-06'));
    
    return matchesSearch && matchesDisease && matchesConfidence && matchesDate;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex flex-col pb-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('admin-dashboard')} className="text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h2 className="text-gray-900">Images Management</h2>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by disease or user..."
            className="pl-10"
          />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-3 gap-2">
          <Select value={diseaseFilter} onValueChange={setDiseaseFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Disease" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Diseases</SelectItem>
              <SelectItem value="Early Blight">Early Blight</SelectItem>
              <SelectItem value="Powdery Mildew">Powdery Mildew</SelectItem>
              <SelectItem value="Leaf Spot">Leaf Spot</SelectItem>
              <SelectItem value="Bacterial Blight">Bacterial Blight</SelectItem>
              <SelectItem value="Rust Disease">Rust Disease</SelectItem>
            </SelectContent>
          </Select>

          <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Confidence" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="high">High (≥90%)</SelectItem>
              <SelectItem value="medium">Medium (80-89%)</SelectItem>
              <SelectItem value="low">Low (&lt;80%)</SelectItem>
            </SelectContent>
          </Select>

          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results Count */}
      <div className="p-4 pb-0">
        <p className="text-gray-600">
          Found {filteredImages.length} image{filteredImages.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Images List */}
      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        {filteredImages.map((img) => (
          <div
            key={img.id}
            onClick={() => onSelectImage(img.id)}
            className="bg-white rounded-2xl shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
          >
            <div className="flex gap-4 p-4">
              {/* Thumbnail */}
              <div className="w-24 h-24 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 relative">
                <ImageWithFallback
                  src={img.image}
                  alt={img.disease}
                  className="w-full h-full object-cover"
                />
                {img.verified && (
                  <div className="absolute top-1 right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <Award className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-gray-900">#{img.id} - {img.disease}</h3>
                </div>

                <div className="space-y-1 mb-2">
                  <Badge
                    variant="outline"
                    className={`${
                      img.confidence >= 90
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : img.confidence >= 80
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}
                  >
                    {img.confidence}% confidence
                  </Badge>
                </div>

                <div className="text-gray-600">
                  <p>User: {img.user}</p>
                  <p className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {img.date}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}