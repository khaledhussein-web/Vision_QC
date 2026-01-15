import { useState } from 'react';
import { ArrowLeft, Download, FileText, Database } from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Screen } from '../../App';

interface ReportsScreenProps {
  navigate: (screen: Screen) => void;
}

export default function ReportsScreen({ navigate }: ReportsScreenProps) {
  const [reportType, setReportType] = useState('disease');
  const [format, setFormat] = useState('csv');
  const [dateRange, setDateRange] = useState('all');
  const [showSuccess, setShowSuccess] = useState(false);

  const handleGenerateReport = () => {
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
    
    // Simulate download
    const data = generateMockData();
    const blob = format === 'csv' 
      ? new Blob([data.csv], { type: 'text/csv' })
      : new Blob([data.json], { type: 'application/json' });
    
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visionqc_report_${Date.now()}.${format}`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const generateMockData = () => {
    const csvData = `ID,Disease,Confidence,User,Date
1,Early Blight,94.3,john@example.com,2025-11-12
2,Powdery Mildew,89.7,jane@example.com,2025-11-11
3,Leaf Spot,92.1,bob@example.com,2025-11-10`;

    const jsonData = JSON.stringify([
      { id: 1, disease: 'Early Blight', confidence: 94.3, user: 'john@example.com', date: '2025-11-12' },
      { id: 2, disease: 'Powdery Mildew', confidence: 89.7, user: 'jane@example.com', date: '2025-11-11' },
      { id: 3, disease: 'Leaf Spot', confidence: 92.1, user: 'bob@example.com', date: '2025-11-10' },
    ], null, 2);

    return { csv: csvData, json: jsonData };
  };

  const reportStats = [
    { label: 'Total Records', value: '1,247' },
    { label: 'Date Range', value: dateRange === 'all' ? 'All Time' : 'This Week' },
    { label: 'Export Format', value: format.toUpperCase() },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex flex-col pb-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('admin-dashboard')} className="text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h2 className="text-gray-900">Generate Reports</h2>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {showSuccess && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-center">
            ✓ Report generated and downloaded successfully!
          </div>
        )}

        {/* Report Configuration */}
        <div className="bg-white rounded-2xl p-5 shadow-md">
          <h3 className="text-gray-900 mb-4">Report Configuration</h3>

          <div className="space-y-4">
            <div>
              <Label htmlFor="reportType">Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger id="reportType" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disease">By Disease Type</SelectItem>
                  <SelectItem value="user">By User</SelectItem>
                  <SelectItem value="date">By Date</SelectItem>
                  <SelectItem value="confidence">By Confidence Score</SelectItem>
                  <SelectItem value="all">All Data</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="dateRange">Date Range</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger id="dateRange" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="format">Export Format</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger id="format" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV (Comma Separated)</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Statistics Preview */}
        <div className="bg-white rounded-2xl p-5 shadow-md">
          <h3 className="text-gray-900 mb-4">Report Preview</h3>

          <div className="space-y-3">
            {reportStats.map((stat, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span className="text-gray-600">{stat.label}</span>
                <span className="text-gray-900">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <Button
          onClick={handleGenerateReport}
          className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 py-6 gap-2"
        >
          <Download className="w-5 h-5" />
          Generate & Download Report
        </Button>

        {/* Recent Reports */}
        <div className="bg-white rounded-2xl p-5 shadow-md">
          <h3 className="text-gray-900 mb-4">Recent Reports</h3>

          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-gray-900">Disease Report - CSV</p>
                <p className="text-gray-500">Generated 2 hours ago</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Database className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-gray-900">User Activity - JSON</p>
                <p className="text-gray-500">Generated yesterday</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
