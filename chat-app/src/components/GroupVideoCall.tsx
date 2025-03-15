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
const servers: RTCConfiguration = {
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
    },
    // Additional public STUN/TURN servers for better connectivity
    {
      urls: 'stun:stun.stunprotocol.org:3478'
    },
    {
      urls: 'stun:stun.freeswitch.org:3478'
    }
  ],
  iceCandidatePoolSize: 20,
  // Additional configuration to help connections
  iceTransportPolicy: 'all' as RTCIceTransportPolicy
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
          
          // Extremely careful handling of participants array
          let currentParticipants: string[] = [];
          
          // Check if participants array exists
          if (callData && Array.isArray(callData.participants)) {
            currentParticipants = callData.participants;
          } else {
            console.warn('Participants array not found in call data, creating new array');
          }
          
          // Remove ourselves from participants list
          const updatedParticipants = currentParticipants.filter(
            (id: string) => id !== currentUserId
          );
          
          try {
            if (callData && callData.creatorId === currentUserId || updatedParticipants.length === 0) {
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
          } catch (error) {
            console.error('Error updating participants during cleanup:', error);
            // If this fails, the call might still show us as a participant, but it's not critical
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
        
        // Extremely careful handling of participants array
        let currentParticipants: string[] = [];
        
        // Check if callData exists
        if (callData) {
          // Check if participants array exists
          if (Array.isArray(callData.participants)) {
            currentParticipants = callData.participants;
          } else {
            console.warn('Participants array not found in call data, creating new array');
          }
        } else {
          console.warn('No call data found, creating new participants array');
        }
        
        // Only update if we're not already in participants list
        if (!currentParticipants.includes(currentUserId)) {
          // Create a new array with us added - this ensures we have a valid array
          const updatedParticipants = [...currentParticipants, currentUserId];
          
          try {
            // Update the document with the new array
            await updateDoc(doc(db, 'groupCalls', callDocId), {
              participants: updatedParticipants
            });
            
            // Add a system message that user joined the call
            await addDoc(collection(db, 'groupMessages'), {
              groupId,
              senderId: currentUserId,
              senderName: displayName,
              content: `${displayName} joined the call`,
              timestamp: serverTimestamp(),
              type: 'system'
            });
          } catch (error) {
            console.error('Error updating participants:', error);
            // If updating the participants fails, we'll continue anyway
            // The user can still see and hear others, but might not appear in their list
          }
        }
      }
      
      setCallId(callDocId);
      
      // Set up local media with fallbacks for users without camera
      let stream: MediaStream | null = null;
      let hasVideo = false;
      let hasAudio = false;
      let isViewOnly = false;

      try {
        // First try to get both video and audio
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
          });
          hasVideo = true;
          hasAudio = true;
        } catch (error) {
          console.log('Could not access both camera and microphone:', error);
          
          // Try to get just audio
          try {
            stream = await navigator.mediaDevices.getUserMedia({ 
              video: false, 
              audio: true 
            });
            hasAudio = true;
            setIsVideoOff(true); // Update UI to show video is off
          } catch (audioError) {
            console.log('Could not access microphone:', audioError);
            // Create an empty stream for participants without audio/video
            stream = new MediaStream();
            setIsVideoOff(true);
            setIsMicMuted(true);
            isViewOnly = true;
            toast.info('Joined in view-only mode. You cannot broadcast audio or video, but can see others.');
          }
        }
      } catch (error) {
        console.error('Error accessing media devices:', error);
        stream = new MediaStream(); // Fallback to empty stream
        setIsVideoOff(true);
        setIsMicMuted(true);
        isViewOnly = true;
        toast.info('Joined in view-only mode. You cannot broadcast audio or video, but can see others.');
      }
      
      // Always ensure we have a valid stream
      if (!stream) {
        stream = new MediaStream();
        isViewOnly = true;
      }
      
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
          stream,
          connectionState: 'connected'
        }
      ]);
      
      // Set call as active
      setIsCallActive(true);
      setIsJoining(false);
      
      // Listen for other participants
      listenForParticipants(callDocId);
      
    } catch (error) {
      console.error('Error initializing call:', error);
      toast.error('Failed to join call. Please try again.');
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
      const currentParticipantIds = participants.map(p => p.id);
      const currentParticipantsSet = new Set(currentParticipantIds);
      
      // Extremely careful handling of participants array from Firestore
      let firestoreParticipants: string[] = [];
      
      if (callData && Array.isArray(callData.participants)) {
        firestoreParticipants = callData.participants;
      } else {
        console.warn('Participants array from Firestore is undefined or not an array');
      }
      
      const newParticipantsSet = new Set(firestoreParticipants);
      
      // Participants who joined - convert Set to Array before iteration
      const newParticipantsArray = Array.from(newParticipantsSet);
      for (const participantId of newParticipantsArray) {
        if (
          participantId !== currentUserId && 
          !currentParticipantsSet.has(participantId)
        ) {
          // New participant joined - establish connection
          await setupPeerConnection(participantId, callDocId);
        }
      }
      
      // Participants who left
      for (const participantId of currentParticipantIds) {
        if (
          participantId !== currentUserId && 
          !newParticipantsSet.has(participantId)
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
      console.log(`Setting up peer connection with ${participantId}`);
      
      // Get participant info
      const userDoc = await getDoc(doc(db, 'users', participantId));
      if (!userDoc.exists()) {
        console.error('User not found:', participantId);
        return;
      }
      
      const userData = userDoc.data();
      console.log(`Participant data retrieved: ${userData.displayName}`);
      
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
      
      // Create connection with enhanced debugging
      const peerConnection = new RTCPeerConnection(servers);
      console.log(`Created new RTCPeerConnection for ${participantId}`);
      
      // Monitor connection state changes
      peerConnection.onconnectionstatechange = () => {
        console.log(`Connection state changed for ${participantId}: ${peerConnection.connectionState}`);
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
        
        // Attempt recovery if connection fails
        if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
          console.log(`Connection ${peerConnection.connectionState} for ${participantId}, attempting recovery...`);
          
          // When reconnection is needed, we can restart ICE gathering
          try {
            // If we're the offerer, try to create a new offer to restart ICE
            const shouldCreateOffer = currentUserId < participantId;
            if (shouldCreateOffer) {
              console.log(`Attempting to restart ICE for ${participantId}`);
              peerConnection.restartIce();
            }
          } catch (error) {
            console.error('Error during connection recovery:', error);
          }
        }
      };
      
      // Monitor ICE connection state
      peerConnection.oniceconnectionstatechange = () => {
        console.log(`ICE connection state for ${participantId}: ${peerConnection.iceConnectionState}`);
      };
      
      // Track ICE gathering state
      peerConnection.onicegatheringstatechange = () => {
        console.log(`ICE gathering state for ${participantId}: ${peerConnection.iceGatheringState}`);
      };
      
      // Store the connection
      peerConnectionsRef.current[participantId] = peerConnection;
      
      // Add local tracks to the connection
      if (localStreamRef.current) {
        const tracks = localStreamRef.current.getTracks();
        console.log(`Adding ${tracks.length} local tracks to connection for ${participantId}`);
        
        if (tracks && tracks.length > 0) {
          tracks.forEach(track => {
            if (localStreamRef.current) {
              try {
                const sender = peerConnection.addTrack(track, localStreamRef.current);
                console.log(`Added ${track.kind} track to peer connection`);
              } catch (error) {
                console.error(`Error adding ${track.kind} track to peer connection:`, error);
              }
            }
          });
        } else {
          console.warn(`No local tracks to add to peer connection with ${participantId}`);
        }
      } else {
        console.warn(`No local stream to add to peer connection with ${participantId}`);
      }
      
      // Handle remote stream
      peerConnection.ontrack = (event) => {
        console.log(`Received tracks from ${participantId}:`, event.streams);
        
        if (event.streams && event.streams[0]) {
          console.log(`Processing ${event.streams[0].getTracks().length} tracks from participant: ${participantId}`);
          
          // Create a new stream to ensure it triggers UI updates
          const newStream = new MediaStream();
          event.streams[0].getTracks().forEach(track => {
            console.log(`Adding remote ${track.kind} track to local stream`);
            newStream.addTrack(track);
          });
          
          // Update participant with their stream
          setParticipants(prev => {
            const updatedParticipants = prev.map(p => {
              if (p.id === participantId) {
                console.log(`Updated stream for participant ${participantId}`);
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
              console.log(`Setting ${participantId} as active participant`);
              setActiveParticipant(participantId);
            }
            
            return updatedParticipants;
          });
        } else {
          console.warn(`Received track event without streams for ${participantId}`);
        }
      };
      
      // Determine who creates the offer (to avoid both creating offers)
      // The participant with the lexicographically smaller ID creates the offer
      const shouldCreateOffer = currentUserId < participantId;
      console.log(`Should create offer for ${participantId}: ${shouldCreateOffer}`);
      
      if (shouldCreateOffer) {
        try {
          // Create and send offer
          console.log(`Creating offer for ${participantId}`);
          const offer = await peerConnection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
            iceRestart: true // Helps with connection issues
          });
          
          if (!offer || !offer.sdp) {
            console.error(`Failed to create valid offer for ${participantId}`);
            return;
          }
          
          console.log(`Setting local description for ${participantId}`);
          await peerConnection.setLocalDescription(offer);
          
          // Store offer in Firestore
          const callConnectionsRef = collection(db, 'groupCalls', callDocId, 'connections');
          
          // Make sure we don't have undefined values in the offer
          if (offer && offer.type && offer.sdp) {
            console.log(`Storing offer in Firestore for ${participantId}`);
            try {
              await setDoc(doc(callConnectionsRef, `${currentUserId}_${participantId}`), {
                offer: {
                  type: offer.type,
                  sdp: offer.sdp
                },
                offerer: currentUserId,
                receiver: participantId,
                timestamp: serverTimestamp()
              });
              console.log(`Offer stored successfully for ${participantId}`);
            } catch (error) {
              console.error(`Error storing offer in Firestore for ${participantId}:`, error);
            }
          } else {
            console.error(`Invalid offer data for ${participantId}, cannot store in Firestore`);
          }
        } catch (error) {
          console.error(`Error creating offer for ${participantId}:`, error);
        }
      }
      
      // Listen for ICE candidates from local connection
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log(`New ICE candidate for connection with ${participantId}:`, event.candidate.type);
          
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
          
          const candidateData = event.candidate.toJSON();
          // Make sure we don't have undefined values
          if (candidateData) {
            try {
              setDoc(doc(candidatesRef), {
                ...candidateData,
                sender: currentUserId,
                timestamp: serverTimestamp()
              });
              console.log(`ICE candidate stored for ${participantId}`);
            } catch (error) {
              console.error(`Error storing ICE candidate for ${participantId}:`, error);
            }
          }
        } else {
          console.log(`ICE candidate gathering completed for ${participantId}`);
        }
      };
      
      // Listen for offers and answers
      const connectionId = shouldCreateOffer 
        ? `${currentUserId}_${participantId}` 
        : `${participantId}_${currentUserId}`;
      
      const connectionRef = doc(db, 'groupCalls', callDocId, 'connections', connectionId);
      
      const unsubscribe = onSnapshot(connectionRef, async (snapshot) => {
        if (!snapshot.exists()) {
          console.log(`No connection document exists for ${participantId}`);
          return;
        }
        
        const data = snapshot.data();
        if (!data) {
          console.log(`Empty connection data for ${participantId}`);
          return;
        }
        
        try {
          if (data.offer && !shouldCreateOffer && !peerConnection.currentLocalDescription) {
            // We received an offer, set remote description and create answer
            console.log(`Received offer from ${participantId}, creating answer`);
            
            if (!data.offer.sdp) {
              console.error(`Received offer without SDP from ${participantId}`);
              return;
            }
            
            try {
              console.log(`Setting remote description from ${participantId}'s offer`);
              await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
              
              console.log(`Creating answer for ${participantId}`);
              const answer = await peerConnection.createAnswer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
              });
              
              if (!answer || !answer.sdp) {
                console.error(`Failed to create valid answer for ${participantId}`);
                return;
              }
              
              console.log(`Setting local description (answer) for ${participantId}`);
              await peerConnection.setLocalDescription(answer);
              
              // Store answer safely
              if (answer && answer.type && answer.sdp) {
                console.log(`Storing answer in Firestore for ${participantId}`);
                try {
                  await updateDoc(connectionRef, {
                    answer: {
                      type: answer.type,
                      sdp: answer.sdp
                    },
                    timestamp: serverTimestamp()
                  });
                  console.log(`Answer stored successfully for ${participantId}`);
                } catch (error) {
                  console.error(`Error storing answer in Firestore for ${participantId}:`, error);
                }
              } else {
                console.error(`Invalid answer data for ${participantId}, cannot store in Firestore`);
              }
            } catch (error) {
              console.error(`Error handling offer from ${participantId}:`, error);
            }
          } else if (data.answer && shouldCreateOffer && peerConnection.currentLocalDescription) {
            // We received an answer to our offer
            console.log(`Received answer from ${participantId}`);
            
            if (!data.answer.sdp) {
              console.error(`Received answer without SDP from ${participantId}`);
              return;
            }
            
            try {
              console.log(`Setting remote description from ${participantId}'s answer`);
              const answerDesc = new RTCSessionDescription(data.answer);
              await peerConnection.setRemoteDescription(answerDesc);
              console.log(`Remote description set successfully for ${participantId}`);
            } catch (error) {
              console.error(`Error setting remote description from ${participantId}'s answer:`, error);
            }
          }
        } catch (error) {
          console.error(`Error processing signaling message from ${participantId}:`, error);
        }
      });
      
      // Listen for ICE candidates from other participants
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
              console.log(`Received ICE candidate from ${participantId}`);
              try {
                // Ensure we have all required fields before creating the candidate
                if (!data.sdpMLineIndex || !data.candidate || !data.sdpMid) {
                  console.error(`Incomplete ICE candidate data from ${participantId}`);
                  return;
                }
                
                const candidate = new RTCIceCandidate({
                  sdpMLineIndex: data.sdpMLineIndex,
                  candidate: data.candidate,
                  sdpMid: data.sdpMid,
                });
                
                // Only add if we have a remote description set
                if (peerConnection.remoteDescription) {
                  console.log(`Adding ICE candidate from ${participantId}`);
                  await peerConnection.addIceCandidate(candidate);
                } else {
                  console.warn(`Received ICE candidate before remote description from ${participantId}, ignoring for now`);
                  
                  // Store the candidate to add later when we have a remote description
                  setTimeout(async () => {
                    if (peerConnection.remoteDescription) {
                      console.log(`Now adding previously received ICE candidate from ${participantId}`);
                      try {
                        await peerConnection.addIceCandidate(candidate);
                      } catch (error) {
                        console.error(`Error adding delayed ICE candidate from ${participantId}:`, error);
                      }
                    }
                  }, 2000); // Try again after 2 seconds
                }
              } catch (error) {
                console.error(`Error processing ICE candidate from ${participantId}:`, error);
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
  const toggleMicrophone = async () => {
    if (!localStreamRef.current) return;
    
    if (isMicMuted) {
      // Try to enable audio if there are no audio tracks
      if (localStreamRef.current.getAudioTracks().length === 0) {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const audioTrack = audioStream.getAudioTracks()[0];
          
          // Add the new audio track to our existing stream
          localStreamRef.current.addTrack(audioTrack);
          
          // Update all peer connections with the new track
          Object.values(peerConnectionsRef.current).forEach(pc => {
            pc.addTrack(audioTrack, localStreamRef.current!);
          });
          
          setIsMicMuted(false);
        } catch (error) {
          console.error('Could not enable audio:', error);
          toast.error('Could not enable microphone. Please check your microphone permissions.');
          return;
        }
      } else {
        // Just unmute existing tracks
        localStreamRef.current.getAudioTracks().forEach(track => {
          track.enabled = true;
        });
        setIsMicMuted(false);
      }
    } else {
      // Mute audio
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = false;
      });
      setIsMicMuted(true);
    }
    
    // Update our participant in the list
    setParticipants(prevParticipants => {
      const updatedParticipants = [...prevParticipants];
      const currentUserIndex = updatedParticipants.findIndex(p => p.id === currentUserId);
      if (currentUserIndex >= 0 && localStreamRef.current) {
        updatedParticipants[currentUserIndex] = {
          ...updatedParticipants[currentUserIndex],
          stream: localStreamRef.current
        };
      }
      return updatedParticipants;
    });
  };
  
  // Toggle video on/off
  const toggleVideo = async () => {
    if (!localStreamRef.current) return;
    
    if (isVideoOff) {
      // Try to enable video
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = videoStream.getVideoTracks()[0];
        
        // Add the new video track to our existing stream
        localStreamRef.current.addTrack(videoTrack);
        
        // Update all peer connections with the new track
        Object.values(peerConnectionsRef.current).forEach(pc => {
          const senders = pc.getSenders();
          const videoSender = senders.find(sender => 
            sender.track && sender.track.kind === 'video'
          );
          
          if (videoSender) {
            videoSender.replaceTrack(videoTrack);
          } else {
            pc.addTrack(videoTrack, localStreamRef.current!);
          }
        });
        
        setIsVideoOff(false);
      } catch (error) {
        console.error('Could not enable video:', error);
        toast.error('Could not enable video. Please check your camera permissions.');
      }
    } else {
      // Disable video
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = false;
        track.stop();
        localStreamRef.current!.removeTrack(track);
      });
      
      // Update peer connections
      Object.values(peerConnectionsRef.current).forEach(pc => {
        const senders = pc.getSenders();
        const videoSender = senders.find(sender => 
          sender.track && sender.track.kind === 'video'
        );
        
        if (videoSender) {
          pc.removeTrack(videoSender);
        }
      });
      
      setIsVideoOff(true);
    }
    
    // Update our participant in the list
    setParticipants(prevParticipants => {
      const updatedParticipants = [...prevParticipants];
      const currentUserIndex = updatedParticipants.findIndex(p => p.id === currentUserId);
      if (currentUserIndex >= 0 && localStreamRef.current) {
        updatedParticipants[currentUserIndex] = {
          ...updatedParticipants[currentUserIndex],
          stream: localStreamRef.current
        };
      }
      return updatedParticipants;
    });
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