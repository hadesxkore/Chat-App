import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Video, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import GroupVideoCall from './GroupVideoCall';

interface GroupVideoCallButtonProps {
  currentUserId: string;
  groupId: string;
  groupName: string;
  displayName: string;
  photoURL?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const GroupVideoCallButton = ({
  currentUserId,
  groupId,
  groupName,
  displayName,
  photoURL,
  variant = 'ghost',
  size = 'icon',
}: GroupVideoCallButtonProps) => {
  const [isCallActive, setIsCallActive] = useState(false);
  
  const handleStartCall = () => {
    setIsCallActive(true);
  };
  
  const handleEndCall = () => {
    setIsCallActive(false);
  };
  
  return (
    <Dialog open={isCallActive} onOpenChange={setIsCallActive}>
      <DialogTrigger asChild>
        <Button 
          variant={variant} 
          size={size}
          onClick={handleStartCall}
          className={size === 'icon' ? 'rounded-full' : ''}
        >
          {size === 'icon' ? (
            <Video className="h-5 w-5" />
          ) : (
            <>
              <Video className="h-4 w-4 mr-2" />
              <Users className="h-4 w-4 mr-2" />
              Group Call
            </>
          )}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[85vw] md:max-w-[1000px] p-0 h-[85vh] max-h-[700px]">
        <DialogTitle className="sr-only">
          Group call in {groupName}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Video call with group members in {groupName}
        </DialogDescription>
        <GroupVideoCall
          currentUserId={currentUserId}
          groupId={groupId}
          groupName={groupName}
          onEndCall={handleEndCall}
          displayName={displayName}
          photoURL={photoURL}
        />
      </DialogContent>
    </Dialog>
  );
};

export default GroupVideoCallButton; 