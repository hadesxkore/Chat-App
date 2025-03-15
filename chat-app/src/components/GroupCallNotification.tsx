import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot,
  getDocs,
  doc,
  getDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Phone, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import GroupVideoCall from './GroupVideoCall';

interface GroupCallNotificationProps {
  currentUserId: string;
  userGroups: string[];
  displayName: string;
  photoURL?: string;
}

interface ActiveCall {
  id: string;
  groupId: string;
  groupName: string;
  creatorName: string;
  participantCount: number;
}

const GroupCallNotification = ({ 
  currentUserId, 
  userGroups, 
  displayName, 
  photoURL 
}: GroupCallNotificationProps) => {
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [selectedCall, setSelectedCall] = useState<ActiveCall | null>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  
  // Listen for active group calls in user's groups
  useEffect(() => {
    if (!currentUserId || !userGroups.length) return;
    
    const callsQuery = query(
      collection(db, 'groupCalls'),
      where('groupId', 'in', userGroups),
      where('status', '==', 'active')
    );
    
    const unsubscribe = onSnapshot(callsQuery, async (snapshot) => {
      const calls: ActiveCall[] = [];
      
      for (const doc of snapshot.docs) {
        const callData = doc.data();
        
        // Don't notify about calls the user is already in
        if (callData.participants && callData.participants.includes(currentUserId)) {
          continue;
        }
        
        // Get group name
        const groupRef = doc.ref.parent.parent;
        let groupName = 'Unknown Group';
        
        if (groupRef) {
          const groupDoc = await getDoc(groupRef);
          if (groupDoc.exists()) {
            groupName = groupDoc.data().name;
          }
        }
        
        calls.push({
          id: doc.id,
          groupId: callData.groupId,
          groupName: groupName,
          creatorName: callData.creatorName || 'Someone',
          participantCount: callData.participants?.length || 0
        });
      }
      
      setActiveCalls(calls);
    });
    
    return () => unsubscribe();
  }, [currentUserId, userGroups]);
  
  const joinCall = (call: ActiveCall) => {
    setSelectedCall(call);
    setIsCallActive(true);
  };
  
  const handleEndCall = () => {
    setIsCallActive(false);
    setSelectedCall(null);
  };
  
  // Hide if no active calls
  if (activeCalls.length === 0) return null;
  
  return (
    <>
      <div className="fixed bottom-4 left-4 z-50 max-w-[280px]">
        {activeCalls.map(call => (
          <div 
            key={call.id} 
            className="bg-background border shadow-lg rounded-lg p-3 mb-2 flex flex-col"
          >
            <div className="flex items-center mb-2">
              <div className="bg-primary/10 rounded-full p-2 mr-2">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">{call.groupName}</p>
                <p className="text-xs text-muted-foreground">
                  {call.creatorName} started a call • {call.participantCount} participant(s)
                </p>
              </div>
            </div>
            <Button 
              size="sm" 
              className="bg-green-500 hover:bg-green-600"
              onClick={() => joinCall(call)}
            >
              <Phone className="h-4 w-4 mr-2" />
              Join Call
            </Button>
          </div>
        ))}
      </div>
      
      {/* Join call dialog */}
      {selectedCall && (
        <Dialog open={isCallActive} onOpenChange={setIsCallActive}>
          <DialogContent className="sm:max-w-[85vw] md:max-w-[1000px] p-0 h-[85vh] max-h-[700px]">
            <DialogTitle className="sr-only">
              Join call with {selectedCall.groupName}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Group call started by {selectedCall.creatorName} with {selectedCall.participantCount} participant(s)
            </DialogDescription>
            <GroupVideoCall
              currentUserId={currentUserId}
              groupId={selectedCall.groupId}
              groupName={selectedCall.groupName}
              onEndCall={handleEndCall}
              displayName={displayName}
              photoURL={photoURL}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default GroupCallNotification;

 