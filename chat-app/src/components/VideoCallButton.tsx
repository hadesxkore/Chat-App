import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Phone, Video } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import VideoCall from './VideoCall';

interface VideoCallButtonProps {
  currentUserId: string;
  targetUserId: string;
  targetUserName: string;
  targetUserPhoto?: string;
  currentUserName: string;
  currentUserPhoto?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  isGroup?: boolean;
  groupId?: string;
  groupName?: string;
}

const VideoCallButton = ({
  currentUserId,
  targetUserId,
  targetUserName,
  targetUserPhoto,
  currentUserName,
  currentUserPhoto,
  variant = 'ghost',
  size = 'icon',
  isGroup = false,
  groupId,
  groupName
}: VideoCallButtonProps) => {
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
              Video Call
            </>
          )}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[900px] p-0 h-[80vh] max-h-[600px]">
        <DialogTitle className="sr-only">
          Video call with {targetUserName}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {isGroup ? `Group video call in ${groupName}` : `One-on-one video call with ${targetUserName}`}
        </DialogDescription>
        <VideoCall
          currentUserId={currentUserId}
          targetUserId={targetUserId}
          groupId={isGroup ? groupId : undefined}
          onEndCall={handleEndCall}
          displayName={currentUserName}
          photoURL={currentUserPhoto}
        />
      </DialogContent>
    </Dialog>
  );
};

export default VideoCallButton; 