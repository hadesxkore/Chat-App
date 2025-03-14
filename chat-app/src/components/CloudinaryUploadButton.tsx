import React, { useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { useScript } from '@/hooks/useScript';
import { toast } from 'react-hot-toast';
import { useTheme } from 'next-themes';

// Add typings for Cloudinary
declare global {
  interface Window {
    cloudinary: any;
  }
}

interface CloudinaryUploadButtonProps {
  onSuccess: (result: any) => void;
  onStart?: () => void;
  onFail?: (error: any) => void;
  children: React.ReactNode;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  cloudName?: string;
  uploadPreset?: string;
  resourceType?: 'auto' | 'image' | 'video' | 'raw';
  className?: string;
  disabled?: boolean;
}

export default function CloudinaryUploadButton({
  onSuccess,
  onStart,
  onFail,
  children,
  variant = 'default',
  cloudName = 'demo',
  uploadPreset = 'ml_default',
  resourceType = 'auto',
  className,
  disabled = false
}: CloudinaryUploadButtonProps) {
  const cloudinaryRef = useRef<any>();
  const widgetRef = useRef<any>();
  const { theme } = useTheme();
  const cloudinaryScript = useScript("https://upload-widget.cloudinary.com/global/all.js");

  useEffect(() => {
    if (cloudinaryScript === "ready" && window.cloudinary) {
      cloudinaryRef.current = window.cloudinary;
      widgetRef.current = cloudinaryRef.current.createUploadWidget({
        cloudName,
        uploadPreset,
        maxFiles: 1,
        sources: ['local', 'url', 'camera'],
        resourceType,
        showUploadMoreButton: false,
        styles: {
          palette: {
            window: theme === 'dark' ? "#000000" : "#FFFFFF",
            windowBorder: theme === 'dark' ? "#333333" : "#DDDDDD",
            tabIcon: theme === 'dark' ? "#CCCCCC" : "#666666",
            menuIcons: theme === 'dark' ? "#CCCCCC" : "#666666",
            textDark: theme === 'dark' ? "#DEDEDE" : "#000000",
            textLight: theme === 'dark' ? "#000000" : "#FFFFFF",
            link: "#0078FF",
            action: "#5e5ee6",
            inactiveTabIcon: theme === 'dark' ? "#666666" : "#CCCCCC",
            error: "#FF5733",
            inProgress: "#0078FF",
            complete: "#20B832",
            sourceBg: theme === 'dark' ? "#333333" : "#FAFAFA"
          }
        }
      }, (error: any, result: any) => {
        if (!error && result && result.event === "success") {
          console.log('Upload success:', result.info);
          onSuccess(result.info);
        } else if (error) {
          console.error('Upload error:', error);
          if (onFail) onFail(error);
          else toast.error('Upload failed. Please try again.');
        }
      });
    }
  }, [cloudinaryScript, theme, cloudName, uploadPreset, resourceType, onSuccess, onFail]);

  const handleClick = () => {
    if (!widgetRef.current) {
      toast.error('Upload widget is not available. Please try again later.');
      return;
    }
    
    if (onStart) onStart();
    widgetRef.current.open();
  };

  return (
    <Button
      variant={variant}
      onClick={handleClick}
      className={className}
      disabled={disabled || cloudinaryScript !== "ready"}
    >
      {children}
    </Button>
  );
} 