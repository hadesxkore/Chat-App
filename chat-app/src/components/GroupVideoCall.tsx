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
  getDocs,
  addDoc
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';

interface GroupVideoCallProps {
  currentUserId: string;
  groupId: string;
  groupName: string;
  onEndCall: () => void;
  displayName: string;
  photoURL?: string;
}

interface Participant {
  id: string;
  displayName: string;
  photoURL?: string;
  stream?: MediaStream;
  connectionState?: string;
}

interface GroupCallData {
  id: string;
  groupId: string;
  creatorId: string;
  creatorName: string;
  creatorPhotoURL?: string;
  status: 'active' | 'ended';
  participants: string[];
  startTime: any;
  endTime?: any;
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

const GroupVideoCall = ({ 
  currentUserId, 
  groupId, 
  groupName, 
  onEndCall, 
  displayName,
  photoURL 
}: GroupVideoCallProps) => {
  // State for UI control
  const [isJoining, setIsJoining] = useState(true);
  const [isCallActive, setIsCallActive] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [activeParticipant, setActiveParticipant] = useState<string | null>(null);
  
  // Refs for media elements and connections
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<{ [key: string]: RTCPeerConnection }>({});
  
  // Clean up connections and media
  const cleanup = async () => {
    // Stop all tracks in the local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    // Close all peer connections
    Object.values(peerConnectionsRef.current).forEach(pc => {
      pc.close();
    });
    peerConnectionsRef.current = {};
    
    // Clear video elements
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    
    // Reset participants
    setParticipants([]);
    setActiveParticipant(null);
    
    // Update call status if we're the creator
    if (callId) {
      try {
        // Get the call data to check if we're the creator
        const callDoc = await getDoc(doc(db, 'groupCalls', callId));
        if (callDoc.exists()) {
          const callData = callDoc.data();
          
          // Remove ourselves from participants list
          const updatedParticipants = callData.participants.filter(
            (id: string) => id !== currentUserId
          );
          
          if (callData.creatorId === currentUserId || updatedParticipants.length === 0) {
            // If we're the creator or last person, mark call as ended
            await updateDoc(doc(db, 'groupCalls', callId), {
              status: 'ended',
              participants: updatedParticipants,
              endTime: serverTimestamp()
            });
          } else {
            // Just remove ourselves from participants
            await updateDoc(doc(db, 'groupCalls', callId), {
              participants: updatedParticipants
            });
          }
        }
      } catch (error) {
        console.error('Error updating call status:', error);
      }
    }
    
    setIsCallActive(false);
    setCallId(null);
  };
  
  // Initialize a call or join an existing one
  const initializeCall = async () => {
    try {
      // First check if there's an active call for this group
      const groupCallsQuery = query(
        collection(db, 'groupCalls'),
        where('groupId', '==', groupId),
        where('status', '==', 'active')
      );
      
      const querySnapshot = await getDocs(groupCallsQuery);
      
      let callDocId: string;
      
      if (querySnapshot.empty) {
        // No active call, create one
        const callData = {
          groupId,
          creatorId: currentUserId,
          creatorName: displayName,
          creatorPhotoURL: photoURL || '',
          status: 'active',
          participants: [currentUserId],
          startTime: serverTimestamp()
        };
        
        const callDocRef = await addDoc(collection(db, 'groupCalls'), callData);
        callDocId = callDocRef.id;
        
        // Add a system message in group messages
        await addDoc(collection(db, 'groupMessages'), {
          groupId,
          senderId: currentUserId,
          senderName: displayName,
          content: `${displayName} started a video call`,
          timestamp: serverTimestamp(),
          type: 'system'
        });
      } else {
        // Join existing call
        const existingCall = querySnapshot.docs[0];
        callDocId = existingCall.id;
        
        // Add ourselves to participants
        const callData = existingCall.data();
        if (!callData.participants.includes(currentUserId)) {
          await updateDoc(doc(db, 'groupCalls', callDocId), {
            participants: [...callData.participants, currentUserId]
          });
        }
      }
      
      setCallId(callDocId);
      
      // Set up local media
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      // Add ourselves to participants list
      setParticipants(prev => [
        ...prev.filter(p => p.id !== currentUserId),
        {
          id: currentUserId,
          displayName,
          photoURL,
          stream
        }
      ]);
      
      // Set call as active
      setIsCallActive(true);
      setIsJoining(false);
      
      // Listen for other participants
      listenForParticipants(callDocId);
      
    } catch (error) {
      console.error('Error initializing call:', error);
      toast.error('Failed to start call. Please check your camera and microphone permissions.');
      cleanup();
      onEndCall();
    }
  };
  
  // Listen for participants joining and leaving
  const listenForParticipants = (callDocId: string) => {
    const callRef = doc(db, 'groupCalls', callDocId);
    
    const unsubscribe = onSnapshot(callRef, async (snapshot) => {
      if (!snapshot.exists()) {
        // Call document was deleted
        toast.info('The call has ended');
        cleanup();
        onEndCall();
        return;
      }
      
      const callData = snapshot.data() as GroupCallData;
      
      if (callData.status === 'ended') {
        toast.info('The call has ended');
        cleanup();
        onEndCall();
        return;
      }
      
      // Handle participants list changes
      const currentParticipants = new Set(participants.map(p => p.id));
      const newParticipants = new Set(callData.participants);
      
      // Participants who joined
      const newParticipantsArray = Array.from(newParticipants);
      for (const participantId of newParticipantsArray) {
        if (
          participantId !== currentUserId && 
          !currentParticipants.has(participantId)
        ) {
          // New participant joined - establish connection
          await setupPeerConnection(participantId, callDocId);
        }
      }
      
      // Participants who left
      const currentParticipantsArray = Array.from(currentParticipants);
      for (const participantId of currentParticipantsArray) {
        if (
          participantId !== currentUserId && 
          !newParticipants.has(participantId)
        ) {
          // Participant left - clean up their connection
          cleanupParticipantConnection(participantId);
        }
      }
    });
    
    return unsubscribe;
  };
  
  // Set up peer connection with another participant
  const setupPeerConnection = async (participantId: string, callDocId: string) => {
    try {
      // Get participant info
      const userDoc = await getDoc(doc(db, 'users', participantId));
      if (!userDoc.exists()) {
        console.error('User not found:', participantId);
        return;
      }
      
      const userData = userDoc.data();
      
      // Add to participants list without stream yet
      setParticipants(prev => [
        ...prev.filter(p => p.id !== participantId),
        {
          id: participantId,
          displayName: userData.displayName || 'User',
          photoURL: userData.photoURL || '',
          connectionState: 'connecting'
        }
      ]);
      
      // Create connection
      const peerConnection = new RTCPeerConnection(servers);
      peerConnectionsRef.current[participantId] = peerConnection;
      
      // Add local tracks to the connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          if (localStreamRef.current) {
            peerConnection.addTrack(track, localStreamRef.current);
          }
        });
      }
      
      // Handle remote stream
      peerConnection.ontrack = (event) => {
        if (event.streams[0]) {
          console.log('Received remote track from participant:', participantId);
          // Create a new stream to ensure it triggers UI updates
          const newStream = new MediaStream();
          event.streams[0].getTracks().forEach(track => {
            newStream.addTrack(track);
          });
          
          // Update participant with their stream
          setParticipants(prev => {
            const updatedParticipants = prev.map(p => {
              if (p.id === participantId) {
                return {
                  ...p,
                  stream: newStream,
                  connectionState: 'connected'
                };
              }
              return p;
            });
            
            // Set as active participant if none is selected
            if (!activeParticipant || activeParticipant === participantId) {
              setActiveParticipant(participantId);
            }
            
            return updatedParticipants;
          });
        }
      };
      
      // Connection state change
      peerConnection.onconnectionstatechange = () => {
        setParticipants(prev => {
          return prev.map(p => {
            if (p.id === participantId) {
              return {
                ...p,
                connectionState: peerConnection.connectionState
              };
            }
            return p;
          });
        });
      };
      
      // Determine who creates the offer (to avoid both creating offers)
      // The participant with the lexicographically smaller ID creates the offer
      const shouldCreateOffer = currentUserId < participantId;
      
      if (shouldCreateOffer) {
        // Create and send offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        // Store offer in Firestore
        const callConnectionsRef = collection(db, 'groupCalls', callDocId, 'connections');
        await setDoc(doc(callConnectionsRef, `${currentUserId}_${participantId}`), {
          offer: {
            type: offer.type,
            sdp: offer.sdp
          },
          offerer: currentUserId,
          receiver: participantId,
          timestamp: serverTimestamp()
        });
      }
      
      // Listen for ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          // Store candidate in Firestore
          const connectionId = shouldCreateOffer 
            ? `${currentUserId}_${participantId}` 
            : `${participantId}_${currentUserId}`;
          
          const candidatesRef = collection(
            db, 
            'groupCalls', 
            callDocId, 
            'connections', 
            connectionId, 
            'candidates'
          );
          
          setDoc(doc(candidatesRef), {
            ...event.candidate.toJSON(),
            sender: currentUserId,
            timestamp: serverTimestamp()
          });
        }
      };
      
      // Listen for offers and answers
      const connectionId = shouldCreateOffer 
        ? `${currentUserId}_${participantId}` 
        : `${participantId}_${currentUserId}`;
      
      const connectionRef = doc(db, 'groupCalls', callDocId, 'connections', connectionId);
      
      const unsubscribe = onSnapshot(connectionRef, async (snapshot) => {
        if (!snapshot.exists()) return;
        
        const data = snapshot.data();
        
        if (data.offer && !shouldCreateOffer && !peerConnection.currentLocalDescription) {
          // We received an offer, set remote description and create answer
          await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          
          // Store answer
          await updateDoc(connectionRef, {
            answer: {
              type: answer.type,
              sdp: answer.sdp
            },
            timestamp: serverTimestamp()
          });
        } else if (data.answer && shouldCreateOffer && peerConnection.currentLocalDescription) {
          // We received an answer to our offer
          const answerDesc = new RTCSessionDescription(data.answer);
          await peerConnection.setRemoteDescription(answerDesc);
        }
      });
      
      // Listen for ICE candidates
      const candidatesQuery = collection(
        db, 
        'groupCalls', 
        callDocId, 
        'connections', 
        connectionId, 
        'candidates'
      );
      
      const candidatesUnsubscribe = onSnapshot(candidatesQuery, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            if (data.sender !== currentUserId) {
              const candidate = new RTCIceCandidate({
                sdpMLineIndex: data.sdpMLineIndex,
                candidate: data.candidate,
                sdpMid: data.sdpMid,
              });
              
              try {
                await peerConnection.addIceCandidate(candidate);
              } catch (error) {
                console.error('Error adding ICE candidate:', error);
              }
            }
          }
        });
      });
      
      // Store unsubscribe functions
      return () => {
        unsubscribe();
        candidatesUnsubscribe();
      };
      
    } catch (error) {
      console.error('Error setting up peer connection:', error);
      
      // Update participant status to show error
      setParticipants(prev => {
        return prev.map(p => {
          if (p.id === participantId) {
            return {
              ...p,
              connectionState: 'failed'
            };
          }
          return p;
        });
      });
    }
  };
  
  // Clean up connection with a participant who left
  const cleanupParticipantConnection = (participantId: string) => {
    try {
      // Close peer connection
      if (peerConnectionsRef.current[participantId]) {
        peerConnectionsRef.current[participantId].close();
        delete peerConnectionsRef.current[participantId];
      }
      
      // Remove participant from state
      setParticipants(prev => prev.filter(p => p.id !== participantId));
      
      // If this was the active participant, choose another one
      if (activeParticipant === participantId) {
        setActiveParticipant(null);
      }
      
    } catch (error) {
      console.error('Error cleaning up connection:', error);
    }
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
  
  // End call and clean up
  const endCall = async () => {
    await cleanup();
    onEndCall();
  };
  
  // Set a participant as active for main display
  const setParticipantAsActive = (participantId: string) => {
    setActiveParticipant(participantId);
  };
  
  // Initialize call when component mounts
  useEffect(() => {
    initializeCall();
    
    return () => {
      cleanup();
    };
  }, []);
  
  return (
    <div className="flex flex-col h-full bg-background rounded-lg overflow-hidden border shadow-sm">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between bg-background">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold">
            {groupName} - Group Call
          </h2>
          <div className="flex items-center bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full text-xs">
            <span className="relative flex h-2 w-2 mr-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </div>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={endCall}
          className="rounded-full"
        >
          <PhoneOff className="h-4 w-4 mr-1" />
          Leave
        </Button>
      </div>
      
      {/* Video call area */}
      <div className="flex flex-1 relative">
        {/* Main video display */}
        <div className="w-full h-full relative flex items-center justify-center bg-accent/20">
          {isJoining ? (
            <div className="flex flex-col items-center justify-center">
              <Avatar className="h-24 w-24 mb-4">
                <AvatarImage src={photoURL} />
                <AvatarFallback>{displayName && displayName[0] || '?'}</AvatarFallback>
              </Avatar>
              <h3 className="text-xl font-semibold mb-2">Joining call...</h3>
              <div className="mt-4 flex space-x-4">
                <div className="w-3 h-3 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0s' }}></div>
                <div className="w-3 h-3 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-3 h-3 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          ) : (
            <>
              {activeParticipant ? (
                // Show the active participant's video
                <div className="w-full h-full">
                  {participants.find(p => p.id === activeParticipant)?.stream ? (
                    <video 
                      key={`video-${activeParticipant}`}
                      autoPlay 
                      playsInline
                      muted={activeParticipant === currentUserId}
                      className="w-full h-full object-cover"
                      ref={el => {
                        if (el) {
                          // Force reattach the stream to ensure it's displayed
                          const participant = participants.find(p => p.id === activeParticipant);
                          if (participant?.stream && el.srcObject !== participant.stream) {
                            console.log('Setting stream for active participant:', activeParticipant);
                            el.srcObject = participant.stream;
                            // Try to play the video (for autoplay issues)
                            el.play().catch(e => console.error('Error playing video:', e));
                          }
                        }
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Avatar className="h-32 w-32">
                        <AvatarImage src={participants.find(p => p.id === activeParticipant)?.photoURL} />
                        <AvatarFallback>
                          {participants.find(p => p.id === activeParticipant)?.displayName && 
                           participants.find(p => p.id === activeParticipant)?.displayName[0] || '?'}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 text-sm bg-black/50 text-white px-2 py-0.5 rounded">
                    {participants.find(p => p.id === activeParticipant)?.displayName || 'User'}
                    {participants.find(p => p.id === activeParticipant)?.id === currentUserId ? ' (You)' : ''}
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-muted-foreground">
                    No active participant. Select a participant from the sidebar.
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Participants sidebar */}
        <div className="w-1/4 min-w-[200px] max-w-[250px] border-l bg-background">
          <div className="p-3 border-b">
            <h3 className="font-medium flex items-center">
              <Users className="h-4 w-4 mr-2" />
              Participants ({participants.length})
            </h3>
          </div>
          <ScrollArea className="h-[calc(100%-60px)]">
            <div className="p-2 space-y-2">
              {participants.map(participant => (
                <div 
                  key={participant.id}
                  className={`p-2 rounded-lg cursor-pointer transition-colors ${
                    activeParticipant === participant.id 
                      ? 'bg-primary/10 border border-primary/20'
                      : 'hover:bg-accent'
                  }`}
                  onClick={() => {
                    setParticipantAsActive(participant.id);
                    // Force refresh the stream connection when selecting a participant
                    if (participant.stream) {
                      const updatedParticipants = [...participants];
                      const index = updatedParticipants.findIndex(p => p.id === participant.id);
                      if (index >= 0) {
                        // Clone the stream to force a refresh
                        const refreshedStream = participant.stream;
                        updatedParticipants[index] = {
                          ...participant,
                          stream: refreshedStream
                        };
                        setParticipants(updatedParticipants);
                      }
                    }
                  }}
                >
                  <div className="flex items-center space-x-2">
                    <div className="relative">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={participant.photoURL} />
                        <AvatarFallback>{participant.displayName && participant.displayName[0] || '?'}</AvatarFallback>
                      </Avatar>
                      <span className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-background ${
                        participant.connectionState === 'connected' 
                          ? 'bg-green-500' 
                          : participant.connectionState === 'connecting' 
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                      }`}></span>
                    </div>
                    <div>
                      <p className="text-sm font-medium truncate max-w-[120px]">
                        {participant.displayName || 'User'}
                        {participant.id === currentUserId ? ' (You)' : ''}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {participant.connectionState || 'connected'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
      
      {/* Local video (picture-in-picture) */}
      <div className="absolute bottom-20 left-4 w-1/5 max-w-[180px] rounded-lg overflow-hidden border-2 border-background shadow-lg">
        <video
          ref={el => {
            if (el && localStreamRef.current && el.srcObject !== localStreamRef.current) {
              el.srcObject = localStreamRef.current;
              el.play().catch(e => console.error('Error playing local video:', e));
            }
          }}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
        />
        {isVideoOff && (
          <div className="bg-muted w-full h-full flex items-center justify-center aspect-video">
            <Avatar className="h-16 w-16">
              <AvatarImage src={photoURL} />
              <AvatarFallback>{displayName && displayName[0] || '?'}</AvatarFallback>
            </Avatar>
          </div>
        )}
        <div className="absolute bottom-1 left-1 text-xs bg-black/50 text-white px-2 py-0.5 rounded">
          You
        </div>
      </div>
      
      {/* Controls */}
      <div className="p-4 border-t flex items-center justify-center space-x-4 bg-background">
        <Button 
          variant={isMicMuted ? "destructive" : "secondary"} 
          size="icon"
          className="rounded-full h-12 w-12"
          onClick={toggleMicrophone}
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
        >
          {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
        </Button>
      </div>
    </div>
  );
};

export default GroupVideoCall; 