import { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  doc, 
  getDoc,
  updateDoc,
  deleteDoc,
  getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Send, 
  Info, 
  Smile, 
  Paperclip, 
  Image, 
  File, 
  Mic, 
  Play, 
  Pause, 
  X, 
  UserPlus, 
  User, 
  UserMinus, 
  Crown, 
  Camera,
  Video,
  Phone
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetDescription,
  SheetClose
} from '@/components/ui/sheet';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs';
import { AnimatePresence, motion } from 'framer-motion';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { useTheme } from 'next-themes';
import { useScript } from '@/hooks/useScript';
import GroupVideoCallButton from './GroupVideoCallButton';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import GroupVideoCall from './GroupVideoCall';

// Define necessary interfaces
interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL: string;
  uid?: string;
}

interface GroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  senderName?: string;
  content: string;
  timestamp: any;
  type?: 'text' | 'image' | 'file' | 'voice' | 'system';
  fileURL?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  duration?: number; // For voice messages
}

interface GroupInfo {
  id: string;
  name: string;
  createdBy: string;
  createdAt: any;
  members: string[];
  photoURL?: string;
  lastMessage?: string;
  lastMessageTime?: any;
}

interface GroupMessagesProps {
  groupId: string;
  currentUser: User;
  groupName: string;
}

interface GroupMember extends User {
  isCreator?: boolean;
}

interface FileAttachment {
  type: 'image' | 'file' | 'voice';
  url: string;
  name: string;
  size?: number;
  contentType?: string;
  timestamp: any;
  sender: string;
}

// Voice Recorder Component
const VoiceRecorder = ({ onRecordingComplete }: { onRecordingComplete: (blob: Blob) => void }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          console.log('Audio data chunk captured:', e.data.size, 'bytes');
        }
      };

      mediaRecorder.onstop = () => {
        console.log('MediaRecorder stopped, processing audio...');
        if (chunksRef.current.length === 0) {
          console.error('No audio data captured');
          toast.error('No audio recorded. Please try again.');
          return;
        }
        
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        console.log('Audio blob created:', blob.size, 'bytes');
        
        // Make sure we actually have data
        if (blob.size > 0) {
          onRecordingComplete(blob);
        } else {
          toast.error('Recording was too short. Please try again.');
        }
        
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        setRecordingTime(0);
      };

      // Start recording with 100ms time slices to ensure we capture data
      mediaRecorder.start(100);
      console.log('MediaRecorder started');
      setIsRecording(true);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.error('Failed to access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      console.log('Stopping recording...');
      // Make sure we get the final chunk of data
      mediaRecorderRef.current.requestData();
      mediaRecorderRef.current.stop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative">
      <Button
        type="button"
        variant={isRecording ? "destructive" : "ghost"}
        size="icon"
        className={`rounded-full h-9 w-9 ${isRecording ? 'animate-pulse' : ''}`}
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onMouseLeave={stopRecording}
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
      >
        <Mic size={18} />
      </Button>
      {isRecording && (
        <div className="absolute bottom-full left-0 mb-2 bg-red-500 text-white px-3 py-1 rounded-full text-xs flex items-center space-x-1 shadow-md">
          <span className="animate-pulse">●</span>
          <span>{formatTime(recordingTime)}</span>
        </div>
      )}
    </div>
  );
};

