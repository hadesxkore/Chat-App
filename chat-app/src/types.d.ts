/// <reference types="react" />
/// <reference types="react-dom" />

// Import React types directly in the declaration file
import * as React from 'react';

// This enables TypeScript to understand JSX elements
declare global {
  namespace JSX {
    interface Element extends React.ReactElement<any, any> {}
    interface ElementClass extends React.Component<any> {
      render(): React.ReactNode;
    }
    interface ElementAttributesProperty {
      props: {};
    }
    interface ElementChildrenAttribute {
      children: {};
    }
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

// Add Lucide icon types
declare module 'lucide-react' {
  import * as React from 'react';
  
  export interface LucideProps extends React.SVGProps<SVGSVGElement> {
    size?: number | string;
    className?: string;
    color?: string;
    strokeWidth?: number | string;
  }
  
  export type LucideIcon = React.FC<LucideProps>;
  
  // Define all icons as React components
  export const Loader2: React.FC<LucideProps>;
  export const LogOut: React.FC<LucideProps>;
  export const Send: React.FC<LucideProps>;
  export const User: React.FC<LucideProps>;
  export const Search: React.FC<LucideProps>;
  export const Settings: React.FC<LucideProps>;
  export const Menu: React.FC<LucideProps>;
  export const X: React.FC<LucideProps>;
  export const ChevronLeft: React.FC<LucideProps>;
  export const ChevronRight: React.FC<LucideProps>;
  export const Plus: React.FC<LucideProps>;
  export const Trash2: React.FC<LucideProps>;
  export const Edit2: React.FC<LucideProps>;
  export const Check: React.FC<LucideProps>;
  export const AlertCircle: React.FC<LucideProps>;
  export const Info: React.FC<LucideProps>;
  export const Sun: React.FC<LucideProps>;
  export const Moon: React.FC<LucideProps>;
  export const RefreshCw: React.FC<LucideProps>;
  export const UserPlus: React.FC<LucideProps>;
}

// Add Firebase Auth User type extension
import { User as FirebaseUser } from 'firebase/auth';
declare module 'firebase/auth' {
  interface User extends FirebaseUser {
    updateProfile(profile: { displayName?: string; photoURL?: string }): Promise<void>;
  }
}

// Add shadcn/ui component types
declare module '@/components/ui/label' {
  export interface LabelProps {
    htmlFor?: string;
    children?: React.ReactNode;
    className?: string;
  }
  
  export const Label: React.FC<LabelProps>;
}

declare module '@/components/ui/switch' {
  export interface SwitchProps {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    className?: string;
  }
  
  export const Switch: React.FC<SwitchProps>;
}

interface ImportMeta {
  env: {
    [key: string]: string;
  };
} 