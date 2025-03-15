import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Icons } from '@/components/icons';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import emailjs from '@emailjs/browser';

// Replace these with your EmailJS credentials
const EMAILJS_SERVICE_ID = 'service_gmail'; // You'll need to create this
const EMAILJS_TEMPLATE_ID = 'template_contact'; // You'll need to create this
const EMAILJS_PUBLIC_KEY = 'YOUR_PUBLIC_KEY'; // You'll get this from EmailJS

export function ContactWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);

    try {
      // Send email using EmailJS
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          from_email: senderEmail,
          to_email: 'kobievillaneva26@gmail.com',
          message: message,
        },
        EMAILJS_PUBLIC_KEY
      );
      
      // Clear form and show success message
      setMessage('');
      setSenderEmail('');
      setIsOpen(false);
      toast.success('Message sent successfully! Thank you for your feedback.');
    } catch (error) {
      console.error('Email Error:', error);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      {/* Floating Button with Arrow */}
      <motion.div
        className="fixed bottom-24 right-4 z-50 flex flex-col items-center gap-2"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1 }}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          <Button
            variant="ghost"
            size="sm"
            className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 p-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <Icons.chevronDown className="h-4 w-4 text-white" />
            ) : (
              <Icons.chevronUp className="h-4 w-4 text-white" />
            )}
          </Button>
        </motion.div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <Button
                size="lg"
                className="rounded-full w-12 h-12 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg"
                onClick={() => setIsOpen(true)}
              >
                <Icons.messageCircle className="h-6 w-6" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Contact Form Dialog */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/40 z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />

            {/* Contact Form */}
            <motion.div
              className="fixed bottom-40 right-4 z-50 w-80"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
            >
              <Card className="border-2 border-purple-500/20">
                <CardHeader className="bg-gradient-to-r from-purple-600/10 to-blue-600/10">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Icons.messageCircle className="h-5 w-5" />
                    Contact Developer
                  </CardTitle>
                </CardHeader>
                <CardContent className="mt-4">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Input
                        type="email"
                        placeholder="Your email"
                        value={senderEmail}
                        onChange={(e) => setSenderEmail(e.target.value)}
                        required
                        className="border-purple-500/20 focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <Textarea
                        placeholder="Your message, suggestion, or report..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="min-h-[100px] border-purple-500/20 focus:border-purple-500"
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                      disabled={isSending}
                    >
                      {isSending ? (
                        <>
                          <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        'Send Message'
                      )}
                    </Button>
                  </form>
                </CardContent>
                <CardFooter className="text-xs text-muted-foreground border-t border-purple-500/10 bg-gradient-to-r from-purple-600/5 to-blue-600/5">
                  Messages will be sent to: kobievillaneva26@gmail.com
                </CardFooter>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
} 