// Audio Player Component
const AudioPlayer = ({ audioUrl }: { audioUrl: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center space-x-2 bg-accent/30 rounded-lg p-2 w-full max-w-[200px]">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      <Button 
        type="button" 
        variant="ghost" 
        size="icon" 
        className="h-8 w-8 rounded-full" 
        onClick={togglePlayPause}
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
      </Button>
      <div className="flex-1">
        <div className="text-xs text-muted-foreground flex justify-between">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        <div className="h-1 mt-1 bg-primary/30 rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary" 
            style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};

const GroupMessages = ({ groupId, currentUser, groupName }: GroupMessagesProps) => {
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // New state variables for added features
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileAttachments, setFileAttachments] = useState<FileAttachment[]>([]);
  const [hoveredImageId, setHoveredImageId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Cloudinary setup
  const { theme } = useTheme();
  const cloudinaryRef = useRef<any>();
  const widgetRef = useRef<any>();
  const cloudinaryScript = useScript("https://upload-widget.cloudinary.com/global/all.js");
  
  // Add these state variables inside the GroupMessages component
  const [activeCall, setActiveCall] = useState<{
    id: string;
    creatorName: string;
    participants: string[];
  } | null>(null);
  const [showCallDialog, setShowCallDialog] = useState(false);
  
  // Load group info and set up message listeners
  useEffect(() => {
    if (!groupId) return;
    
    const loadGroupInfo = async () => {
      try {
        const groupDoc = await getDoc(doc(db, 'groups', groupId));
        if (groupDoc.exists()) {
          const groupData = groupDoc.data();
          setGroupInfo({
            id: groupDoc.id,
            ...groupData
          } as GroupInfo);
          
          // Load group members
          const memberIds = groupData.members || [];
          const memberPromises = memberIds.map((id: string) => getDoc(doc(db, 'users', id)));
          const memberDocs = await Promise.all(memberPromises);
          
          const members: GroupMember[] = memberDocs
            .filter(doc => doc.exists())
            .map(doc => {
              const userData = doc.data();
              return {
                id: doc.id,
                ...userData,
                isCreator: doc.id === groupData.createdBy
              } as GroupMember;
            });
            
          setGroupMembers(members);
          
          // Load files and images
          loadFileAttachments();
        }
      } catch (error) {
        console.error('Error loading group info:', error);
        toast.error('Failed to load group information');
      }
    };
    
    // Load all file attachments sent in this group
    const loadFileAttachments = async () => {
      try {
        const messagesRef = collection(db, 'groupMessages');
        const q = query(
          messagesRef,
          where('groupId', '==', groupId),
          where('type', 'in', ['image', 'file', 'voice'])
        );
        
        const querySnapshot = await getDocs(q);
        const attachments: FileAttachment[] = [];
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.fileURL) {
            attachments.push({
              type: data.type as 'image' | 'file' | 'voice',
              url: data.fileURL,
              name: data.fileName || 'Unnamed file',
              size: data.fileSize,
              contentType: data.fileType,
              timestamp: data.timestamp,
              sender: data.senderId
            });
          }
        });
        
        // Sort by timestamp (newest first)
        attachments.sort((a, b) => {
          const timeA = a.timestamp?.toDate?.() || new Date();
          const timeB = b.timestamp?.toDate?.() || new Date();
          return timeB.getTime() - timeA.getTime();
        });
        
        setFileAttachments(attachments);
      } catch (error) {
        console.error('Error loading file attachments:', error);
      }
    };
    
    // Load messages from this group
    const messagesRef = collection(db, 'groupMessages');
    const q = query(
      messagesRef,
      where('groupId', '==', groupId),
      orderBy('timestamp', 'asc')
    );
    
    const unsubscribe = onSnapshot(q, 
      (querySnapshot) => {
        console.log(`Got ${querySnapshot.size} messages for group ${groupId}`);
        const messagesData: GroupMessage[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          console.log('Message data:', { id: doc.id, ...data });
          messagesData.push({ id: doc.id, ...data } as GroupMessage);
        });
        
        setMessages(messagesData);
        setIsLoading(false);
        
        // Scroll to bottom on new messages
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      },
      (error) => {
        console.error('Error listening to messages:', error);
        
        // If we get an index error, try a simpler query without orderBy
        if (error.code === 'failed-precondition' || error.message.includes('index')) {
          console.log('Falling back to simple query without ordering');
          
          // Create a simpler query without orderBy
          const simpleQuery = query(
            messagesRef,
            where('groupId', '==', groupId)
          );
          
          // Set up a new listener with the simpler query
          const simpleUnsubscribe = onSnapshot(simpleQuery, (simpleSnapshot) => {
            console.log(`Got ${simpleSnapshot.size} messages with simple query`);
            const simpleData: GroupMessage[] = [];
            simpleSnapshot.forEach((doc) => {
              simpleData.push({ id: doc.id, ...doc.data() } as GroupMessage);
            });
            
            // Sort messages manually by timestamp
            simpleData.sort((a, b) => {
              if (!a.timestamp) return -1;
              if (!b.timestamp) return 1;
              
              const timeA = a.timestamp.toDate ? a.timestamp.toDate().getTime() : 0;
              const timeB = b.timestamp.toDate ? b.timestamp.toDate().getTime() : 0;
              return timeA - timeB;
            });
            
            setMessages(simpleData);
            setIsLoading(false);
          });
          
          // Return cleanup function
          return simpleUnsubscribe;
        } else {
          toast.error('Failed to load messages');
          setIsLoading(false);
        }
      }
    );
    
    loadGroupInfo();
    
    return () => unsubscribe();
  }, [groupId]);
  
  // Auto scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !currentUser || !groupId) {
      console.error('Cannot send message - missing data:', { 
        messageEmpty: !newMessage.trim(), 
        noCurrentUser: !currentUser, 
        currentUserId: currentUser?.id || currentUser?.uid, 
        noGroupId: !groupId 
      });
      return;
    }
    
    console.log('Sending message to group:', {
      groupId,
      currentUser,
      messageContent: newMessage.trim()
    });
    
    try {
      // Get the correct user ID
      const userId = currentUser.id || currentUser.uid;
      
      // Add message to group messages collection
      const messageData = {
        groupId,
        senderId: userId, // Use uid as fallback if id is undefined
        senderName: currentUser.displayName || 'User',
        content: newMessage.trim(),
        timestamp: serverTimestamp(),
        type: 'text'
      };
      
      console.log('Message data to send:', messageData);
      
      const docRef = await addDoc(collection(db, 'groupMessages'), messageData);
      console.log('Message sent successfully with ID:', docRef.id);
      
      // Update group document with last message and sender ID
      await updateDoc(doc(db, 'groups', groupId), {
        lastMessage: newMessage.trim().substring(0, 30) + (newMessage.length > 30 ? '...' : ''),
        lastMessageTime: serverTimestamp(),
        lastMessageSender: userId // Add sender ID to track who sent the message
      });

      // Update read status since the user has obviously seen all messages
      // if they're sending a new one
      await updateReadStatus();
      
      // Clear the message input
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };
  
  // Add a function to update read status
  const updateReadStatus = async () => {
    if (!currentUser || !groupId) return;
    
    try {
      const userId = currentUser.id || currentUser.uid;
      
      // Check if a read status document already exists
      const readStatusRef = collection(db, 'groupReadStatus');
      const q = query(
        readStatusRef, 
        where('groupId', '==', groupId),
        where('userId', '==', userId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        // Create new read status
        await addDoc(readStatusRef, {
          groupId,
          userId,
          lastReadTimestamp: serverTimestamp()
        });
        console.log(`Created read status for group ${groupId} at ${new Date().toISOString()}`);
      } else {
        // Update existing read status
        const docId = querySnapshot.docs[0].id;
        await updateDoc(doc(readStatusRef, docId), {
          lastReadTimestamp: serverTimestamp()
        });
        console.log(`Updated read status for group ${groupId} at ${new Date().toISOString()}`);
      }
    } catch (error) {
      console.error('Error updating read status:', error);
    }
  };
  
  // Also update read status when component mounts
  useEffect(() => {
    if (groupId && currentUser) {
      updateReadStatus();
    }
  }, [groupId, currentUser]);
  
  const getMemberName = (userId: string): string => {
    if (!userId) return 'Unknown User';
    const member = groupMembers.find(m => m.id === userId);
    return member?.displayName || 'Unknown User';
  };
  
  const formatMessageDate = (timestamp: any): string => {
    if (!timestamp) return '';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return format(date, 'h:mm a');
    } catch (e) {
      console.error('Error formatting date:', e);
      return '';
    }
  };
  
  // File upload handling
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    // Instead of processing the file directly, open the Cloudinary widget
    if (widgetRef.current) {
      setIsUploading(true);
      widgetRef.current.open();
    } else {
      toast.error('Upload widget is not available');
    }
  };
  
  // Separate function to open Cloudinary widget from the paperclip button
  const openCloudinaryWidget = () => {
    if (widgetRef.current) {
      setIsUploading(true);
      widgetRef.current.open();
    } else {
      toast.error('Upload widget is not available');
    }
  };
  
  // Voice message handling
  const handleVoiceMessage = async (audioBlob: Blob) => {
    if (!currentUser || !groupId) {
      toast.error('User or group information missing');
      return;
    }
    
    setIsUploading(true);
    
    try {
      // Get the correct user ID
      const userId = currentUser.id || currentUser.uid;
      if (!userId) {
        toast.error('User ID not found');
        setIsUploading(false);
        return;
      }
      
      // Create FormData for Cloudinary upload
      const formData = new FormData();
      formData.append('file', audioBlob);
      formData.append('upload_preset', 'Storage');
      formData.append('cloud_name', 'dt7yizyhv');
      formData.append('resource_type', 'auto');
      
      // Upload to Cloudinary
      const response = await fetch('https://api.cloudinary.com/v1_1/dt7yizyhv/auto/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const result = await response.json();
      console.log('Voice upload success:', result);
      
      // Create message with voice attachment
      await addDoc(collection(db, 'groupMessages'), {
        groupId,
        senderId: userId,
        senderName: currentUser.displayName || 'User',
        timestamp: serverTimestamp(),
        type: 'voice',
        fileURL: result.secure_url,
        fileName: 'voice_message.webm',
        fileType: 'audio/webm',
        fileSize: result.bytes,
        duration: result.duration || 0
      });
      
      // Update group's last message info
      await updateDoc(doc(db, 'groups', groupId), {
        lastMessage: '🎤 Voice message',
        lastMessageTime: serverTimestamp(),
        lastMessageSender: userId
      });
      
      // Update read status since the user is sending a message
      await updateReadStatus();
      
      setIsUploading(false);
    } catch (error) {
      console.error('Error processing voice message:', error);
      toast.error('Failed to send voice message');
      setIsUploading(false);
    }
  };
  
  // Group management functions
  const isGroupCreator = () => {
    if (!currentUser || !groupInfo) return false;
    const userId = currentUser.id || currentUser.uid;
    return userId && groupInfo.createdBy === userId;
  };
  
  const kickMember = async (memberId: string) => {
    if (!currentUser || !groupInfo) return;
    if (!isGroupCreator() || memberId === (currentUser.id || currentUser.uid)) return;
    
    try {
      // Get the correct user ID
      const userId = currentUser.id || currentUser.uid;
      if (!userId) {
        toast.error('User ID not found');
        return;
      }
      
      // Update the group members array
      const updatedMembers = groupMembers
        .filter(member => member.id !== memberId)
        .map(member => member.id);
      
      await updateDoc(doc(db, 'groups', groupId), {
        members: updatedMembers
      });
      
      // Get the removed member's name
      const removedMember = groupMembers.find(m => m.id === memberId);
      const removedMemberName = removedMember?.displayName || 'A member';
      const systemMessage = `${removedMemberName} was removed from the group`;
      
      // Add system message about member being removed
      await addDoc(collection(db, 'groupMessages'), {
        groupId,
        senderId: userId,
        senderName: currentUser.displayName || 'User',
        content: systemMessage,
        timestamp: serverTimestamp(),
        type: 'system'
      });
      
      // Update the group's last message
      await updateDoc(doc(db, 'groups', groupId), {
        lastMessage: systemMessage,
        lastMessageTime: serverTimestamp(),
        lastMessageSender: userId
      });
      
      toast.success('Member removed from group');
    } catch (error) {
      console.error('Error kicking member:', error);
      toast.error('Failed to remove member');
    }
  };
  
  // Update group photo
  const updateGroupPhoto = async (file: File) => {
    if (!currentUser || !groupId) {
      toast.error('User or group information missing');
      return;
    }
    
    setIsUploading(true);
    
    try {
      // Get the correct user ID
      const userId = currentUser.id || currentUser.uid;
      if (!userId) {
        toast.error('User ID not found');
        setIsUploading(false);
        return;
      }
      
      // Create FormData for Cloudinary upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'Storage');
      formData.append('cloud_name', 'dt7yizyhv');
      formData.append('resource_type', 'auto');
      
      // Upload to Cloudinary
      const response = await fetch('https://api.cloudinary.com/v1_1/dt7yizyhv/image/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const result = await response.json();
      console.log('Group photo upload success:', result);
      
      // Create system message
      const systemMessage = `Group photo updated`;
      
      // Update group photo with Cloudinary URL
      await updateDoc(doc(db, 'groups', groupId), {
        photoURL: result.secure_url,
        lastMessage: systemMessage,
        lastMessageTime: serverTimestamp(),
        lastMessageSender: userId
      });
      
      // Add system message
      await addDoc(collection(db, 'groupMessages'), {
        groupId,
        senderId: userId,
        senderName: currentUser.displayName || 'User',
        content: systemMessage,
        timestamp: serverTimestamp(),
        type: 'system'
      });
      
      setIsUploading(false);
      toast.success('Group photo updated');
    } catch (error) {
      console.error('Error updating group photo:', error);
      setIsUploading(false);
      toast.error('Failed to update group photo');
    }
  };
  
  // Configure Cloudinary widget when script is loaded
  useEffect(() => {
    if (cloudinaryScript === "ready" && window.cloudinary) {
      cloudinaryRef.current = window.cloudinary;
      widgetRef.current = cloudinaryRef.current.createUploadWidget({
        cloudName: 'dt7yizyhv', // Your cloud name from page.tsx
        uploadPreset: 'Storage', // Your upload preset from FileUploader.tsx
        maxFiles: 1,
        sources: ['local', 'url', 'camera'],
        resourceType: 'auto', // Allow any file type
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
          console.log('Cloudinary upload success:', result.info);
          handleCloudinaryUploadSuccess(result.info);
        }
      });
    }
  }, [cloudinaryScript, theme]);
  
  // Handle successful Cloudinary upload
  const handleCloudinaryUploadSuccess = (info: any) => {
    if (!currentUser || !groupId) {
      toast.error('User or group information missing');
      return;
    }
    
    const fileType = info.resource_type;
    const fileURL = info.secure_url;
    const fileName = info.original_filename;
    const fileSize = info.bytes;
    
    // Get the correct user ID
    const userId = currentUser.id || currentUser.uid;
    if (!userId) {
      toast.error('User ID not found');
      return;
    }
    
    // Determine message type based on file type
    const messageType = fileType === 'image' ? 'image' : 'file';
    
    // Create message content
    let messageContent = '';
    if (messageType === 'image') {
      messageContent = '📷 Image';
    } else {
      messageContent = `📎 ${fileName || 'File'}`;
    }
    
    setIsUploading(false);
    
    // Add message to group messages collection
    addDoc(collection(db, 'groupMessages'), {
      groupId,
      senderId: userId,
      senderName: currentUser.displayName || 'User',
      content: messageContent,
      timestamp: serverTimestamp(),
      type: messageType,
      fileURL: fileURL,
      fileName: fileName,
      fileSize: fileSize,
      fileType: fileType
    })
    .then(() => {
      // Update group document with last message
      updateDoc(doc(db, 'groups', groupId), {
        lastMessage: `${messageType === 'image' ? 'Image' : 'File'}`,
        lastMessageTime: serverTimestamp(),
        lastMessageSender: userId
      });
      
      // Update read status since the user is sending a message
      updateReadStatus();
      
      toast.success(`${messageType === 'image' ? 'Image' : 'File'} uploaded successfully`);
    })
    .catch(error => {
      console.error('Error saving file message:', error);
      toast.error('Failed to save message');
    });
  };
  
  // Add this effect to detect active calls for this group
  useEffect(() => {
    if (!groupId) return;
    
    // Check if there's an active call for this group
    const activeCallQuery = query(
      collection(db, 'groupCalls'),
      where('groupId', '==', groupId),
      where('status', '==', 'active')
    );
    
    const unsubscribe = onSnapshot(activeCallQuery, (snapshot) => {
      if (!snapshot.empty) {
        // There is an active call
        const callDoc = snapshot.docs[0];
        const callData = callDoc.data();
        
        setActiveCall({
          id: callDoc.id,
          creatorName: callData.creatorName || 'Someone',
          participants: callData.participants || []
        });
      } else {
        // No active call
        setActiveCall(null);
      }
    });
    
    return () => unsubscribe();
  }, [groupId]);
  
  // Add a function to join the call
  const joinGroupCall = () => {
    if (activeCall) {
      setShowCallDialog(true);
    }
  };
  
  // Add a function to handle the end call action
  const handleEndCall = () => {
    setShowCallDialog(false);
  };
  
  return (
    <div className="flex flex-col h-full">
      
      {/* Active Call Banner */}
      {activeCall && !showCallDialog && (
        <div className="bg-accent/30 p-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-primary/20 p-2 rounded-full">
              <Video className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">
                Active group call ({activeCall.participants.length} {activeCall.participants.length === 1 ? 'participant' : 'participants'})
              </p>
              <p className="text-xs text-muted-foreground">
                Started by {activeCall.creatorName}
              </p>
            </div>
          </div>
          <Button 
            size="sm" 
            onClick={joinGroupCall}
            className="bg-primary text-primary-foreground"
          >
            Join Call
          </Button>
        </div>
      )}
      
      <div className="flex flex-col overflow-hidden rounded-md border shadow-sm mb-2 h-screen">
        {/* Group Header with Creator Label and Info Button */}
        <div className="flex items-center p-3 border-b shrink-0 bg-background">
          <div className="relative">
            <Avatar className="h-9 w-9 mr-3">
              <AvatarImage src={groupInfo?.photoURL || '/group-avatar.png'} />
              <AvatarFallback>{groupName[0]?.toUpperCase() || 'G'}</AvatarFallback>
            </Avatar>
            {currentUser && groupInfo && groupMembers.length > 0 && 
              groupMembers.find(m => m.isCreator)?.id && 
              groupMembers.find(m => m.isCreator)?.id === (currentUser.id || currentUser.uid) && (
                <span className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground text-xs px-1 rounded-sm">
                  Owner
                </span>
              )
            }
          </div>
          <div className="flex-1">
            <h2 className="font-semibold">{groupName}</h2>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {groupMembers.length} members
              {groupMembers.find(m => m.isCreator) && (
                <span className="flex items-center">
                  • Created by {groupMembers.find(m => m.isCreator)?.displayName || 'Unknown'}
                  <Crown className="h-3 w-3 text-amber-500 ml-1" />
                </span>
              )}
            </p>
          </div>
          
          {/* Video Call Button */}
          <GroupVideoCallButton
            currentUserId={currentUser?.id || currentUser?.uid || ''}
            groupId={groupId}
            groupName={groupName}
            displayName={currentUser?.displayName || 'User'}
            photoURL={currentUser?.photoURL}
            variant="ghost"
            size="icon"
          />
          
          {/* Info Sheet */}
          <Sheet open={isInfoOpen} onOpenChange={setIsInfoOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Info className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[450px]">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={groupInfo?.photoURL || '/group-avatar.png'} />
                    <AvatarFallback>{groupName[0]?.toUpperCase() || 'G'}</AvatarFallback>
                  </Avatar>
                  {groupName}
                </SheetTitle>
                <SheetDescription>
                  Created on {groupInfo?.createdAt?.toDate ? format(groupInfo.createdAt.toDate(), 'PP') : 'Unknown date'}
                </SheetDescription>
              </SheetHeader>
              
              <Tabs defaultValue="members" className="mt-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="members">Members</TabsTrigger>
                  <TabsTrigger value="media">Media</TabsTrigger>
                  <TabsTrigger value="files">Files</TabsTrigger>
                </TabsList>
                
                {/* Members Tab */}
                <TabsContent value="members" className="mt-4">
                  <ScrollArea className="h-[calc(100vh-300px)]">
                    <div className="space-y-3">
                      {isGroupCreator() && (
                        <div className="p-2 rounded-md bg-primary/10">
                          <input 
                            type="file"
                            id="group-photo"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                updateGroupPhoto(e.target.files[0]);
                              }
                            }}
                          />
                          <label htmlFor="group-photo" className="flex items-center gap-2 text-sm cursor-pointer">
                            <Camera className="h-4 w-4" />
                            Change group photo
                          </label>
                        </div>
                      )}
                      
                      {groupMembers.map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-2 rounded-md hover:bg-accent/50">
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={member.photoURL || '/default-avatar.png'} />
                                <AvatarFallback>{(member.displayName && member.displayName[0]) || (member.email && member.email[0]) || 'U'}</AvatarFallback>
                              </Avatar>
                              {member.isCreator && (
                                <span className="absolute -bottom-1 -right-1">
                                  <Crown className="h-3 w-3 text-amber-500" />
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{member.displayName}</p>
                              <p className="text-xs text-muted-foreground">{member.email}</p>
                            </div>
                          </div>
                          
                          {/* Kick member button (only shown to creator and not for self) */}
                          {isGroupCreator() && member.id !== (currentUser.id || currentUser.uid) && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10"
                              onClick={() => kickMember(member.id)}
                            >
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
                
                {/* Media Tab */}
                <TabsContent value="media" className="mt-4">
                  <ScrollArea className="h-[calc(100vh-300px)]">
                    {fileAttachments.filter(f => f.type === 'image').length === 0 ? (
                      <p className="text-sm text-center text-muted-foreground py-4">No images shared in this group yet</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {fileAttachments
                          .filter(f => f.type === 'image')
                          .map((image, index) => (
                            <div 
                              key={index} 
                              className="aspect-square relative rounded-md overflow-hidden cursor-pointer"
                              onMouseEnter={() => setHoveredImageId(`image-${index}`)}
                              onMouseLeave={() => setHoveredImageId(null)}
                            >
                              <img 
                                src={image.url} 
                                alt={image.name} 
                                className="w-full h-full object-cover"
                              />
                              {hoveredImageId === `image-${index}` && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                  <a 
                                    href={image.url} 
                                    download={image.name}
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-white text-sm flex items-center gap-1 bg-primary/80 px-2 py-1 rounded-md"
                                  >
                                    <Image className="h-4 w-4" />
                                    Download
                                  </a>
                                </div>
                              )}
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
                
                {/* Files Tab */}
                <TabsContent value="files" className="mt-4">
                  <ScrollArea className="h-[calc(100vh-300px)]">
                    {fileAttachments.filter(f => f.type === 'file' || f.type === 'voice').length === 0 ? (
                      <p className="text-sm text-center text-muted-foreground py-4">No files shared in this group yet</p>
                    ) : (
                      <div className="space-y-2">
                        {fileAttachments
                          .filter(f => f.type === 'file' || f.type === 'voice')
                          .map((file, index) => (
                            <div key={index} className="p-3 rounded-md bg-accent/30 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {file.type === 'voice' ? (
                                  <Mic className="h-4 w-4 text-primary" />
                                ) : (
                                  <File className="h-4 w-4 text-primary" />
                                )}
                                <div>
                                  <p className="text-sm font-medium truncate max-w-[200px]">{file.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {file.size ? `${Math.round(file.size / 1024)} KB` : ''} • 
                                    {file.timestamp?.toDate ? format(file.timestamp.toDate(), 'PP') : 'Unknown date'}
                                  </p>
                                </div>
                              </div>
                              <a 
                                href={file.url} 
                                download={file.name}
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:text-primary/80"
                              >
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <File className="h-4 w-4" />
                                </Button>
                              </a>
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>
              
              <SheetFooter className="mt-auto">
                <SheetClose asChild>
                  <Button variant="outline" size="sm">Close</Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
        
        {/* Messages Area */}
        <ScrollArea className="flex-1 p-3 overflow-auto">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <p>Loading messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex justify-center items-center h-full text-muted-foreground">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => {
                // Determine if message is from current user for alignment
                const isCurrentUserMessage = currentUser && 
                  message.senderId === (currentUser.id || currentUser.uid);
                
                return (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.type === 'system' 
                        ? 'justify-center' 
                        : isCurrentUserMessage 
                          ? 'justify-end' 
                          : 'justify-start'
                    }`}
                  >
                    {message.type === 'system' ? (
                      <div className="bg-accent/20 text-muted-foreground rounded-md px-3 py-2 text-sm max-w-[80%] text-center italic">
                        {message.content}
                      </div>
                    ) : message.type === 'image' ? (
                      <div className={`flex ${isCurrentUserMessage ? 'flex-row-reverse' : 'flex-row'} items-start max-w-[80%]`}>
                        {!isCurrentUserMessage && (
                          <Avatar className="h-8 w-8 mr-2">
                            <AvatarImage src={groupMembers.find(m => m.id === message.senderId)?.photoURL || '/default-avatar.png'} />
                            <AvatarFallback>
                              {getMemberName(message.senderId || '')[0]?.toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div>
                          {!isCurrentUserMessage && (
                            <p className="text-xs font-medium mb-1">
                              {getMemberName(message.senderId)}
                            </p>
                          )}
                          <div className={`rounded-lg overflow-hidden max-w-[240px]`}>
                            <a 
                              href={message.fileURL} 
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <img 
                                src={message.fileURL} 
                                alt="Shared image" 
                                className="max-w-full h-auto rounded-lg"
                              />
                            </a>
                            <div className="text-xs opacity-70 text-right mt-1 px-2">
                              {formatMessageDate(message.timestamp)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : message.type === 'file' ? (
                      <div className={`flex ${isCurrentUserMessage ? 'flex-row-reverse' : 'flex-row'} items-start max-w-[80%]`}>
                        {!isCurrentUserMessage && (
                          <Avatar className="h-8 w-8 mr-2">
                            <AvatarImage src={groupMembers.find(m => m.id === message.senderId)?.photoURL || '/default-avatar.png'} />
                            <AvatarFallback>
                              {getMemberName(message.senderId || '')[0]?.toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div>
                          {!isCurrentUserMessage && (
                            <p className="text-xs font-medium mb-1">
                              {getMemberName(message.senderId)}
                            </p>
                          )}
                          <div className={`${
                            isCurrentUserMessage 
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-accent'
                            } rounded-lg px-3 py-2 text-sm break-words`}
                          >
                            <a 
                              href={message.fileURL} 
                              download={message.fileName}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2"
                            >
                              <File className="h-4 w-4" />
                              <span className="underline">{message.fileName}</span>
                              <span className="text-xs">
                                ({message.fileSize ? `${Math.round(message.fileSize / 1024)} KB` : 'Unknown size'})
                              </span>
                            </a>
                            <div className="text-xs opacity-70 text-right mt-1">
                              {formatMessageDate(message.timestamp)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : message.type === 'voice' ? (
                      <div className={`flex ${isCurrentUserMessage ? 'flex-row-reverse' : 'flex-row'} items-start max-w-[80%]`}>
                        {!isCurrentUserMessage && (
                          <Avatar className="h-8 w-8 mr-2">
                            <AvatarImage src={groupMembers.find(m => m.id === message.senderId)?.photoURL || '/default-avatar.png'} />
                            <AvatarFallback>
                              {getMemberName(message.senderId || '')[0]?.toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div>
                          {!isCurrentUserMessage && (
                            <p className="text-xs font-medium mb-1">
                              {getMemberName(message.senderId)}
                            </p>
                          )}
                          <div className={`${
                            isCurrentUserMessage 
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-accent'
                            } rounded-lg p-2 text-sm`}
                          >
                            <AudioPlayer audioUrl={message.fileURL || ''} />
                            <div className="text-xs opacity-70 text-right mt-1">
                              {formatMessageDate(message.timestamp)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className={`flex ${isCurrentUserMessage ? 'flex-row-reverse' : 'flex-row'} items-start max-w-[80%]`}>
                        {!isCurrentUserMessage && (
                          <Avatar className="h-8 w-8 mr-2">
                            <AvatarImage src={groupMembers.find(m => m.id === message.senderId)?.photoURL || '/default-avatar.png'} />
                            <AvatarFallback>
                              {getMemberName(message.senderId || '')[0]?.toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div>
                          {!isCurrentUserMessage && (
                            <p className="text-xs font-medium mb-1">
                              {getMemberName(message.senderId)}
                            </p>
                          )}
                          <div className={`${
                            isCurrentUserMessage 
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-accent'
                            } rounded-lg px-3 py-2 text-sm break-words`}
                          >
                            {message.content}
                            <span className="text-xs opacity-70 ml-2">
                              {formatMessageDate(message.timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>
        
        {/* Message Input */}
        <form onSubmit={handleSendMessage} className="p-3 border-t flex flex-col space-y-2 shrink-0 bg-background">
          {/* Upload progress */}
          {isUploading && (
            <div className="w-full bg-accent/30 rounded-full h-1.5 mb-1">
              <div 
                className="bg-primary h-1.5 rounded-full" 
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          )}
          
          <div className="flex items-center space-x-2">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1"
              disabled={isUploading}
            />
            
            {/* Emoji Picker */}
            <div className="relative">
              <Button 
                type="button" 
                variant="ghost" 
                size="icon" 
                className="rounded-full h-9 w-9"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                disabled={isUploading}
              >
                <Smile size={18} />
              </Button>
              <AnimatePresence>
                {showEmojiPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-full right-0 mb-2 z-10"
                  >
                    <Picker
                      data={data}
                      onEmojiSelect={(emoji: any) => {
                        setNewMessage(prev => prev + emoji.native);
                        setShowEmojiPicker(false);
                      }}
                      previewPosition="none"
                      skinTonePosition="none"
                      theme={theme === 'dark' ? 'dark' : 'light'}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* File attachment */}
            <div className="relative">
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden" 
                id="file-upload" 
                disabled={isUploading}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full h-9 w-9"
                onClick={openCloudinaryWidget}
                disabled={isUploading}
              >
                <Paperclip size={18} />
              </Button>
            </div>
            
            {/* Voice message */}
            <VoiceRecorder onRecordingComplete={handleVoiceMessage} />
            
            <Button 
              type="submit" 
              disabled={!newMessage.trim() || isUploading}
              size="icon" 
              className="rounded-full h-9 w-9"
            >
              <Send size={16} />
            </Button>
          </div>
        </form>
      </div>
      
      {/* Group Call Dialog */}
      {showCallDialog && currentUser && activeCall && (
        <Dialog open={showCallDialog} onOpenChange={setShowCallDialog}>
          <DialogContent className="sm:max-w-[85vw] md:max-w-[1000px] p-0 h-[85vh] max-h-[700px]">
            <DialogTitle className="sr-only">
              Group call in {groupName}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Video call with group members in {groupName}
            </DialogDescription>
            <GroupVideoCall
              currentUserId={currentUser.id}
              groupId={groupId}
              groupName={groupName}
              onEndCall={handleEndCall}
              displayName={currentUser.displayName}
              photoURL={currentUser.photoURL}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default GroupMessages; 