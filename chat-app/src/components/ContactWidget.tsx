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
const EMAILJS_SERVICE_ID = 'service_287nkdg';
const EMAILJS_TEMPLATE_ID = 'template_kidurrh';
const EMAILJS_PUBLIC_KEY = 'SCsg9WSjncPID55No';

export function ContactWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [subject, setSubject] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);

    const currentDate = new Date().toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          to_name: 'Kobie Villanueva',
          from_name: senderEmail.split('@')[0], // Get name from email
          from_email: senderEmail,
          subject: subject || 'New Message from Chat App User',
          message: message,
          date_sent: currentDate,
          app_info: 'Chat App - Web Application',
          contact_email: 'kobievillaneva26@gmail.com'
        },
        EMAILJS_PUBLIC_KEY
      );
      
      setMessage('');
      setSenderEmail('');
      setSubject('');
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
      {/* Arrow Toggle Button with Floating Label */}
      <motion.div
        className="fixed bottom-40 right-4 z-50 flex items-center gap-2"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1 }}
      >
        {/* Floating Label */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ 
            opacity: [0.5, 1, 0.5],
            x: 0
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-3 py-1.5 rounded-full text-sm font-medium shadow-lg whitespace-nowrap"
        >
          {isOpen ? 'Close Message' : 'Message Developer'}
        </motion.div>

        <Button
          size="sm"
          className="rounded-full w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg p-0"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? (
            <Icons.chevronDown className="h-4 w-4 text-white" />
          ) : (
            <Icons.chevronUp className="h-4 w-4 text-white" />
          )}
        </Button>
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
              className="fixed bottom-52 right-4 z-50 w-80"
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
                      <Input
                        type="text"
                        placeholder="Subject (optional)"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
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