'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import FormLabel from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTheme } from 'next-themes';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Icons } from '@/components/icons';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdateProfile = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Update user profile in Firebase
      await user?.updateProfile({
        displayName: displayName,
      });
      setError('Profile updated successfully!');
    } catch (error: any) {
      setError(error.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl mx-auto"
      >
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>
              Manage your account settings and preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Profile Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Profile</h3>
              <div className="flex items-center space-x-4">
                <img
                  src={user?.photoURL || '/default-avatar.png'}
                  alt="Profile"
                  className="w-20 h-20 rounded-full"
                />
                <div className="flex-1 space-y-2">
                  <FormLabel htmlFor="displayName">Display Name</FormLabel>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e: any) => setDisplayName(e.target.value)}
                    placeholder="Your display name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <FormLabel htmlFor="email">Email</FormLabel>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ''}
                  disabled
                />
              </div>
            </div>

            {/* Preferences Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Preferences</h3>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <FormLabel>Dark Mode</FormLabel>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Toggle dark mode theme
                  </p>
                </div>
                <Switch
                  checked={theme === 'dark'}
                  onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                />
              </div>
            </div>

            {error && (
              <Alert variant={error.includes('successfully') ? 'default' : 'destructive'}>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={handleLogout}
              disabled={isLoading}
            >
              <Icons.logout className="mr-2 h-4 w-4" />
              Logout
            </Button>
            <Button
              onClick={handleUpdateProfile}
              disabled={isLoading}
            >
              {isLoading ? (
                <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save Changes
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
} 