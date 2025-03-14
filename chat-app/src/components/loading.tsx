import { Icons } from '@/components/icons';

export default function Loading() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <Icons.spinner className="h-8 w-8 animate-spin text-gray-500 dark:text-gray-400" />
    </div>
  );
} 