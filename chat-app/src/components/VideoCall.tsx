import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  onSnapshot, 
  deleteDoc,
  serverTimestamp,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface VideoCallProps {
  currentUserId: string;
  targetUserId?: string;
  groupId?: string;
  onEndCall: () => void;
  displayName: string;
  photoURL?: string;
}

// Configuration for WebRTC with improved connectivity options
const servers = {
  iceServers: [
    {
      urls: [
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302',
      ],
    },
    // Free TURN servers - these help when users are behind difficult NATs/firewalls
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    }
  ],
  iceCandidatePoolSize: 20,
};

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
  offerSDP?: RTCSessionDescriptionInit;
}

const VideoCall = ({ 
  currentUserId, 
  targetUserId, 
  groupId, 
  onEndCall, 
  displayName,
  photoURL 
}: VideoCallProps) => {
  // State for UI control
  const [isCalling, setIsCalling] = useState(false);
  const [isCallConnected, setIsCallConnected] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [callDocId, setCallDocId] = useState<string | null>(null);
  const [remoteUserName, setRemoteUserName] = useState<string>('');
  const [remoteUserPhoto, setRemoteUserPhoto] = useState<string>('');
  const [localUserName, setLocalUserName] = useState<string>(displayName || 'You');
  
  // Refs for media elements and WebRTC connections
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  
  // Clean up function to end call and clear resources
  const cleanup = async () => {
    // Stop all tracks in the local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    // Clear video elements
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    
    // Delete call document if it exists
    if (callDocId) {
      try {
        await deleteDoc(doc(db, 'calls', callDocId));
        console.log('Call document deleted');
      } catch (error) {
        console.error('Error deleting call document:', error);
      }
    }
    
    // Reset state
    setIsCalling(false);
    setIsCallConnected(false);
    setCallDocId(null);
    setIncomingCall(null);
  };
  
  // Function to start a call
  const startCall = async () => {
    try {
      setIsCalling(true);
      
      // Get local media stream (audio and video)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      // Save reference to stream and display in local video element
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      // Create a new peer connection
      const peerConnection = new RTCPeerConnection(servers);
      peerConnectionRef.current = peerConnection;
      
      // Add local tracks to the peer connection
      stream.getTracks().forEach(track => {
        if (peerConnectionRef.current) {
          peerConnectionRef.current.addTrack(track, stream);
        }
      });
      
      // Handle incoming tracks from remote peer
      peerConnection.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };
      
      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && callDocId) {
          const candidatesCollection = collection(db, 'calls', callDocId, 'offerCandidates');
          setDoc(doc(candidatesCollection), event.candidate.toJSON());
        }
      };
      
      // Create offer
      const offerDescription = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offerDescription);
      
      // Create call document in Firestore
      const callData = {
        callerId: currentUserId,
        callerName: displayName,
        callerPhotoURL: photoURL || '',
        receiverId: targetUserId,
        groupId: groupId || null,
        offerSDP: offerDescription,
        status: 'pending',
        timestamp: serverTimestamp(),
        answered: false
      };
      
      const callDocRef = doc(collection(db, 'calls'));
      await setDoc(callDocRef, callData);
      const newCallDocId = callDocRef.id;
      setCallDocId(newCallDocId);
      
      // Listen for answer
      const callRef = doc(db, 'calls', newCallDocId);
      const unsubscribe = onSnapshot(callRef, async (snapshot) => {
        const data = snapshot.data();
        
        if (data?.answered && !peerConnection.currentRemoteDescription) {
          // Set remote user info
          setRemoteUserName(data.receiverName || 'User');
          setRemoteUserPhoto(data.receiverPhotoURL || '');
          
          // Set remote description
          const answerDescription = new RTCSessionDescription(data.answerSDP);
          await peerConnection.setRemoteDescription(answerDescription);
          
          // Call is now connected
          setIsCallConnected(true);
          setIsCalling(false);
          
          // Get answer candidates
          const answerCandidatesCollection = collection(db, 'calls', newCallDocId, 'answerCandidates');
          const candidatesSnapshot = await getDocs(answerCandidatesCollection);
          
          candidatesSnapshot.forEach(async (candidateDoc) => {
            if (candidateDoc.exists()) {
              const candidate = new RTCIceCandidate(candidateDoc.data());
              await peerConnection.addIceCandidate(candidate);
            }
          });
        }
        
        // Check if call was rejected or ended by the other user
        if (data?.status === 'rejected' || data?.status === 'ended') {
          toast.info('Call was ' + data.status);
          cleanup();
          onEndCall();
        }
      });
      
      // Clean up listener on component unmount
      return () => {
        unsubscribe();
      };
      
    } catch (error) {
      console.error('Error starting call:', error);
      toast.error('Failed to start call. Please check your camera and microphone permissions.');
      cleanup();
      onEndCall();
    }
  };
  
  // Function to answer an incoming call
  const answerCall = async () => {
    try {
      if (!incomingCall) return;
      
      // Get local media stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      // Create peer connection
      const peerConnection = new RTCPeerConnection(servers);
      peerConnectionRef.current = peerConnection;
      
      // Add local tracks
      stream.getTracks().forEach(track => {
        if (peerConnectionRef.current) {
          peerConnectionRef.current.addTrack(track, stream);
        }
      });
      
      // Handle remote tracks
      peerConnection.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };
      
      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && incomingCall.id) {
          const candidatesCollection = collection(db, 'calls', incomingCall.id, 'answerCandidates');
          setDoc(doc(candidatesCollection), event.candidate.toJSON());
        }
      };
      
      // Set remote description from offer
      const offerDescription = new RTCSessionDescription(incomingCall.offerSDP);
      await peerConnection.setRemoteDescription(offerDescription);
      
      // Create answer
      const answerDescription = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answerDescription);
      
      // Update call document with answer
      await updateDoc(doc(db, 'calls', incomingCall.id), {
        answerSDP: answerDescription,
        answered: true,
        receiverName: displayName,
        receiverPhotoURL: photoURL || '',
        status: 'active'
      });
      
      setCallDocId(incomingCall.id);
      
      // Get offer candidates
      const offerCandidatesCollection = collection(db, 'calls', incomingCall.id, 'offerCandidates');
      const candidatesSnapshot = await getDocs(offerCandidatesCollection);
      
      candidatesSnapshot.forEach(async (candidateDoc) => {
        if (candidateDoc.exists()) {
          const candidate = new RTCIceCandidate(candidateDoc.data());
          await peerConnection.addIceCandidate(candidate);
        }
      });
      
      // Set call as connected
      setIsCallConnected(true);
      setIncomingCall(null);
      
      // Set remote user info
      setRemoteUserName(incomingCall.callerName || 'User');
      setRemoteUserPhoto(incomingCall.callerPhotoURL || '');
      
    } catch (error) {
      console.error('Error answering call:', error);
      toast.error('Failed to answer call');
      rejectCall();
    }
  };
  
  // Function to reject an incoming call
  const rejectCall = async () => {
    if (!incomingCall) return;
    
    try {
      await updateDoc(doc(db, 'calls', incomingCall.id), {
        status: 'rejected'
      });
      
      setIncomingCall(null);
    } catch (error) {
      console.error('Error rejecting call:', error);
    }
  };
  
  // End an active call
  const endCall = async () => {
    if (callDocId) {
      try {
        await updateDoc(doc(db, 'calls', callDocId), {
          status: 'ended'
        });
      } catch (error) {
        console.error('Error ending call:', error);
      }
    }
    
    cleanup();
    onEndCall();
  };
  
  // Toggle microphone
  const toggleMicrophone = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMicMuted(!isMicMuted);
    }
  };
  
  // Toggle video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };
  
  // Listen for incoming calls when the component mounts
  useEffect(() => {
    if (!currentUserId) return;
    
    const callsQuery = query(
      collection(db, 'calls'),
      where('receiverId', '==', currentUserId),
      where('status', '==', 'pending')
    );
    
    const unsubscribe = onSnapshot(callsQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        // Only process new calls
        if (change.type === 'added') {
          const callData = {
            id: change.doc.id,
            ...change.doc.data()
          } as CallData;
          
          // Check if the call is recent (within the last minute)
          const callTime = callData.timestamp?.toDate() || new Date();
          const now = new Date();
          const differenceInSeconds = (now.getTime() - callTime.getTime()) / 1000;
          
          // Only notify about calls that are less than 60 seconds old
          if (differenceInSeconds < 60) {
            setIncomingCall(callData);
            setRemoteUserName(callData.callerName || 'User');
            setRemoteUserPhoto(callData.callerPhotoURL || '');
          }
        }
      });
    });
    
    return () => {
      unsubscribe();
    };
  }, [currentUserId]);
  
  // Clean up on component unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);
  
  // Start the call automatically if targetUserId is provided
  useEffect(() => {
    if (targetUserId && !isCalling && !isCallConnected && !incomingCall) {
      startCall();
    }
  }, [targetUserId]);
  
  return (
    <div className="flex flex-col h-full bg-background rounded-lg overflow-hidden border shadow-sm">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between bg-background">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold">
            {isCalling ? 'Calling...' : isCallConnected ? 'Connected' : 'Video Call'}
          </h2>
          {isCallConnected && (
            <div className="flex items-center bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full text-xs">
              <span className="relative flex h-2 w-2 mr-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Live
            </div>
          )}
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={endCall}
          className="rounded-full"
        >
          <PhoneOff className="h-4 w-4 mr-1" />
          End
        </Button>
      </div>
      
      {/* Video call area */}
      <div className="flex-1 relative bg-accent/20 flex items-center justify-center">
        {/* Remote video (full size) */}
        {isCallConnected && (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        )}
        
        {/* Calling state */}
        {isCalling && !isCallConnected && (
          <div className="flex flex-col items-center justify-center">
            <Avatar className="h-24 w-24 mb-4">
              <AvatarImage src={targetUserId ? remoteUserPhoto : photoURL} />
              <AvatarFallback>{targetUserId ? (remoteUserName[0] || '?') : (displayName[0] || '?')}</AvatarFallback>
            </Avatar>
            <h3 className="text-xl font-semibold mb-2">{targetUserId ? remoteUserName : 'Starting call...'}</h3>
            <p className="text-muted-foreground">Calling...</p>
            <div className="mt-4 flex space-x-4">
              <div className="w-3 h-3 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0s' }}></div>
              <div className="w-3 h-3 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-3 h-3 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </div>
        )}
        
        {/* Incoming call UI */}
        {incomingCall && !isCallConnected && (
          <div className="flex flex-col items-center justify-center">
            <Avatar className="h-24 w-24 mb-4">
              <AvatarImage src={remoteUserPhoto} />
              <AvatarFallback>{remoteUserName[0] || '?'}</AvatarFallback>
            </Avatar>
            <h3 className="text-xl font-semibold mb-2">{remoteUserName}</h3>
            <p className="text-muted-foreground">Incoming call...</p>
            <div className="mt-6 flex space-x-4">
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
                onClick={answerCall}
              >
                <Phone className="h-6 w-6" />
              </Button>
            </div>
          </div>
        )}
        
        {/* Local video (picture-in-picture) */}
        <div className="absolute bottom-4 right-4 w-1/4 max-w-[180px] rounded-lg overflow-hidden border-2 border-background shadow-lg">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
          />
          {isVideoOff && (
            <div className="bg-muted w-full h-full flex items-center justify-center aspect-video">
              <Avatar className="h-16 w-16">
                <AvatarImage src={photoURL} />
                <AvatarFallback>{localUserName[0] || '?'}</AvatarFallback>
              </Avatar>
            </div>
          )}
          <div className="absolute bottom-1 left-1 text-xs bg-black/50 text-white px-2 py-0.5 rounded">
            {localUserName}
          </div>
        </div>
      </div>
      
      {/* Controls */}
      <div className="p-4 border-t flex items-center justify-center space-x-4 bg-background">
        <Button 
          variant={isMicMuted ? "destructive" : "secondary"} 
          size="icon"
          className="rounded-full h-12 w-12"
          onClick={toggleMicrophone}
          disabled={!isCallConnected && !isCalling}
        >
          {isMicMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
        
        <Button
          variant="destructive"
          size="icon"
          className="rounded-full h-12 w-12"
          onClick={endCall}
        >
          <PhoneOff className="h-5 w-5" />
        </Button>
        
        <Button 
          variant={isVideoOff ? "destructive" : "secondary"} 
          size="icon"
          className="rounded-full h-12 w-12"
          onClick={toggleVideo}
          disabled={!isCallConnected && !isCalling}
        >
          {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
        </Button>
      </div>
    </div>
  );
};

export default VideoCall; 