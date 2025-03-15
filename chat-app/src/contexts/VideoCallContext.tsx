"use client";

import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot,
  orderBy,
  limit,
  getDocs
} from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import IncomingCallAlert from '@/components/IncomingCallAlert';
import GroupCallNotification from '@/components/GroupCallNotification';

interface VideoCallContextType {
  isCallActive: boolean;
  setIsCallActive: (active: boolean) => void;
  currentCallId: string | null;
  setCurrentCallId: (callId: string | null) => void;
}

const VideoCallContext = createContext<VideoCallContextType | undefined>(undefined);

export function useVideoCall() {
  const context = useContext(VideoCallContext);
  if (context === undefined) {
    throw new Error('useVideoCall must be used within a VideoCallProvider');
  }
  return context;
}

export function VideoCallProvider({ children }: { children: ReactNode }) {
  const [isCallActive, setIsCallActive] = useState(false);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const { user } = useAuth();
  const [userGroups, setUserGroups] = useState<string[]>([]);
  
  // Fetch user's groups on mount
  useEffect(() => {
    if (!user) return;
    
    const fetchUserGroups = async () => {
      try {
        const groupsQuery = query(
          collection(db, 'groups'),
          where('members', 'array-contains', user.uid)
        );
        
        const querySnapshot = await getDocs(groupsQuery);
        const groupIds = querySnapshot.docs.map(doc => doc.id);
        setUserGroups(groupIds);
      } catch (error) {
        console.error('Error fetching user groups:', error);
      }
    };
    
    fetchUserGroups();
  }, [user]);

  return (
    <VideoCallContext.Provider 
      value={{ 
        isCallActive, 
        setIsCallActive, 
        currentCallId, 
        setCurrentCallId 
      }}
    >
      {children}
      
      {/* IncomingCallAlert is always available for the whole app */}
      {user && (
        <>
          <IncomingCallAlert
            currentUserId={user.uid}
            displayName={user.displayName || 'User'}
            photoURL={user.photoURL || undefined}
          />
          
          <GroupCallNotification
            currentUserId={user.uid}
            userGroups={userGroups}
            displayName={user.displayName || 'User'}
            photoURL={user.photoURL || undefined}
          />
        </>
      )}
    </VideoCallContext.Provider>
  );
}

export default VideoCallProvider; 