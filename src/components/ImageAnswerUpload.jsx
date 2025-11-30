import { useState, useRef } from 'react';
import { Upload, X, Camera, Loader2, AlertCircle, CheckCircle, RotateCcw, Image as ImageIcon } from 'lucide-react';
import { extractAnswerFromImage } from '../utils/apiService';

// Max file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Helper to convert file to base64
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
};

function ImageAnswerUpload({ onImageProcessed, question, correctAnswer, disabled }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [extractedResult, setExtractedResult] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    await processFile(file);
  };

  const processFile = async (file) => {
    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a PNG, JPEG, or WebP image.');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError('Image is too large. Maximum size is 5MB.');
      return;
    }

    setError(null);
    setExtractedResult(null);
    setSelectedImage(file);

    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (disabled) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const clearSelection = () => {
    setSelectedImage(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setError(null);
    setExtractedResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processImage = async () => {
    if (!selectedImage) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Convert to base64
      const base64 = await fileToBase64(selectedImage);
      
      // Call API
      const result = await extractAnswerFromImage(base64, question, correctAnswer);

      if (result.success && result.data) {
        setExtractedResult(result.data);
        // Pass result to parent
        if (onImageProcessed) {
          onImageProcessed(result.data);
        }
      } else {
        setError(result.error || 'Failed to process image. Please try again.');
      }
    } catch (err) {
      console.error('Error processing image:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const retryProcessing = () => {
    setError(null);
    setExtractedResult(null);
    processImage();
  };

  // If disabled (user has typed text), show minimal UI
  if (disabled) {
    return (
      <div className="opacity-50 pointer-events-none">
        <div className="border-2 border-dashed border-gray-700 rounded-lg p-4 text-center">
          <ImageIcon className="w-6 h-6 text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Clear text input to upload image</p>
        </div>
      </div>
    );
  }

  // If result is already processed, show the result summary
  if (extractedResult) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle className="w-4 h-4 text-green-400" />
          <span className="text-green-400">Image processed successfully</span>
        </div>
        
        {/* Preview thumbnail */}
        {previewUrl && (
          <div className="relative inline-block">
            <img 
              src={previewUrl} 
              alt="Uploaded work" 
              className="max-h-24 rounded-lg border border-gray-700"
            />
          </div>
        )}

        {/* Clear button */}
        <button
          onClick={clearSelection}
          className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1"
        >
          <RotateCcw className="w-3 h-3" />
          Upload different image
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Upload area */}
      {!selectedImage ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer ${
            isDragOver 
              ? 'border-neural-purple bg-neural-purple/10' 
              : 'border-gray-700 hover:border-gray-600'
          }`}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center">
              <Upload className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <p className="text-sm text-gray-300">
                Upload image of your work
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Click to browse or drag & drop
              </p>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Camera className="w-4 h-4 text-gray-500" />
              <span className="text-xs text-gray-500">Camera supported on mobile</span>
            </div>
          </div>
        </div>
      ) : (
        /* Image preview and process button */
        <div className="space-y-3">
          {/* Preview */}
          <div className="relative inline-block">
            <img 
              src={previewUrl} 
              alt="Selected work" 
              className="max-h-48 rounded-lg border border-gray-700"
            />
            <button
              onClick={clearSelection}
              disabled={isProcessing}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* File info */}
          <div className="text-xs text-gray-500">
            {selectedImage.name} ({(selectedImage.size / 1024).toFixed(1)} KB)
          </div>

          {/* Process button */}
          <button
            onClick={processImage}
            disabled={isProcessing}
            className="w-full py-2.5 bg-neural-purple text-white rounded-lg font-medium hover:bg-neural-purple/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Extracting answer from image...
              </>
            ) : (
              <>
                <ImageIcon className="w-4 h-4" />
                Process Answer
              </>
            )}
          </button>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={retryProcessing}
                className="text-xs text-red-300 hover:text-red-200 mt-2 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ImageAnswerUpload;
