import React, { useState } from 'react';
import { Button } from './ui/button';
import { toast } from 'react-hot-toast';
import { Paperclip, Image } from 'lucide-react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface CloudinaryUploadResult {
  resource_type: string;
  secure_url: string;
  original_filename: string;
  bytes: number;
  format: string;
}

interface FileUploaderProps {
  onUploadSuccess: (result: CloudinaryUploadResult) => void;
  onUploadStart?: () => void;
  onUploadError?: (error: Error) => void;
  cloudName?: string;
  uploadPreset?: string;
  acceptedFileTypes?: string;
  buttonLabel?: string;
  icon?: 'file' | 'image';
  disabled?: boolean;
}

export default function FileUploader({
  onUploadSuccess,
  onUploadStart,
  onUploadError,
  cloudName = 'demo',
  uploadPreset = 'ml_default',
  acceptedFileTypes = '*',
  buttonLabel = 'Upload File',
  icon = 'file',
  disabled = false
}: FileUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) {
      return;
    }
    
    if (onUploadStart) {
      onUploadStart();
    }
    
    setIsUploading(true);
    
    try {
      const file = e.target.files[0];
      
      // Create a FormData object to send the file
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'Storage');
      formData.append('cloud_name', 'dt7yizyhv');
      
      // Upload to Cloudinary
      const response = await fetch('https://api.cloudinary.com/v1_1/dt7yizyhv/auto/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const result = await response.json();
      console.log('Upload success:', result);
      
      onUploadSuccess(result);
      
      // Add to Firestore
      await addDoc(collection(db, 'messages'), {
        type: 'image',
        fileURL: result.secure_url,
      });
      
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file. Please try again.');
      
      if (onUploadError && error instanceof Error) {
        onUploadError(error);
      }
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };
  
  const uploadId = `file-upload-${Math.random().toString(36).substr(2, 9)}`;
  
  return (
    <div className="relative">
      <Button
        variant="ghost"
        className="flex items-center space-x-2 w-full"
        disabled={disabled || isUploading}
        onClick={() => {
          const input = document.getElementById(uploadId);
          if (input) input.click();
        }}
      >
        {icon === 'file' ? <Paperclip size={16} /> : <Image size={16} />}
        <span>{isUploading ? 'Uploading...' : buttonLabel}</span>
      </Button>
      <input
        id={uploadId}
        type="file"
        accept={acceptedFileTypes}
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || isUploading}
      />
    </div>
  );
} 