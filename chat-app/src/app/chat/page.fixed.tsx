'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, where, getDocs, addDoc, orderBy, onSnapshot, getDoc, doc, updateDoc, setDoc, serverTimestamp, deleteDoc, limit, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTheme } from 'next-themes';
import { Sun, Moon, LogOut, Search, Send, UserPlus, MessageSquare, Edit, Image, Trash, MoreVertical, Check, X, Smile, Paperclip, Phone, Video, Mic, Play, Pencil, Square } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "sonner";
import { Toaster as SonnerToaster } from "sonner";
import { updateProfile } from 'firebase/auth';
import { useScript } from '@/hooks/useScript';

import { MdOutlineWbSunny, MdOutlineNightlight, MdLogout, MdCheck, MdClose, MdSend, MdPerson, MdSettings, MdDelete, MdModeEdit, MdMoreVert, MdSearch } from 'react-icons/md';
import { FaRegSmile, FaThumbsUp, FaHeart, FaLaugh, FaSadTear, FaAngry } from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CloudinaryUploadButton from "@/components/CloudinaryUploadButton";
import FileUploader from "@/components/FileUploader";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormLabel } from "@/components/ui/label";
import GroupChatComponent from '@/components/GroupChat';
import GroupMessages from '@/components/GroupMessages';

interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL: string;
  uid?: string;
  lastSeen?: Date;
  status?: 'online' | 'offline' | 'away';
  bio?: string;
  blockedUsers?: string[];
}

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: Date;
  chatId: string;
  read?: boolean;
  edited?: boolean;
  deleted?: boolean;
  type?: 'text' | 'image' | 'file' | 'voice';
  fileURL?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  reactions?: Record<string, string>; // userId: reactionType
  duration?: number; // Add duration for voice messages
}

interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'pending' | 'accepted' | 'rejected';
  timestamp: Date;
  senderEmail?: string;
  senderName?: string;
  senderPhoto?: string;
}

interface ChatSettings {
  nickname?: string;
  muted?: boolean;
  theme?: string;
  archived?: boolean;
  userId?: string;
  partnerId?: string;
}

interface FirestoreUser {
  email: string;
  displayName: string;
  photoURL: string;
  createdAt: Date;
  lastSeen?: Date;
  status?: 'online' | 'offline' | 'away';
  bio?: string;
}

interface ChatMessage {
  id: string;
  senderId: string;
  content: string;
  timestamp: any;
  chatId: string;
  reactions?: Record<string, string>;
  read?: boolean;
  deleted?: boolean;
  edited?: boolean;
  type?: 'text' | 'image' | 'file' | 'voice';
  fileURL?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  duration?: number; // Add duration for voice messages
}

// Add a new interface for chat notifications
interface ChatNotification {
  chatId: string;
  unreadCount: number;
  lastMessageTime: Date;
}

// Add typings for Cloudinary
declare global {
  interface Window {
    cloudinary: any;
  }
}

// Add TypingIndicator component
const TypingIndicator = () => {
  return (
    <div className="flex items-center space-x-1 px-4 py-2">
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
        <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
      </div>
      <span className="text-sm text-muted-foreground">typing...</span>
    </div>
  );
};

// Add VoiceRecorder component
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
        className={`rounded-full ${isRecording ? 'animate-pulse' : ''}`}
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onMouseLeave={stopRecording}
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
      >
        <Mic size={20} />
      </Button>
      {isRecording && (
        <div className="absolute bottom-full left-0 mb-2 bg-red-500 text-white px-3 py-1 rounded-full text-xs flex items-center space-x-1 shadow-md">
          <span className="animate-pulse">â—</span>
          <span>{formatTime(recordingTime)}</span>
        </div>
    </div>
  );
};

