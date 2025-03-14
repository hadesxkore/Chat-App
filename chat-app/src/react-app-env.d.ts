/// <reference types="react" />
/// <reference types="react-dom" />

// This file contains type declarations for your React app
// It ensures TypeScript recognizes JSX correctly

interface Window {
  // Extend window if needed
}

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    PUBLIC_URL: string;
  }
} 