import { useState, useEffect } from 'react';
import { 
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc, 
  serverTimestamp,
  limit,
  orderBy
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import VideoCall from './VideoCall';

interface IncomingCallProps {
  currentUserId: string;
  displayName: string;
  photoURL?: string;
}

interface CallData {
  id: string;
  callerId: string;
  callerName?: string;
  callerPhotoURL?: string;
  receiverId: string;
  timestamp: any;
  status: string;
  answered: boolean;
  groupId?: string;
}

const IncomingCallAlert = ({ currentUserId, displayName, photoURL }: IncomingCallProps) => {
  const [incomingCall, setIncomingCall] = useState<CallData | null>(null);
  const [isCallAccepted, setIsCallAccepted] = useState(false);
  
  useEffect(() => {
    if (!currentUserId) return;
    
    // Query for incoming calls
    const callsQuery = query(
      collection(db, 'calls'),
      where('receiverId', '==', currentUserId),
      where('status', '==', 'pending'),
      where('answered', '==', false),
      orderBy('timestamp', 'desc'),
      limit(1)
    );
    
    const unsubscribe = onSnapshot(callsQuery, (snapshot) => {
      if (!snapshot.empty) {
        const callData = {
          id: snapshot.docs[0].id,
          ...snapshot.docs[0].data()
        } as CallData;
        
        // Check if it's a recent call (under 60 seconds old)
        const callTime = callData.timestamp?.toDate() || new Date();
        const now = new Date();
        const differenceInSeconds = (now.getTime() - callTime.getTime()) / 1000;
        
        if (differenceInSeconds < 60 && !callData.answered) {
          setIncomingCall(callData);
          // Play sound
          playRingtone();
        }
      } else {
        setIncomingCall(null);
        stopRingtone();
      }
    });
    
    return () => {
      unsubscribe();
      stopRingtone();
    };
  }, [currentUserId]);
  
  // Audio for ringtone
  const audioRef = new Audio('/ringtone.mp3'); // Make sure you have a ringtone file in your public folder
  audioRef.loop = true;
  
  const playRingtone = () => {
    try {
      audioRef.play().catch(error => {
        console.error('Failed to play ringtone:', error);
      });
    } catch (error) {
      console.error('Error playing ringtone:', error);
    }
  };
  
  const stopRingtone = () => {
    try {
      audioRef.pause();
      audioRef.currentTime = 0;
    } catch (error) {
      console.error('Error stopping ringtone:', error);
    }
  };
  
  const acceptCall = async () => {
    if (!incomingCall) return;
    
    stopRingtone();
    setIsCallAccepted(true);
  };
  
  const rejectCall = async () => {
    if (!incomingCall) return;
    
    try {
      await updateDoc(doc(db, 'calls', incomingCall.id), {
        status: 'rejected',
        endTime: serverTimestamp()
      });
      
      stopRingtone();
      setIncomingCall(null);
      toast.info('Call rejected');
    } catch (error) {
      console.error('Error rejecting call:', error);
      toast.error('Failed to reject call');
    }
  };
  
  const handleEndCall = () => {
    setIncomingCall(null);
    setIsCallAccepted(false);
  };
  
  // No incoming call, don't render anything
  if (!incomingCall) return null;
  
  // If call accepted, show full video call UI
  if (isCallAccepted) {
    return (
      <Dialog open={true} onOpenChange={() => setIsCallAccepted(false)}>
        <DialogContent className="sm:max-w-[900px] p-0 h-[80vh] max-h-[600px]">
          <DialogTitle className="sr-only">
            Call with {incomingCall.callerName || 'Unknown'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Video call with {incomingCall.callerName || 'Unknown'}
          </DialogDescription>
          <VideoCall
            currentUserId={currentUserId}
            targetUserId={incomingCall.callerId}
            onEndCall={handleEndCall}
            displayName={displayName}
            photoURL={photoURL}
          />
        </DialogContent>
      </Dialog>
    );
  }
  
  // Show incoming call alert
  return (
    <div className="fixed bottom-4 right-4 z-50 bg-background border shadow-lg rounded-lg p-4 w-[320px] flex flex-col items-center">
      <h3 className="font-semibold text-center mb-2">Incoming Call</h3>
      
      <Avatar className="h-16 w-16 mb-3">
        <AvatarImage src={incomingCall.callerPhotoURL || '/default-avatar.png'} />
        <AvatarFallback>{incomingCall.callerName?.[0] || 'U'}</AvatarFallback>
      </Avatar>
      
      <p className="text-lg font-medium mb-1">{incomingCall.callerName || 'Unknown'}</p>
      <p className="text-sm text-muted-foreground mb-6">is calling you...</p>
      
      <div className="flex gap-6">
        <Button 
          variant="destructive" 
          size="icon"
          className="h-12 w-12 rounded-full"
          onClick={rejectCall}
        >
          <PhoneOff className="h-6 w-6" />
        </Button>
        
        <Button 
          variant="default" 
          size="icon"
          className="h-12 w-12 rounded-full bg-green-500 hover:bg-green-600"
          onClick={acceptCall}
        >
          <Phone className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
};

export default IncomingCallAlert; 