// Replace the AudioVisualizer component with a design matching the reference image
const AudioVisualizer = ({ audioUrl }: { audioUrl: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioLoaded, setAudioLoaded] = useState(false);

  useEffect(() => {
    if (!audioRef.current) return;
    
    // Set up audio element
    const audio = audioRef.current;
    audio.src = audioUrl;
    
    audio.onloadedmetadata = () => {
      // Only set duration if it's a valid number
      if (!isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      } else {
        setDuration(0); // Default duration
      }
      setAudioLoaded(true);
    };
    
    audio.ontimeupdate = () => {
      if (!isNaN(audio.currentTime) && isFinite(audio.currentTime)) {
        setCurrentTime(audio.currentTime);
      } else {
        setCurrentTime(0);
      }
    };
    
    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
    
    return () => {
      audio.pause();
      if (audioContextRef.current) {
        if (audioContextRef.current.state !== 'closed') {
          sourceRef.current?.disconnect();
          analyserRef.current?.disconnect();
        }
      }
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [audioUrl]);

  const setupAudioContext = () => {
    if (!audioRef.current) return;
    
    // Create audio context if it doesn't exist
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 32; // Even smaller for simpler visualization
        sourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
        sourceRef.current.connect(analyserRef.current);
        analyserRef.current.connect(audioContextRef.current.destination);
      } catch (error) {
        console.error("Error setting up audio context:", error);
      }
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current || !audioLoaded) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    } else {
      setupAudioContext();
      audioRef.current.play().catch(error => {
        console.error("Error playing audio:", error);
      });
      drawVisualizer();
    }
    
    setIsPlaying(!isPlaying);
  };

  const drawVisualizer = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const width = canvas.width;
    const height = canvas.height;
    
    const draw = () => {
      rafIdRef.current = requestAnimationFrame(draw);
      
      analyser.getByteFrequencyData(dataArray);
      
      ctx.clearRect(0, 0, width, height);
      
      const barWidth = 2;
      const gap = 1;
      const totalBars = Math.min(bufferLength, Math.floor(width / (barWidth + gap)));
      
      // Center the visualization
      const startX = (width - (totalBars * (barWidth + gap) - gap)) / 2;

      // Create gradient
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, "#ff3b30");
      gradient.addColorStop(1, "#ff9500");
      
      for (let i = 0; i < totalBars; i++) {
        // Use value from dataArray, scaled to fit your canvas
        const index = Math.floor((i / totalBars) * bufferLength);
        const barHeight = (dataArray[index] / 255) * height * 0.8;
        
        ctx.fillStyle = gradient;
        
        // Draw rounded bars
        const x = startX + i * (barWidth + gap);
        const y = height - barHeight;
        const radius = barWidth / 2;
        
        // Draw rounded rectangle
        if (barHeight > 0) {
          ctx.beginPath();
          ctx.moveTo(x + radius, y);
          ctx.lineTo(x + barWidth - radius, y);
          ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
          ctx.lineTo(x + barWidth, y + barHeight - radius);
          ctx.quadraticCurveTo(x + barWidth, y + barHeight, x + barWidth - radius, y + barHeight);
          ctx.lineTo(x + radius, y + barHeight);
          ctx.quadraticCurveTo(x, y + barHeight, x, y + barHeight - radius);
          ctx.lineTo(x, y + radius);
          ctx.quadraticCurveTo(x, y, x + radius, y);
          ctx.closePath();
          ctx.fill();
        }
      }
    };
    
    draw();
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format time for display
  const timeDisplay = `${formatTime(currentTime)}/${isFinite(duration) ? formatTime(duration) : '0:00'}`;

  return (
    <div className="flex flex-col max-w-[140px]">
      <audio ref={audioRef} className="hidden" />
      <div className="flex items-center space-x-1.5 bg-accent/10 rounded-full p-1">
        <button
          type="button"
          className="flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center bg-primary/90 hover:bg-primary transition-colors shadow-sm"
          onClick={togglePlayPause}
          disabled={!audioLoaded}
        >
          {isPlaying ? 
            <Square className="h-2.5 w-2.5 text-white" /> : 
            <Play className="h-2.5 w-2.5 text-white" />
          }
        </button>
        
        <div className="flex-1">
          <div className="relative h-[10px] rounded-full overflow-hidden">
            <canvas 
              ref={canvasRef} 
              width={80} 
              height={10} 
              className="w-full h-full"
            />
          </div>
          
          <div className="text-[8px] text-muted-foreground mt-0.5 text-right pr-1">
            {timeDisplay}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function ChatPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [recentChats, setRecentChats] = useState<User[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [activeTab, setActiveTab] = useState<string>('chats');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // New state variables for enhanced features
  const [userTyping, setUserTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isTyping, setIsTyping] = useState<{[key: string]: boolean}>({});
  const [chatSettings, setChatSettings] = useState<Record<string, ChatSettings>>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [editedNickname, setEditedNickname] = useState('');
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [editedDisplayName, setEditedDisplayName] = useState('');
  const [editedBio, setEditedBio] = useState('');
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [messageReactions, setMessageReactions] = useState<Record<string, Record<string, string>>>({});
  
  // Add new state variables
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showChatOptions, setShowChatOptions] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [isProfilePictureUploading, setIsProfilePictureUploading] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [showEditNickname, setShowEditNickname] = useState(false);
  const [chatNotifications, setChatNotifications] = useState<Record<string, ChatNotification>>({});
  const [newMessageAnimation, setNewMessageAnimation] = useState<string | null>(null);
  
  // Add new state variables after the other state declarations (around line 147)
  const [showFilesPhotosSheet, setShowFilesPhotosSheet] = useState(false);
  const [sheetTab, setSheetTab] = useState<'files' | 'photos'>('files');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  
  // Generic reactions
  const reactions = ['â¤ï¸', 'ðŸ‘', 'ðŸ˜‚', 'ðŸ˜¢', 'ðŸ˜¡', 'ðŸ”¥'];
  
  // Add Cloudinary widget reference
  const cloudinaryRef = useRef<any>();
  const widgetRef = useRef<any>();
  
  // Add Cloudinary script
  const cloudinaryScript = useScript("https://upload-widget.cloudinary.com/global/all.js");
  
  // Load user profile data
  useEffect(() => {
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      const unsubscribe = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          setUserProfile({ id: docSnap.id, ...docSnap.data() } as User);
          setEditedDisplayName(docSnap.data().displayName || '');
          setEditedBio(docSnap.data().bio || '');
        }
      });
      
      return () => unsubscribe();
    }
  }, [user]);
  
  // Load chat settings (nicknames, etc.)
  useEffect(() => {
    if (!user) return;
    
    const settingsRef = collection(db, 'chatSettings');
    const q = query(settingsRef, where('userId', '==', user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const settings: {[key: string]: ChatSettings} = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data() as ChatSettings;
        if (data.partnerId) {
          settings[data.partnerId] = data;
        }
      });
      setChatSettings(settings);
      
      // If we have a selected user, set the nickname input
      if (selectedUser && settings[selectedUser.id]) {
        setEditedNickname(settings[selectedUser.id].nickname || '');
      }
    });
    
    return () => unsubscribe();
  }, [user, selectedUser?.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Scroll to bottom when user is selected
  useEffect(() => {
    if (selectedUser) {
      // Use setTimeout to ensure this happens after the messages are rendered
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 100);
    }
  }, [selectedUser]);

  // Update user status to online when active
  useEffect(() => {
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      updateDoc(userRef, {
        status: 'online',
        lastSeen: serverTimestamp(),
      }).catch(error => console.error('Error updating status:', error));
      
      // Set status to offline when user leaves
      return () => {
        updateDoc(userRef, {
          status: 'offline',
          lastSeen: serverTimestamp(),
        }).catch(error => console.error('Error updating status:', error));
      };
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  useEffect(() => {
    if (selectedUser && user) {
      const messagesRef = collection(db, 'messages');
      // Create a chat ID that's consistent regardless of who initiated the chat
      const chatId = [user.uid, selectedUser.id].sort().join('_');
      
      // First ensure the chat document exists
      const createChatDoc = async () => {
        const chatRef = doc(db, 'chats', chatId);
        const chatSnap = await getDoc(chatRef);
        
        if (!chatSnap.exists()) {
          await setDoc(chatRef, {
            participants: [user.uid, selectedUser.id],
            lastMessage: null,
            lastMessageTime: new Date(),
            createdAt: new Date()
          });
        }
      };
      
      createChatDoc();

      // Query messages with proper index
      const q = query(
        messagesRef,
        where('chatId', '==', chatId),
        orderBy('timestamp', 'asc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const newMessages = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
          id: doc.id,
            senderId: data.senderId,
            content: data.content,
            type: data.type,
            fileURL: data.fileURL,
            fileName: data.fileName,
            fileSize: data.fileSize,
            chatId: data.chatId,
            timestamp: data.timestamp?.toDate() || new Date()
          } as ChatMessage;
        });
        console.log('Received messages:', newMessages.length);
        setMessages(newMessages);
      }, (error) => {
        if (error.code === 'failed-precondition') {
          console.log('Please create the following index in Firebase Console:', error.message);
        } else {
          console.error('Error in messages listener:', error);
        }
      });

      return () => unsubscribe();
    } else {
      // Clear messages when no user is selected
      setMessages([]);
    }
  }, [selectedUser, user]);

  // Load friend requests with sender info
  useEffect(() => {
    if (!user) return;

    const requestsRef = collection(db, 'friendRequests');
    const q = query(
      requestsRef,
      where('receiverId', '==', user.uid),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const requestPromises = snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        // Get sender's info
        const senderRef = doc(db, 'users', data.senderId);
        const senderSnap = await getDoc(senderRef);
        const senderData = senderSnap.data() as FirestoreUser | undefined;
        
        return {
          id: docSnap.id,
          ...data,
          senderEmail: senderData?.email || 'Unknown',
          senderName: senderData?.displayName || 'Unknown User',
          senderPhoto: senderData?.photoURL || '/default-avatar.png'
        } as FriendRequest & { 
          senderEmail: string; 
          senderName: string; 
          senderPhoto: string 
        };
      });

      const requests = await Promise.all(requestPromises);
      setFriendRequests(requests);
    });

    return () => unsubscribe();
  }, [user]);

  // Load recent chats (accepted friends)
  useEffect(() => {
    if (!user) return;

    const friendsRef = collection(db, 'friendRequests');
    const q = query(
      friendsRef,
      where('status', '==', 'accepted'),
      where('participants', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const friendDocs = snapshot.docs;
      const userPromises = friendDocs.map(async (friendDoc) => {
        const data = friendDoc.data();
        const friendId = data.senderId === user.uid ? data.receiverId : data.senderId;
        const userRef = doc(db, 'users', friendId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          return { id: userSnap.id, ...userSnap.data() } as User;
        }
        return null;
      });

      const friends = (await Promise.all(userPromises)).filter((friend): friend is User => friend !== null);
      setRecentChats(friends);
    });

    return () => unsubscribe();
  }, [user]);

  // Load blocked users
  useEffect(() => {
    if (!user) return;
    
    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        setBlockedUsers(userData.blockedUsers || []);
      }
    });
    
    return () => unsubscribe();
  }, [user]);

  // Load unread messages and notifications
  useEffect(() => {
    if (!user) return;
    
    // Listen for all chats with new messages
    const chatsRef = collection(db, 'chats');
    const q = query(
      chatsRef,
      where('participants', 'array-contains', user.uid)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifications: Record<string, ChatNotification> = {};
      
      snapshot.docs.forEach(doc => {
        const chatData = doc.data();
        const participants = chatData.participants;
        if (!participants || participants.length !== 2) return;
        
        const otherUserId = participants[0] === user.uid ? participants[1] : participants[0];
        
        // Don't track notifications for the currently selected chat
        if (selectedUser && selectedUser.id === otherUserId) return;
        
        // Check if there are unread messages
        if (chatData.lastMessageTime && chatData.lastSenderId !== user.uid) {
          const lastReadTime = chatData.lastReadTime?.[user.uid] || new Date(0);
          const lastMessageTime = chatData.lastMessageTime.toDate();
          
          if (lastMessageTime > lastReadTime) {
            notifications[otherUserId] = {
              chatId: doc.id,
              unreadCount: chatData.unreadCount?.[user.uid] || 1,
              lastMessageTime
            };
          }
        }
      });
      
      setChatNotifications(notifications);
    });
    
    return () => unsubscribe();
  }, [user, selectedUser]);

  // Mark messages as read when selecting a user
  useEffect(() => {
    if (!user || !selectedUser) return;
    
    const chatId = [user.uid, selectedUser.id].sort().join('_');
    const chatRef = doc(db, 'chats', chatId);
    
    // Mark as read
    updateDoc(chatRef, {
      [`lastReadTime.${user.uid}`]: serverTimestamp(),
      [`unreadCount.${user.uid}`]: 0
    }).catch(err => console.error("Error marking chat as read:", err));
    
  }, [selectedUser, user]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);

    try {
    const usersRef = collection(db, 'users');
      // Make the search case-insensitive
      const searchLower = searchQuery.toLowerCase();
      const q = query(
        usersRef,
        where('email', '>=', searchLower),
        where('email', '<=', searchLower + '\uf8ff')
      );
      
    const querySnapshot = await getDocs(q);
      console.log('Search query:', searchLower);
      console.log('Number of results:', querySnapshot.size);
      
      const results = querySnapshot.docs
        .map(doc => {
          const data = doc.data();
          console.log('User data:', data);
          return {
      id: doc.id,
            ...data
          } as User;
        })
        .filter(searchUser => searchUser.id !== user?.uid); // Don't show current user
      
    setSearchResults(results);
      
      if (results.length === 0) {
        console.log('No users found for query:', searchLower);
      }
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser || !user) return;

    try {
      const chatId = [user.uid, selectedUser.id].sort().join('_');
      
      // First ensure chat document exists
      const chatRef = doc(db, 'chats', chatId);
      const chatSnap = await getDoc(chatRef);
      
      if (!chatSnap.exists()) {
        await setDoc(chatRef, {
          participants: [user.uid, selectedUser.id],
          lastMessage: null,
          lastMessageTime: new Date(),
          createdAt: new Date()
        });
      }

      // Then add the message
    const messagesRef = collection(db, 'messages');
      const messageData = {
        senderId: user.uid,
      receiverId: selectedUser.id,
        content: newMessage.trim(),
      timestamp: new Date(),
        chatId: chatId
      };

      await addDoc(messagesRef, messageData);
      
      // Update the chat document with last message
      await updateDoc(chatRef, {
        lastMessage: messageData.content,
        lastMessageTime: messageData.timestamp
    });

    setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
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

  const sendFriendRequest = async (targetUser: User) => {
    if (!user) return;

    try {
      const requestsRef = collection(db, 'friendRequests');
      
      // Check if request already exists
      const existingQuery = query(
        requestsRef,
        where('senderId', 'in', [user.uid, targetUser.id]),
        where('receiverId', 'in', [user.uid, targetUser.id])
      );
      
      const existingDocs = await getDocs(existingQuery);
      
      if (!existingDocs.empty) {
        console.log('Friend request already exists');
        return;
      }

      await addDoc(requestsRef, {
        senderId: user.uid,
        receiverId: targetUser.id,
        status: 'pending',
        timestamp: new Date(),
        participants: [user.uid, targetUser.id].sort()
      });

      console.log('Friend request sent successfully');
    } catch (error) {
      console.error('Error sending friend request:', error);
    }
  };

  const handleFriendRequest = async (requestId: string, status: 'accepted' | 'rejected') => {
    if (!user) return;
    
    try {
      const requestRef = doc(db, 'friendRequests', requestId);
      const requestSnap = await getDoc(requestRef);
      const requestData = requestSnap.data();
      
      if (!requestData) return;

      await updateDoc(requestRef, { 
        status,
        updatedAt: new Date()
      });

      if (status === 'accepted') {
        // After accepting, add to recent chats
        const chatId = [requestData.senderId, requestData.receiverId].sort().join('_');
        
        // Create or update the chat document
        const chatRef = doc(db, 'chats', chatId);
        await setDoc(chatRef, {
          participants: [requestData.senderId, requestData.receiverId],
          lastMessage: null,
          lastMessageTime: new Date(),
          createdAt: new Date()
        }, { merge: true });
      }

      console.log(`Friend request ${status}`);
    } catch (error) {
      console.error('Error handling friend request:', error);
    }
  };

  // Handle typing indicators
  const handleTyping = () => {
    if (!selectedUser || !user) return;
    
    const chatId = [user.uid, selectedUser.id].sort().join('_');
    const typingRef = doc(db, 'typing', chatId);
    
    // Set typing status
    updateDoc(typingRef, {
      [user.uid]: true,
      timestamp: serverTimestamp()
    }).catch(err => {
      if (err.code === 'not-found') {
        setDoc(typingRef, {
          [user.uid]: true,
          timestamp: serverTimestamp()
        });
      }
    });
    
    // Clear previous timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    
    // Set new timeout to clear typing status
    const timeout = setTimeout(() => {
      updateDoc(typingRef, {
        [user.uid]: false,
        timestamp: serverTimestamp()
      }).catch(console.error);
    }, 3000); // Clear after 3 seconds of inactivity
    
    setTypingTimeout(timeout);
  };
  
  // Monitor typing status of the selected user
  useEffect(() => {
    if (!selectedUser || !user) return;
    
    const chatId = [user.uid, selectedUser.id].sort().join('_');
    const typingRef = doc(db, 'typing', chatId);
    
    const unsubscribe = onSnapshot(typingRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsTyping(prev => ({
          ...prev,
          [selectedUser.id]: data[selectedUser.id] === true
        }));
      }
    });
    
    return () => unsubscribe();
  }, [selectedUser, user]);
  
  // Function to react to a message
  const addReaction = async (messageId: string, reaction: string) => {
    if (!user) return;
    
    const messageRef = doc(db, 'messages', messageId);
    const messageSnap = await getDoc(messageRef);
    
    if (!messageSnap.exists()) return;
    
    const messageData = messageSnap.data();
    const reactions = messageData.reactions || {};
    
    if (reactions[user.uid] === reaction) {
      delete reactions[user.uid];
    } else {
      reactions[user.uid] = reaction;
    }
    
    await updateDoc(messageRef, { reactions });
  };
  
  // Function to delete a message
  const deleteMessage = async (messageId: string) => {
    if (!user) return;
    
    try {
      const messageRef = doc(db, 'messages', messageId);
      const messageSnap = await getDoc(messageRef);
      
      if (!messageSnap.exists()) return;
      const messageData = messageSnap.data();
      
      if (messageData.senderId !== user.uid) return;
      
      // Update based on message type
      const updateData: any = { 
        deleted: true
      };
      
      // For voice messages, clear the fileURL to prevent playback
      if (messageData.type === 'voice') {
        updateData.fileURL = null;
        updateData.content = 'Voice message was deleted';
      } else if (messageData.type === 'image' || messageData.type === 'file') {
        updateData.fileURL = null;
        updateData.content = `${messageData.type === 'image' ? 'Image' : 'File'} was deleted`;
      } else {
        updateData.content = 'This message was deleted';
      }
      
      await updateDoc(messageRef, updateData);
      toast.success('Message deleted successfully');
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message');
    }
  };
  
  // Function to update profile
  const updateProfile = async () => {
    if (!user) return;
    
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName: editedDisplayName,
        bio: editedBio,
        updatedAt: serverTimestamp()
      });
      
      setProfileDialogOpen(false);
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    }
  };
  
  // Function to save chat nickname
  const saveChatNickname = async () => {
    if (!user || !selectedUser) return;
    
    try {
      const settingsRef = collection(db, 'chatSettings');
      const q = query(
        settingsRef, 
        where('userId', '==', user.uid),
        where('partnerId', '==', selectedUser.id)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        await addDoc(settingsRef, {
          userId: user.uid,
          partnerId: selectedUser.id,
          nickname: editedNickname,
          createdAt: serverTimestamp()
        });
      } else {
        const docRef = querySnapshot.docs[0].ref;
        await updateDoc(docRef, {
          nickname: editedNickname,
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error saving nickname:', error);
    }
  };
  
  // Function to get display name for a user (with nickname if set)
  const getDisplayName = (userId: string) => {
    if (!userId) return 'Unknown';
    
    // If it's the selected user and we have a nickname
    if (selectedUser && userId === selectedUser.id && chatSettings[selectedUser.id]?.nickname) {
      return chatSettings[selectedUser.id].nickname;
    }
    
    // If it's a user in our recent chats
    const chatUser = recentChats.find(u => u.id === userId);
    if (chatUser) {
      return chatUser.displayName || chatUser.email;
    }
    
    // If it's the currently selected user
    if (selectedUser && selectedUser.id === userId) {
      return selectedUser.displayName || selectedUser.email;
    }
    
    // If it's the current user
    if (user && user.uid === userId) {
      return user.displayName || user.email;
    }
    
    return 'Unknown User';
  };

  // Load chat settings
  useEffect(() => {
    if (!user || !selectedUser) return;
    
    const settingsRef = collection(db, 'chatSettings');
    const q = query(
      settingsRef, 
      where('userId', '==', user.uid),
      where('partnerId', '==', selectedUser.id)
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      if (!querySnapshot.empty) {
        const settingsDoc = querySnapshot.docs[0];
        const settingsData = settingsDoc.data();
        
        setChatSettings(prev => ({
          ...prev,
          [selectedUser.id]: {
            nickname: settingsData.nickname || '',
            muted: settingsData.muted || false,
            theme: settingsData.theme || 'default',
            archived: settingsData.archived || false,
            userId: settingsData.userId,
            partnerId: settingsData.partnerId
          } as ChatSettings
        }));
        
        // Set the edited nickname for the UI
        setEditedNickname(settingsData.nickname || '');
      } else {
        // No settings found for this chat
        setChatSettings(prev => ({
          ...prev,
          [selectedUser.id]: {
            nickname: '',
            muted: false,
            theme: 'default',
            archived: false,
            userId: user.uid,
            partnerId: selectedUser.id
          } as ChatSettings
        }));
        
        setEditedNickname('');
      }
    });
    
    return () => unsubscribe();
  }, [selectedUser, user]);
  
  // Load current user profile data when opening profile dialog
  useEffect(() => {
    if (!user || !profileDialogOpen) return;
    
    const fetchUserProfile = async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setEditedDisplayName(userData.displayName || '');
          setEditedBio(userData.bio || '');
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };
    
    fetchUserProfile();
  }, [user, profileDialogOpen]);
  
  // Handle message edits
  const startEditingMessage = (message: ChatMessage) => {
    if (message.senderId !== user?.uid) return;
    setEditingMessage(message.id);
    setEditedContent(message.content);
  };
  
  const saveEditedMessage = async () => {
    if (!editingMessage || !user) return;
    
    try {
      const messageRef = doc(db, 'messages', editingMessage);
      await updateDoc(messageRef, {
        content: editedContent,
        edited: true,
        updatedAt: serverTimestamp()
      });
      
      setEditingMessage(null);
      setEditedContent('');
      toast.success('Message updated successfully');
    } catch (error) {
      console.error('Error updating message:', error);
      toast.error('Failed to update message');
    }
  };

  // Updated sendMessage function
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !selectedUser || !user) return;
    
    // Check if user is blocked
    if (selectedUser.blockedUsers?.includes(user.uid)) {
      toast.error('This user has blocked you. You cannot send messages.');
      return;
    }
    
    try {
      const chatId = [user.uid, selectedUser.id].sort().join('_');
      
      // Add the message to Firestore
      const messageRef = await addDoc(collection(db, 'messages'), {
        chatId,
        senderId: user.uid,
        receiverId: selectedUser.id,
        content: newMessage,
        timestamp: serverTimestamp(),
        read: false,
        edited: false,
        deleted: false,
        reactions: {}
      });
      
      // Trigger message animation
      setNewMessageAnimation(messageRef.id);
      setTimeout(() => setNewMessageAnimation(null), 1500);
      
      // Update the last message in the chat document
      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, {
        lastMessage: newMessage,
        lastMessageTime: serverTimestamp(),
        lastSenderId: user.uid,
        // Increment unread counter for recipient
        [`unreadCount.${selectedUser.id}`]: increment(1)
      });
      
      // Clear the input field
      setNewMessage('');
      
      // Force scroll to bottom after sending a new message
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  // Configure Cloudinary widget when script is loaded
  useEffect(() => {
    if (cloudinaryScript === "ready" && window.cloudinary && user) {
      cloudinaryRef.current = window.cloudinary;
      widgetRef.current = cloudinaryRef.current.createUploadWidget({
        cloudName: 'dt7yizyhv', // Replace with your cloud name
        uploadPreset: 'voice_message', // Replace with your upload preset
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
          console.log('Upload success:', result.info);
          // Handle the successful upload
          handleFileUploadSuccess(result.info);
        }
      });
    }
  }, [cloudinaryScript, theme, user]);
  
  // Function to handle successful file upload
  const handleFileUploadSuccess = (result: any) => {
    if (!selectedUser || !user) return;
    
    try {
      // Use the result to create a message
      const fileType = result.resource_type;
      const fileURL = result.secure_url;
      const fileName = result.original_filename;
      const fileSize = result.bytes;
      
      // Determine the message type
      const messageType = fileType === 'image' ? 'image' : 'file';
      
      // Create message content
      let messageContent = '';
      if (messageType === 'image') {
        messageContent = 'ðŸ“· Image';
      } else {
        messageContent = `ðŸ“Ž ${fileName || 'File'}`;
      }
      
      const chatId = [user.uid, selectedUser.id].sort().join('_');
      
      // Add message to Firestore
      addDoc(collection(db, 'messages'), {
        chatId,
        senderId: user.uid,
        receiverId: selectedUser.id,
        content: messageContent,
        timestamp: serverTimestamp(),
        read: false,
        edited: false,
        deleted: false,
        reactions: {},
        type: messageType,
        fileURL: fileURL,
        fileName: fileName || '',
        fileSize: fileSize || 0,
        fileType: fileType || ''
      });
      
      // Update chat document
      const chatRef = doc(db, 'chats', chatId);
      updateDoc(chatRef, {
        lastMessage: messageContent,
        lastMessageTime: serverTimestamp(),
        lastSenderId: user.uid,
        // Increment unread counter for recipient
        [`unreadCount.${selectedUser.id}`]: increment(1)
      });
      
      toast.success(messageType === 'image' ? 'Image sent successfully' : 'File sent successfully');
      
    } catch (error) {
      console.error('Error creating message:', error);
      toast.error('Failed to send file');
    }
  };
  
  // Modify the handleFileUpload function to use Cloudinary's Upload API directly
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !user || !selectedUser) {
      return;
    }
    
    try {
      setIsUploading(true);
      const file = e.target.files[0];
      
      // Create a FormData object to send the file
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'ml_default'); // Replace with your upload preset
      formData.append('cloud_name', 'demo'); // Replace with your cloud name
      
      // Upload to Cloudinary
      const response = await fetch('https://api.cloudinary.com/v1_1/demo/auto/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('File upload failed');
      }
      
      const result = await response.json();
      console.log('Upload success:', result);
      
      // Use the result to create a message
      const fileType = result.resource_type;
      const fileURL = result.secure_url;
      const fileName = result.original_filename;
      const fileSize = result.bytes;
      
      // Determine the message type
      const messageType = fileType === 'image' ? 'image' : 'file';
      
      // Create message content
      let messageContent = '';
      if (messageType === 'image') {
        messageContent = 'ðŸ“· Image';
      } else {
        messageContent = `ðŸ“Ž ${fileName || 'File'}`;
      }
      
      const chatId = [user.uid, selectedUser.id].sort().join('_');
      
      // Add message to Firestore
      const messageRef = await addDoc(collection(db, 'messages'), {
        chatId,
        senderId: user.uid,
        receiverId: selectedUser.id,
        content: messageContent,
        timestamp: serverTimestamp(),
        read: false,
        edited: false,
        deleted: false,
        reactions: {},
        type: messageType,
        fileURL: fileURL,
        fileName: fileName || '',
        fileSize: fileSize || 0,
        fileType: fileType || ''
      });
      
      // Update chat document
      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, {
        lastMessage: messageContent,
        lastMessageTime: serverTimestamp(),
        lastSenderId: user.uid,
        // Increment unread counter for recipient
        [`unreadCount.${selectedUser.id}`]: increment(1)
      });
      
      toast.success(messageType === 'image' ? 'Image sent successfully' : 'File sent successfully');
      
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // Add new function for profile picture upload
  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !user) {
      console.log('No file selected or no user');
      return;
    }
    
    setIsProfilePictureUploading(true);
    const file = e.target.files[0];
    console.log('File selected:', file.name, file.size);
    
    try {
      // Create a canvas element
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('Could not get canvas context');
        throw new Error('Could not get canvas context');
      }

      // Create an image element
      const img = new window.Image();
      
      // Set up image loading
      img.onload = async () => {
        console.log('Image loaded, dimensions:', img.width, 'x', img.height);
        
        // Calculate new dimensions (max 200x200)
        const maxSize = 200;
        let width = img.width;
        let height = img.height;
        
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        
        console.log('New dimensions:', width, 'x', height);
        
        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress image
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to base64 with reduced quality
        const base64String = canvas.toDataURL('image/jpeg', 0.7);
        console.log('Base64 string length:', base64String.length);
        
        try {
          // First update Firestore
          const userRef = doc(db, 'users', user.uid);
          console.log('Updating user document:', user.uid);
          
          await updateDoc(userRef, {
            photoURL: base64String,
            updatedAt: serverTimestamp()
          });
          
          // Skip trying to update Auth profile
          
          // Update local state to force UI refresh
          setUserProfile(prev => {
            if (!prev) return null;
            return {
              ...prev,
              photoURL: base64String
            };
          });
          
          console.log('Profile picture updated successfully');
          setIsProfilePictureUploading(false);
          toast.success('Profile picture updated successfully');
          
          // Close and reopen the dialog to force all components to refresh
          setProfileDialogOpen(false);
          setTimeout(() => {
            setProfileDialogOpen(true);
          }, 100);
        } catch (error) {
          console.error('Error updating profile:', error);
          toast.error('Failed to update profile picture');
          setIsProfilePictureUploading(false);
        }
      };
      
      // Handle image loading errors
      img.onerror = (error) => {
        console.error('Error loading image:', error);
        setIsProfilePictureUploading(false);
        toast.error('Failed to load image');
      };
      
      // Start loading the image
      const objectUrl = URL.createObjectURL(file);
      console.log('Created object URL:', objectUrl);
      img.src = objectUrl;
    } catch (error) {
      console.error('Error in handleProfilePictureUpload:', error);
      toast.error('Failed to update profile picture');
      setIsProfilePictureUploading(false);
    }
  };

  // Add function to handle blocking users
  const handleBlockUser = async (userId: string) => {
    if (!user) return;
    
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) return;
      
      const userData = userSnap.data();
      const blockedUsers = userData.blockedUsers || [];
      
      if (blockedUsers.includes(userId)) {
        // Unblock user
        await updateDoc(userRef, {
          blockedUsers: blockedUsers.filter((id: string) => id !== userId)
        });
        setBlockedUsers(prev => prev.filter(id => id !== userId));
        toast.success('User unblocked successfully');
      } else {
        // Block user
        await updateDoc(userRef, {
          blockedUsers: [...blockedUsers, userId]
        });
        setBlockedUsers(prev => [...prev, userId]);
        toast.success('User blocked successfully');
      }
      
      setShowChatOptions(false);
    } catch (error) {
      console.error('Error blocking user:', error);
      toast.error('Failed to block user');
    }
  };

  // Add function to handle nickname updates
  const handleUpdateNickname = async () => {
    if (!user || !selectedUser) return;
    
    try {
      const settingsRef = collection(db, 'chatSettings');
      const q = query(
        settingsRef,
        where('userId', '==', user.uid),
        where('partnerId', '==', selectedUser.id)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        await addDoc(settingsRef, {
          userId: user.uid,
          partnerId: selectedUser.id,
          nickname: editedNickname,
          createdAt: serverTimestamp()
        });
      } else {
        const docRef = querySnapshot.docs[0].ref;
        await updateDoc(docRef, {
          nickname: editedNickname,
          updatedAt: serverTimestamp()
        });
      }
      
      toast.success('Nickname updated successfully');
      setShowChatOptions(false);
    } catch (error) {
      console.error('Error updating nickname:', error);
      toast.error('Failed to update nickname');
    }
  };

  // Add new state for current image index
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [imageMessages, setImageMessages] = useState<ChatMessage[]>([]);

  // Add new state for voice recording
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);

  // Add function to handle voice message upload
  const handleVoiceMessage = async (audioBlob: Blob) => {
    if (!selectedUser || !user) return;
    
    console.log('Processing voice message, blob size:', audioBlob.size, 'bytes');
    
    if (audioBlob.size < 100) {
      console.error('Audio blob too small to be valid');
      toast.error('Recording was too short. Please try again.');
      return;
    }

    try {
      setIsUploading(true);
      toast.loading('Sending voice message...');
      
      // Create a unique filename
      const timestamp = Date.now();
      const filename = `voice_${timestamp}.webm`;
      
      // Use base64 encoding to store the audio directly in Firestore
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        try {
          const base64data = reader.result as string;
          console.log('Converted audio to base64, length:', base64data.length);
          
          // Create message in Firestore with the base64 data
          const chatId = [user.uid, selectedUser.id].sort().join('_');
          const messageRef = await addDoc(collection(db, 'messages'), {
            chatId,
            senderId: user.uid,
            receiverId: selectedUser.id,
            content: 'ðŸŽ¤ Voice message',
            timestamp: serverTimestamp(),
            read: false,
            edited: false,
            deleted: false,
            reactions: {},
            type: 'voice',
            fileURL: base64data, // Use base64 data directly
            fileName: filename,
            fileSize: audioBlob.size,
            fileType: 'audio/webm',
            duration: Math.round(audioBlob.size / 2000) // Approximate duration in seconds
          });
          
          console.log('Voice message stored directly in Firestore, ID:', messageRef.id);
          
          // Update chat document
          const chatRef = doc(db, 'chats', chatId);
          await updateDoc(chatRef, {
            lastMessage: 'ðŸŽ¤ Voice message',
            lastMessageTime: serverTimestamp(),
            lastSenderId: user.uid,
            [`unreadCount.${selectedUser.id}`]: increment(1)
          });
          
          toast.dismiss();
          toast.success('Voice message sent');
        } catch (error) {
          console.error('Error storing voice message:', error);
          toast.dismiss();
          toast.error(`Failed to store voice message: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
          setIsUploading(false);
        }
      };
      
      reader.onerror = () => {
        console.error('Error reading audio blob');
        toast.dismiss();
        toast.error('Failed to process audio recording');
        setIsUploading(false);
      };
    } catch (error) {
      console.error('Error handling voice message:', error);
      toast.dismiss();
      toast.error(`Failed to process voice message: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsUploading(false);
    }
  };

  // Add new state for group chat
  const [selectedGroup, setSelectedGroup] = useState<{ id: string, name: string } | null>(null);
  
  // Add this function to handle selecting a group chat
  const handleSelectGroup = (groupId: string, groupName: string) => {
    setSelectedGroup({ id: groupId, name: groupName });
    setSelectedUser(null); // Deselect any one-on-one chat
  };

  return (
    <>
      <div className="flex h-screen bg-background">
        {/* Mobile menu button - only visible on small screens */}
        <button
          className="fixed top-4 z-50 md:hidden p-2 rounded-full bg-primary text-primary-foreground shadow-md"
          style={{ 
            left: isSidebarOpen ? '16px' : '16px',
            transition: 'left 0.3s ease-in-out'
          }}
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          <span className="sr-only">Toggle menu</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {isSidebarOpen ? (
              // X icon when sidebar is open
              <>
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            ) : (
              // Hamburger icon when sidebar is closed
              <>
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>

        {/* Sidebar - Make it responsive */}
        <div className={`
          fixed inset-y-0 left-0 z-40 w-80 border-r border-border flex flex-col bg-card
          transform transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:relative
        `}>
          {/* Sidebar Header */}
          <div className="p-4 pt-14 md:pt-4 border-b border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setProfileDialogOpen(true)}
                        className="relative rounded-full overflow-hidden border border-border hover:border-primary transition-colors"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={userProfile?.photoURL || user?.photoURL || '/default-avatar.png'} />
                          <AvatarFallback>
                            {user?.displayName?.[0]?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Click to edit profile</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <div className="flex flex-col">
                  <span className="font-medium truncate max-w-[140px]">
                    {user?.displayName || user?.email?.split('@')[0] || 'User'}
                  </span>
                  <Badge variant="outline" className="w-fit">
                    Online
                  </Badge>
                </div>
              </div>
              
              {/* Dark mode toggle moved inside the sidebar header */}
              <div className="flex items-center">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className="rounded-full"
                      >
                        {theme === 'dark' ? (
                          <Sun size={20} />
                        ) : (
                          <Moon size={20} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Toggle theme</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            <Tabs defaultValue="chats" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="chats">Chats</TabsTrigger>
                <TabsTrigger value="groups">Groups</TabsTrigger>
                <TabsTrigger value="friends">Friends</TabsTrigger>
              </TabsList>
              <TabsContent value="chats">
                <div className="relative">
                  <Input
              value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search users..."
                    className="pr-10"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
              onClick={handleSearch}
            >
              <Search size={20} />
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="groups">
                <GroupChatComponent 
                  currentUser={user as unknown as User}
                  onSelect={handleSelectGroup}
                />
              </TabsContent>
              <TabsContent value="friends">
                <div className="space-y-2">
                  {recentChats.map((chat) => (
                    <div
                      key={chat.id}
                      className="flex items-center space-x-3 p-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                    >
                      <Avatar>
                        <AvatarImage src={chat.photoURL || '/default-avatar.png'} />
                        <AvatarFallback>
                          {chat.displayName?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium truncate">
                          {chatSettings[chat.id]?.nickname || chat.displayName || chat.email}
                          {blockedUsers.includes(chat.id) && " (Blocked)"}
                        </span>
                        <Badge variant="outline" className="w-fit">
                          {chat.status === 'online' ? 'Online' : 'Offline'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Friend Requests */}
          {friendRequests.length > 0 && (
            <div className="px-4 py-2 border-b border-border">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Friend Requests
              </h3>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {friendRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-accent/30"
                    >
                      <div className="flex items-center space-x-3">
                        <Avatar>
                          <AvatarImage src={request.senderPhoto || '/default-avatar.png'} />
                          <AvatarFallback>
                            {request.senderName?.[0]?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium truncate max-w-[120px]">
                            {request.senderName || request.senderEmail}
                          </span>
                          <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                            {request.senderEmail}
                          </span>
                  </div>
                      </div>
                      <div className="flex space-x-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => handleFriendRequest(request.id, 'rejected')}
                              >
                                <X size={16} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Reject request</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-green-500"
                                onClick={() => handleFriendRequest(request.id, 'accepted')}
                              >
                                <Check size={16} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Accept request</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                </div>
              ))}
                </div>
              </ScrollArea>
            </div>

          {/* Recent Chats / Search Results */}
          <ScrollArea className="flex-1">
            {isSearching && searchResults.length > 0 ? (
              <div className="p-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  Search Results
                </h3>
                <div className="space-y-2">
                  {searchResults.map((result) => (
                    <div
                      key={result.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => sendFriendRequest(result)}
                    >
                      <div className="flex items-center space-x-3">
                        <Avatar>
                          <AvatarImage src={result.photoURL || '/default-avatar.png'} />
                          <AvatarFallback>
                            {result.displayName?.[0]?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium truncate max-w-[140px]">
                            {result.displayName || result.email}
                          </span>
                          <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                            {result.email}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                      >
                        Add
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  Recent Chats
                </h3>
                {recentChats.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <p className="text-center">No chats yet.</p>
                    <p className="text-xs mt-1">Search for users to start chatting</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentChats.map((chat) => (
                      <div
                        key={chat.id}
                        className={`flex items-center space-x-3 p-2 rounded-lg cursor-pointer transition-colors ${
                          selectedUser?.id === chat.id
                            ? 'bg-accent'
                            : 'hover:bg-accent/50'
                        }`}
                        onClick={() => {
                          if (blockedUsers.includes(chat.id)) {
                            toast.error('You have blocked this user. Unblock to resume chatting.');
                          }
                          setSelectedUser(chat);
                        }}
                      >
                        <div className="relative">
                          <Avatar>
                            <AvatarImage src={chat.photoURL || '/default-avatar.png'} />
                            <AvatarFallback>
                              {chat.displayName?.[0]?.toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          {chatNotifications[chat.id] && (
                            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                              {chatNotifications[chat.id].unreadCount}
                            </span>
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-medium truncate">
                              {chatSettings[chat.id]?.nickname || chat.displayName || chat.email}
                              {blockedUsers.includes(chat.id) && " (Blocked)"}
                            </span>
                            <Badge variant="outline" className="ml-2">
                              {chat.status === 'online' ? 'Online' : 'Offline'}
                            </Badge>
                          </div>
                        </div>
              </div>
            ))}
          </div>
              </div>
          </ScrollArea>

          {/* Logout Button */}
          <div className="p-4 border-t border-border">
            <Button
              variant="outline"
              className="w-full flex items-center justify-center space-x-2 hover:bg-destructive hover:text-destructive-foreground transition-colors"
              onClick={logout}
            >
              <LogOut size={18} />
              <span>Logout</span>
            </Button>
        </div>
      </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedUser ? (
            <>
              {/* Chat Header - Make it responsive */}
              <div className="p-4 border-b border-border bg-card/30 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {/* Show back button on mobile */}
                  <button
                    className="md:hidden mr-2"
                    onClick={() => setSelectedUser(null)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                  </button>
                  <div className="relative">
                <img
                  src={selectedUser.photoURL || '/default-avatar.png'}
                      alt={selectedUser.displayName || 'User'}
                      className="w-10 h-10 rounded-full border border-border object-cover"
                    />
                    <span
                      className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-card ${
                        selectedUser.status === 'online'
                          ? 'bg-green-500'
                          : 'bg-gray-400'
                      }`}
                    ></span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {getDisplayName(selectedUser.id)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {selectedUser.status === 'online' ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>

                {/* Chat options */}
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    onClick={() => setShowChatOptions(!showChatOptions)}
                  >
                    <MoreVertical size={20} />
                  </Button>

                  <AnimatePresence>
                    {showChatOptions && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute right-4 top-16 bg-card border border-border rounded-lg shadow-lg p-2 z-50"
                      >
                        <div className="space-y-1">
                          <Button
                            variant="ghost"
                            className="w-full justify-start"
                            onClick={() => {
                              setShowUserProfile(true);
                              setShowChatOptions(false);
                            }}
                          >
                            <UserPlus size={16} className="mr-2" />
                            View Profile
                          </Button>
                          <Button
                            variant="ghost"
                            className="w-full justify-start"
                            onClick={() => {
                              setShowEditNickname(true);
                              setShowChatOptions(false);
                            }}
                          >
                            <Edit size={16} className="mr-2" />
                            Edit Nickname
                          </Button>
                          <Button
                            variant="ghost"
                            className="w-full justify-start"
                            onClick={() => {
                              setShowFilesPhotosSheet(true);
                              setShowChatOptions(false);
                            }}
                          >
                            <Image size={16} className="mr-2" />
                            Files & Photos
                          </Button>
                          <Button
                            variant="ghost"
                            className="w-full justify-start text-destructive"
                            onClick={() => {
                              handleBlockUser(selectedUser.id);
                              setShowChatOptions(false);
                            }}
                          >
                            <X size={16} className="mr-2" />
                            {blockedUsers.includes(selectedUser.id) ? 'Unblock User' : 'Block User'}
                          </Button>
                        </div>
                      </motion.div>
                  </AnimatePresence>
                </div>
              </div>
              
              {/* Message container - Make it responsive */}
              <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-4" id="message-container">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                    {selectedUser && blockedUsers.includes(selectedUser.id) ? (
                      <div className="text-center">
                        <p className="text-lg font-medium mb-2">You've blocked this user</p>
                        <p className="text-sm mb-4">You won't receive their messages until you unblock them</p>
                        <Button variant="outline" onClick={() => handleBlockUser(selectedUser.id)}>
                          Unblock User
                        </Button>
                      </div>
                    ) : selectedUser?.blockedUsers?.includes(user?.uid || '') ? (
                      <div className="text-center">
                        <p className="text-lg font-medium mb-2">You've been blocked by this user</p>
                        <p className="text-sm">You can't send messages to this user</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-center">No messages yet.</p>
                        <p className="text-sm">Say hello to start the conversation!</p>
                      </div>
                  </div>
                ) : (
                  <>
              {messages.map((message) => (
                          <motion.div 
                            key={message.id}
                            className="group relative"
                            initial={{ 
                              opacity: newMessageAnimation === message.id ? 0 : 1, 
                              y: newMessageAnimation === message.id ? 20 : 0,
                              scale: newMessageAnimation === message.id ? 0.95 : 1
                            }}
                            animate={{ 
                              opacity: 1, 
                              y: 0, 
                              scale: 1 
                            }}
                            transition={{ 
                              duration: 0.3, 
                              ease: 'easeOut' 
                            }}
                          >
                            <div
                          className={`flex items-start space-x-2 max-w-[90%] sm:max-w-[80%] ${
                                message.senderId === user?.uid
                              ? 'ml-auto flex-row-reverse space-x-reverse'
                              : 'mr-auto'
                          }`}
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarImage 
                              src={message.senderId === user?.uid 
                                ? (userProfile?.photoURL || user?.photoURL || '/default-avatar.png') 
                                : (selectedUser?.photoURL || '/default-avatar.png')} 
                            />
                            <AvatarFallback>
                              {(message.senderId === user?.uid ? user?.displayName : selectedUser?.displayName)?.[0]?.toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className="flex flex-col">
                            <div
                              className={`px-4 py-2 rounded-lg ${
                                  message.senderId === user?.uid
                                  ? 'bg-primary text-primary-foreground rounded-br-none'
                                  : 'bg-accent text-accent-foreground rounded-bl-none'
                              } ${message.deleted ? 'italic opacity-50' : ''}`}
                            >
                              {editingMessage === message.id ? (
                                <div className="flex items-center space-x-2">
                                  <Input
                                    value={editedContent}
                                    onChange={(e) => setEditedContent(e.target.value)}
                                    className="h-8"
                                    autoFocus
                                  />
                                  <Button
                                    size="sm"
                                    onClick={saveEditedMessage}
                                    className="h-8"
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setEditingMessage(null);
                                      setEditedContent('');
                                    }}
                                    className="h-8"
                                  >
                                    Cancel
                                  </Button>
                                    </div>
                              ) : (
                                <>
                                  {message.type === 'image' ? (
                                    <div className="flex flex-col space-y-2">
                                      <img 
                                        src={message.fileURL} 
                                        alt="Shared image" 
                                        className="max-w-full rounded-md"
                                        style={{ maxHeight: '200px', objectFit: 'contain' }}
                                      />
                                  </div>
                                  ) : message.type === 'file' ? (
                                    <div className="flex flex-col space-y-2">
                                      <a 
                                        href={message.fileURL} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center space-x-2 p-2 bg-accent/30 rounded-md hover:bg-accent/50 transition-colors"
                                      >
                                        <Paperclip size={16} />
                                        <div className="flex flex-col">
                                          <span className="text-sm font-medium truncate max-w-[200px]">
                                            {message.fileName || 'File'}
                                          </span>
                                          <span className="text-xs text-muted-foreground">
                                            {message.fileSize ? `${Math.round(message.fileSize / 1024)} KB` : ''}
                    </span>
                  </div>
                                      </a>
                </div>
                                  ) : message.type === 'voice' ? (
                                    <div className="w-full max-w-[140px]">
                                      {message.deleted ? (
                                        <div className="text-xs text-muted-foreground italic">
                                          Voice message was deleted
                                        </div>
                                      ) : message.fileURL ? (
                                        <AudioVisualizer audioUrl={message.fileURL} />
                                      ) : (
                                        <div className="text-xs text-muted-foreground">
                                          Voice message unavailable
                                        </div>
                                    </div>
                                  ) : (
                                    <span>{message.content}</span>
                                  {message.edited && (
                                    <span className="text-xs ml-1 opacity-70">(edited)</span>
                            </div>
                            
                            {/* Message Actions */}
                            <div className="flex items-center space-x-1 mt-1">
                              <span className="text-xs text-muted-foreground">
                                {message.timestamp.toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              {message.senderId === user?.uid && (
                                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => startEditingMessage(message)}
                                  >
                                    <Edit size={12} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-destructive"
                                    onClick={() => deleteMessage(message.id)}
                                  >
                                    <Trash size={12} />
                                  </Button>
                                  </div>
                            </div>

                            {/* Reactions */}
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Object.entries(message.reactions || {}).map(([userId, reaction]) => (
                                <span
                                  key={userId}
                                  className="text-sm bg-accent/30 px-2 py-0.5 rounded-full"
                                >
                                  {reaction}
                                </span>
                              ))}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => setSelectedMessageId(message.id)}
                              >
                                <Smile size={12} />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                        {/* Add typing indicator */}
                        {isTyping[selectedUser?.id || ''] && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="flex items-start space-x-2 max-w-[90%] sm:max-w-[80%]"
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={selectedUser?.photoURL || '/default-avatar.png'} />
                              <AvatarFallback>
                                {selectedUser?.displayName?.[0]?.toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <div className="bg-accent text-accent-foreground rounded-lg rounded-bl-none px-4 py-2">
                                <TypingIndicator />
                              </div>
                            </div>
                          </motion.div>
                        {/* This empty div serves as a marker for scrolling to the bottom */}
                        <div ref={messagesEndRef} style={{ height: '1px', width: '100%' }} />
                </div>

              {/* Message Input - Make it responsive */}
              <div className="p-2 sm:p-4 border-t border-border">
                {selectedUser && (
                  selectedUser.blockedUsers?.includes(user?.uid || '') ? (
                    <div className="p-3 text-center bg-destructive/10 rounded-lg text-destructive">
                      You can't send messages because you've been blocked by this user
                    </div>
                  ) : blockedUsers.includes(selectedUser.id) ? (
                    <div className="p-3 text-center bg-destructive/10 rounded-lg text-destructive">
                      You've blocked this user. Unblock to send messages.
                    </div>
                  ) : (
                    <form onSubmit={handleSendMessage} className="flex space-x-2 sm:space-x-3 items-center bg-background rounded-full shadow-sm border border-border p-1 pl-2">
                      <div className="flex space-x-1">
                        <div className="relative">
                          <Button
                            type="button"
                            onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                            variant="ghost"
                            size="icon"
                            className="rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
                          >
                            <Paperclip size={18} />
                          </Button>
                          
                          <AnimatePresence>
                            {showAttachmentMenu && (
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="absolute bottom-full left-0 mb-2 bg-card border border-border rounded-lg shadow-lg p-3 min-w-[200px] z-10"
                              >
                                <div className="grid grid-cols-1 gap-3">
                                  <FileUploader
                                    icon="image"
                                    buttonLabel="Upload Image"
                                    acceptedFileTypes="image/*"
                                    onUploadSuccess={handleFileUploadSuccess}
                                    onUploadStart={() => setShowAttachmentMenu(false)}
                                    disabled={isUploading}
                                  />
                                  <FileUploader
                                    icon="file"
                                    buttonLabel="Upload File"
                                    onUploadSuccess={handleFileUploadSuccess}
                                    onUploadStart={() => setShowAttachmentMenu(false)}
                                    disabled={isUploading}
                                  />
                                </div>
                              </motion.div>
                          </AnimatePresence>
                        </div>
                        
                        {/* VoiceRecorder component */}
                        <VoiceRecorder onRecordingComplete={handleVoiceMessage} />
                      </div>

                      <div className="relative flex-1">
                        <Input
                          value={newMessage}
                          onChange={(e) => {
                            setNewMessage(e.target.value);
                            handleTyping();
                          }}
                          placeholder="Type a message..."
                          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-full"
                        />
                      </div>

                      <div className="flex space-x-1">
                        <div className="relative">
                          <Button
                            type="button"
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            variant="ghost"
                            size="icon"
                            className="rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
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
                                  theme={theme}
                                />
                              </motion.div>
                          </AnimatePresence>
                        </div>

                        <Button 
                          type="submit" 
                          disabled={!newMessage.trim()}
                          size="icon" 
                          className="rounded-full"
                        >
                          <Send size={18} />
                        </Button>
                      </div>
                    </form>
                  )
            </div>
        ) : selectedGroup ? (
          <GroupMessages 
            groupId={selectedGroup.id}
            currentUser={user as unknown as User}
            groupName={selectedGroup.name}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-4 text-center space-y-4">
            <div className="rounded-full bg-primary/10 p-6">
              <MessageSquare className="h-12 w-12 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">Welcome to Chat App</h2>
            <p className="text-muted-foreground max-w-md">
              Select a chat to start messaging or search for users to start a new conversation.
              You can also create or join group chats from the Groups tab.
            </p>
          </div>
      </div>

      {/* Profile Dialog */}
      {profileDialogOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Your Profile</h2>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setProfileDialogOpen(false)}
              >
                <X size={20} />
              </Button>
            </div>
            
            <div className="mb-6 flex flex-col items-center">
              <div className="relative mb-4">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={userProfile?.photoURL || user?.photoURL || '/default-avatar.png'} />
                  <AvatarFallback>{userProfile?.displayName?.[0]?.toUpperCase() || user?.displayName?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                </Avatar>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="absolute -bottom-2 -right-2 rounded-full h-8 w-8 p-0"
                                      onClick={() => {
                    const uploadElement = document.getElementById('profile-image-upload');
                    if (uploadElement) {
                      uploadElement.click();
                    }
                  }}
                  disabled={isProfilePictureUploading}
                >
                  <Edit size={14} />
                </Button>
                <input 
                  id="profile-image-upload" 
                  type="file" 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleProfilePictureUpload}
                />
              </div>
              {isProfilePictureUploading && (
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                  <span>Uploading profile picture...</span>
                                  </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <FormLabel htmlFor="displayName">Display Name</FormLabel>
                <Input
                  id="displayName"
                  value={editedDisplayName}
                  onChange={(e) => setEditedDisplayName(e.target.value)}
                  placeholder="Your display name"
                  className="mt-1"
                />
              </div>
              
              <div>
                <FormLabel htmlFor="bio">Bio</FormLabel>
                <Input
                  id="bio"
                  value={editedBio}
                  onChange={(e) => setEditedBio(e.target.value)}
                  placeholder="Tell others about yourself"
                  className="mt-1"
                />
              </div>
              
              <div>
                <FormLabel htmlFor="email" className="text-muted-foreground">Email</FormLabel>
                <Input
                  id="email"
                  value={user?.email || ''}
                  disabled
                  className="mt-1 bg-muted/50"
                />
                <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setProfileDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={updateProfile}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>

      {/* User Profile Dialog */}
      {showUserProfile && selectedUser && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">User Profile</h2>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowUserProfile(false)}
              >
                <X size={20} />
              </Button>
            </div>
            
            <div className="flex flex-col items-center mb-6">
              <Avatar className="h-24 w-24 mb-4">
                <AvatarImage src={selectedUser.photoURL || '/default-avatar.png'} />
                <AvatarFallback>{selectedUser.displayName?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
              </Avatar>
              <h3 className="text-xl font-semibold">
                {chatSettings[selectedUser.id]?.nickname ? (
                  <span className="flex items-center">
                    {chatSettings[selectedUser.id].nickname}
                    <Badge variant="outline" className="ml-2 text-xs">Nickname</Badge>
                  </span>
                ) : (
                  selectedUser?.displayName || 'User'
              </h3>
              <p className="text-muted-foreground">{selectedUser?.email || ''}</p>
              {selectedUser?.bio && (
                <div className="mt-4 p-3 bg-accent/30 rounded-lg text-center max-w-xs">
                  <p className="italic">{selectedUser.bio}</p>
                </div>
            </div>
            
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between p-3 bg-card/50 rounded-lg border border-border">
                                  <div className="flex items-center space-x-2">
                  <Badge variant="secondary" className={`h-2 w-2 rounded-full p-0 ${selectedUser.status === 'online' ? 'bg-green-500' : ''}`} />
                  <span>Status</span>
                                    </div>
                <span className="font-medium">{selectedUser.status === 'online' ? 'Online' : 'Offline'}</span>
              </div>
              
              {selectedUser.lastSeen && (
                <div className="flex items-center justify-between p-3 bg-card/50 rounded-lg border border-border">
                  <span>Last seen</span>
                  <span className="font-medium">
                    {selectedUser.lastSeen instanceof Date 
                      ? selectedUser.lastSeen.toLocaleString() 
                      : new Date(selectedUser.lastSeen).toLocaleString()}
                  </span>
                </div>
            </div>
            
            <div className="space-y-2">
              <Button 
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  setShowUserProfile(false);
                  setShowEditNickname(true);
                }}
              >
                <Edit size={16} className="mr-2" />
                Edit Nickname
              </Button>
              
              <Button 
                variant={blockedUsers.includes(selectedUser.id) ? "destructive" : "outline"}
                className="w-full justify-start"
                onClick={() => {
                  handleBlockUser(selectedUser.id);
                }}
              >
                {blockedUsers.includes(selectedUser.id) ? (
                  <>
                    <Check size={16} className="mr-2" />
                    Unblock User
                ) : (
                  <>
                    <X size={16} className="mr-2" />
                    Block User
              </Button>
            </div>
            
            <div className="mt-6 flex justify-end">
              <Button 
                onClick={() => setShowUserProfile(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>

      {/* Add Nickname Dialog */}
      {showEditNickname && selectedUser && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Edit Nickname</h2>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowEditNickname(false)}
              >
                <X size={20} />
              </Button>
            </div>
            
            <div className="flex flex-col items-center mb-6">
              <Avatar className="h-16 w-16 mb-4">
                <AvatarImage src={selectedUser.photoURL || '/default-avatar.png'} />
                <AvatarFallback>{selectedUser.displayName?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
              </Avatar>
              <p className="text-center">
                Set a nickname for <span className="font-semibold">{selectedUser.displayName || selectedUser.email}</span>
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                This nickname will only be visible to you
              </p>
            </div>
            
                                    <div>
              <FormLabel htmlFor="nickname">Nickname</FormLabel>
              <Input
                id="nickname"
                value={editedNickname}
                onChange={(e) => setEditedNickname(e.target.value)}
                placeholder={selectedUser.displayName || 'Enter nickname'}
                className="mt-1"
              />
              <div className="flex items-center mt-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setEditedNickname(selectedUser.displayName || '')}
                >
                  Reset to default
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setEditedNickname('')}
                >
                  Clear
                </Button>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setShowEditNickname(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  handleUpdateNickname();
                  setShowEditNickname(false);
                }}
              >
                Save Nickname
              </Button>
            </div>
          </div>
        </div>
      
      <Toaster richColors position="top-center" />

      {/* Files & Photos Sheet - Make it responsive */}
      {showFilesPhotosSheet && selectedUser && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-lg p-4 sm:p-6 w-full max-w-3xl h-[85vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Shared Content</h2>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowFilesPhotosSheet(false)}
              >
                <X size={20} />
              </Button>
            </div>
            
            <Tabs defaultValue="files" className="w-full flex-1 overflow-hidden" onValueChange={(value) => setSheetTab(value as 'files' | 'photos')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="files">Files</TabsTrigger>
                <TabsTrigger value="photos">Photos</TabsTrigger>
              </TabsList>
              
              <div className="mt-4 flex-1 overflow-hidden">
                <TabsContent value="files" className="h-full data-[state=active]:flex data-[state=active]:flex-col">
                  <div className="text-sm text-muted-foreground mb-4">
                    All documents and files shared in this chat
                  </div>
                  
                  {messages.filter(msg => msg.type === 'file').length === 0 ? (
                    <div className="flex-1 flex items-center justify-center p-6 border border-border rounded-md">
                      <div className="text-center">
                        <Paperclip size={40} className="mx-auto mb-2 text-muted-foreground opacity-20" />
                        <p className="text-muted-foreground">No files shared yet</p>
                      </div>
                    </div>
                  ) : (
                    <ScrollArea className="h-[calc(70vh-7rem)] border border-border rounded-md" type="always">
                      <div className="p-4 space-y-4">
                        {messages
                          .filter(msg => msg.type === 'file')
                          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                          .map(fileMsg => (
                            <div key={fileMsg.id} className="flex items-center p-3 bg-background rounded-md border border-border hover:border-primary transition-colors">
                              <div className="p-2 bg-primary/10 rounded-md mr-3 shrink-0">
                                <Paperclip size={20} className="text-primary" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium truncate">{fileMsg.fileName || 'File'}</p>
                                <div className="flex items-center text-xs text-muted-foreground">
                                  <span>{new Date(fileMsg.timestamp).toLocaleDateString()}</span>
                                  <span className="mx-2">â€¢</span>
                                  <span>{fileMsg.fileSize ? `${Math.round(fileMsg.fileSize / 1024)} KB` : 'Unknown size'}</span>
                                </div>
                              </div>
                              <a 
                                href={fileMsg.fileURL} 
                                download={fileMsg.fileName || 'download'}
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                className="ml-2 shrink-0"
                                      >
                                <Button variant="outline" size="sm">
                                  Download
                                </Button>
                                      </a>
                                        </div>
                          ))}
                                    </div>
                    </ScrollArea>
                </TabsContent>
                
                <TabsContent value="photos" className="h-full data-[state=active]:flex data-[state=active]:flex-col">
                  <div className="text-sm text-muted-foreground mb-4">
                    All images shared in this chat
                  </div>
                  
                  {messages.filter(msg => msg.type === 'image').length === 0 ? (
                    <div className="flex-1 flex items-center justify-center p-6 border border-border rounded-md">
                      <div className="text-center">
                        <Image size={40} className="mx-auto mb-2 text-muted-foreground opacity-20" />
                        <p className="text-muted-foreground">No images shared yet</p>
                      </div>
                    </div>
                  ) : (
                    <ScrollArea className="h-[calc(70vh-7rem)] border border-border rounded-md" type="always">
                      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {messages
                          .filter(msg => msg.type === 'image')
                          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                          .map((imageMsg, index) => (
                            <div 
                              key={imageMsg.id} 
                              className="relative aspect-square rounded-md overflow-hidden border border-border group cursor-pointer"
                            >
                              <img 
                                src={imageMsg.fileURL} 
                                alt="Shared image" 
                                className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                                onClick={() => {
                                  // Save all image messages for carousel navigation
                                  const filteredImages = messages
                                    .filter(msg => msg.type === 'image')
                                    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
                                  setImageMessages(filteredImages);
                                  setCurrentImageIndex(index);
                                  if (imageMsg.fileURL) {
                                    setImagePreviewUrl(imageMsg.fileURL);
                                  }
                                }}
                              />
                              <div 
                                className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center"
                                onClick={() => {
                                  // Same as above for the overlay
                                  const filteredImages = messages
                                    .filter(msg => msg.type === 'image')
                                    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
                                  setImageMessages(filteredImages);
                                  setCurrentImageIndex(index);
                                  if (imageMsg.fileURL) {
                                    setImagePreviewUrl(imageMsg.fileURL);
                                  }
                                }}
                              >
                                <p className="font-medium mb-1">View Image</p>
                                <p className="text-xs">{new Date(imageMsg.timestamp).toLocaleDateString()}</p>
                              </div>
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                </TabsContent>
              </div>
            </Tabs>
                                    </div>
                                  </div>

      {/* Image Preview Modal - Make it responsive */}
      {imagePreviewUrl && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="relative w-full max-w-4xl max-h-[90vh]">
            {/* Close button */}
                                    <Button
              variant="ghost" 
                                      size="icon"
              className="absolute top-2 right-2 text-white bg-black/50 z-10 rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                setImagePreviewUrl(null);
              }}
            >
              <X size={20} />
            </Button>
            
            {/* Previous button */}
            {imageMessages.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 transform -translate-y-1/2 text-white bg-black/50 z-10 rounded-full h-12 w-12"
                onClick={(e) => {
                  e.stopPropagation();
                  const newIndex = (currentImageIndex - 1 + imageMessages.length) % imageMessages.length;
                  setCurrentImageIndex(newIndex);
                  if (imageMessages[newIndex].fileURL) {
                    setImagePreviewUrl(imageMessages[newIndex].fileURL || null);
                  }
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </Button>
            
            {/* Image */}
            <img 
              src={imagePreviewUrl} 
              alt="Preview" 
              className="max-w-full max-h-[85vh] object-contain rounded-md"
              onClick={(e) => e.stopPropagation()}
            />
            
            {/* Next button */}
            {imageMessages.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white bg-black/50 z-10 rounded-full h-12 w-12"
                onClick={(e) => {
                  e.stopPropagation();
                  const newIndex = (currentImageIndex + 1) % imageMessages.length;
                  setCurrentImageIndex(newIndex);
                  if (imageMessages[newIndex].fileURL) {
                    setImagePreviewUrl(imageMessages[newIndex].fileURL || null);
                  }
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Button>
            
            {/* Image counter indicator */}
            {imageMessages.length > 1 && (
              <div className="absolute bottom-14 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-4 py-1 rounded-full text-sm">
                {currentImageIndex + 1} / {imageMessages.length}
              </div>
            
            {/* Download button */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
              <a 
                href={imagePreviewUrl} 
                download="image"
                target="_blank" 
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                <Button>
                  Download Image
                </Button>
              </a>
            </div>
          </div>
        </div>
  );
}
