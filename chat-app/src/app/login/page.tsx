'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FormLabel } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Icons } from '@/components/icons';
import { PhilosophicalQuote } from '@/components/PhilosophicalQuote';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { toast } from 'sonner';
import { ContactWidget } from '@/components/ContactWidget';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, resetPassword } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
        toast.success('Account created successfully! Welcome aboard! 🎉');
      } else {
        await signInWithEmail(email, password);
        toast.success('Welcome back! 👋');
      }
      router.push('/chat');
    } catch (error: any) {
      console.error('Auth Error:', error);
      setError(error.message || 'Authentication failed. Please try again.');
      
      // Show error toast with specific messages
      if (error.code === 'auth/invalid-email') {
        toast.error('Please enter a valid email address');
      } else if (error.code === 'auth/weak-password') {
        toast.error('Password should be at least 6 characters');
      } else if (error.code === 'auth/email-already-in-use') {
        toast.error('This email is already registered. Try logging in instead');
      } else if (error.code === 'auth/user-not-found') {
        toast.error('No account found with this email');
      } else if (error.code === 'auth/wrong-password') {
        toast.error('Incorrect password. Please try again');
      } else {
        toast.error(error.message || 'Something went wrong. Please try again');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError('');

    try {
      await signInWithGoogle();
      toast.success('Successfully signed in with Google! 🎉');
      router.push('/chat');
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      
      // Handle specific Google Sign-In errors
      if (error.code === 'auth/popup-closed-by-user') {
        toast.error('Sign-in was cancelled. Please try again');
      } else if (error.code === 'auth/popup-blocked') {
        toast.error('Pop-up was blocked. Please enable pop-ups for this site');
      } else if (error.code === 'auth/unauthorized-domain') {
        toast.error('This domain is not authorized for Google Sign-In');
      } else {
        toast.error(error.message || 'Failed to sign in with Google');
      }
      
      setError(error.message || 'Failed to sign in with Google. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address');
      toast.error('Please enter your email address');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await resetPassword(email);
      toast.success('Password reset email sent! Check your inbox 📧');
      setError('Password reset email sent. Please check your inbox.');
    } catch (error: any) {
      console.error('Reset Password Error:', error);
      if (error.code === 'auth/user-not-found') {
        toast.error('No account found with this email');
      } else if (error.code === 'auth/invalid-email') {
        toast.error('Please enter a valid email address');
      } else {
        toast.error('Failed to send reset email. Please try again');
      }
      setError(error.message || 'Failed to send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex">
      {/* Left side - Hero section with philosophical quotes */}
      <div className="hidden lg:flex w-1/2 relative">
        <AspectRatio ratio={16 / 9} className="w-full h-full">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-blue-600">
            <div className="absolute inset-0 bg-black/50" />
            <div 
              className="absolute inset-0 bg-[url('/auth-bg-pattern.svg')] opacity-20"
              style={{ backgroundSize: '150px 150px' }}
            />
          </div>
          <div className="absolute inset-0 flex items-center justify-center p-12">
            <div className="max-w-xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                <PhilosophicalQuote />
              </motion.div>
            </div>
          </div>
        </AspectRatio>
      </div>

      {/* Right side - Auth form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background relative">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Card className="border-none shadow-none">
            <CardHeader className="space-y-3">
              <CardTitle className="text-3xl font-bold">
                {isSignUp ? 'Create Account' : 'Welcome Back'}
              </CardTitle>
              <CardDescription className="text-lg">
                {isSignUp
                  ? 'Start your journey with us today'
                  : 'Sign in to continue your journey'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <FormLabel htmlFor="email" className="text-sm font-medium">Email</FormLabel>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e: any) => setEmail(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <FormLabel htmlFor="password" className="text-sm font-medium">Password</FormLabel>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e: any) => setPassword(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 text-base font-medium"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 border-t pt-6">
              <div className="relative w-full">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                type="button"
                disabled={isLoading}
                onClick={handleGoogleSignIn}
                className="w-full h-11 hover:bg-muted/50 transition-colors"
              >
                {isLoading ? (
                  <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Icons.google className="mr-2 h-4 w-4" />
                )}
                Continue with Google
              </Button>
              <div className="flex flex-col space-y-2 text-center text-sm">
                <button
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-primary hover:underline"
                >
                  {isSignUp
                    ? 'Already have an account? Sign in'
                    : "Don't have an account? Sign up"}
                </button>
                {!isSignUp && (
                  <button
                    onClick={handleForgotPassword}
                    className="text-muted-foreground hover:text-primary hover:underline"
                  >
                    Forgot your password?
                  </button>
                )}
              </div>
            </CardFooter>
          </Card>
        </motion.div>

        {/* Developer Information - Left Side */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="absolute  left-4 text-left"
        >
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text p-2 rounded-lg fixed bottom-2 z-50 items-center">
            <h3 className="text-base font-bold text-transparent">Developed by</h3>
            <p className="text-sm font-semibold text-transparent">Kobie Villanueva</p>
        
          </div>
        </motion.div>

        {/* Contact Widget */}
        <ContactWidget />
      </div>
    </div>
  );
} 