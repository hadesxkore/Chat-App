import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, getDoc, addDoc, serverTimestamp, arrayUnion, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
// Remove the User import since we'll define it locally
// import { User } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Plus, X, Check, Users } from 'lucide-react';
import { toast } from 'sonner';

// Define User interface locally based on what's in page.tsx
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

interface GroupChatProps {
  currentUser: User;
  onSelect: (groupId: string, name: string) => void;
  activeGroupId?: string;
}

interface GroupChat {
  id: string;
  name: string;
  createdBy: string;
  createdAt: any;
  members: string[];
  photoURL?: string;
  lastMessage?: string;
  lastMessageTime?: any;
  lastMessageSender?: string;
  unreadCount?: number;
}

// Interface for group messages to track the last read message
interface GroupReadStatus {
  groupId: string;
  userId: string;
  lastReadTimestamp: any;
}

export const GroupChatComponent = ({ currentUser, onSelect, activeGroupId }: GroupChatProps) => {
  const [groups, setGroups] = useState<GroupChat[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [readStatuses, setReadStatuses] = useState<{[groupId: string]: Date}>({});
  const [groupSenders, setGroupSenders] = useState<{[senderId: string]: string}>({});
  const [activeGroup, setActiveGroup] = useState<string | undefined>(activeGroupId);

  useEffect(() => {
    if (currentUser?.id) {
      console.log("GroupChat component initialized for user:", currentUser.id);
      
      // First load read statuses, then load groups
      loadReadStatuses()
        .then(statuses => {
          console.log("Read statuses loaded, now loading groups");
          loadUserGroups();
          
          // Set up an initial unread count check
          setTimeout(() => {
            refreshUnreadCounts();
          }, 1000);
        });
        
      // Set up message listeners
      setupMessageListener();
      
      // Set up an interval to refresh unread counts every 30 seconds
      const refreshInterval = setInterval(() => {
        refreshUnreadCounts();
      }, 30000);
      
      return () => {
        console.log("Cleaning up GroupChat listeners");
        // Cleanup any message listeners
        if (messageListenerUnsubscribe) {
          messageListenerUnsubscribe();
        }
        clearInterval(refreshInterval);
      };
    }
  }, [currentUser]);
  
  // Message listener to update unread counts in real-time
  let messageListenerUnsubscribe: (() => void) | undefined;
  
  const setupMessageListener = () => {
    if (!currentUser?.id) return;
    
    try {
      // Get all groups the user is a member of - without orderBy to avoid index issues
      const groupsRef = collection(db, 'groups');
      const groupsQuery = query(
        groupsRef, 
        where('members', 'array-contains', currentUser.id)
      );
      
      // Listen for changes to any of the user's groups
      const groupsUnsubscribe = onSnapshot(groupsQuery, (groupsSnapshot) => {
        groupsSnapshot.docChanges().forEach(async (change) => {
          if (change.type === 'modified' || change.type === 'added') {
            const updatedGroup = { id: change.doc.id, ...change.doc.data() } as GroupChat;
            console.log('Group updated or added:', updatedGroup.name);
            
            // Update groups list with the new data
            setGroups(prevGroups => {
              const newGroups = [...prevGroups];
              const index = newGroups.findIndex(g => g.id === updatedGroup.id);
              if (index !== -1) {
                // Preserve the current unread count until we recalculate it
                const currentUnread = newGroups[index].unreadCount || 0;
                updatedGroup.unreadCount = currentUnread;
                newGroups[index] = updatedGroup;
              } else {
                newGroups.push(updatedGroup);
              }
              
              // Sort by lastMessageTime client-side
              return newGroups.sort((a, b) => {
                if (!a.lastMessageTime) return 1;
                if (!b.lastMessageTime) return -1;
                
                const timeA = a.lastMessageTime?.toMillis ? a.lastMessageTime.toMillis() : 0;
                const timeB = b.lastMessageTime?.toMillis ? b.lastMessageTime.toMillis() : 0;
                
                return timeB - timeA;
              });
            });
            
            // Recalculate unread counts for this group
            updateUnreadCount(updatedGroup).then(updatedGroupWithCount => {
              setGroups(prevGroups => {
                return prevGroups.map(g => 
                  g.id === updatedGroupWithCount.id ? updatedGroupWithCount : g
                ).sort((a, b) => {
                  if (!a.lastMessageTime) return 1;
                  if (!b.lastMessageTime) return -1;
                  
                  const timeA = a.lastMessageTime?.toMillis ? a.lastMessageTime.toMillis() : 0;
                  const timeB = b.lastMessageTime?.toMillis ? b.lastMessageTime.toMillis() : 0;
                  
                  return timeB - timeA;
                });
              });
            });
          }
        });
      }, error => {
        console.error('Error in groups listener:', error);
      });
      
      // Also listen for new messages - but simplified to avoid index issues
      const messagesRef = collection(db, 'groupMessages');
      // Only orderBy timestamp to avoid needing complex indexes
      const messagesQuery = query(
        messagesRef,
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      
      const messagesUnsubscribe = onSnapshot(messagesQuery, (messagesSnapshot) => {
        const updatedGroupIds = new Set<string>();
        
        messagesSnapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            const data = change.doc.data();
            if (data.groupId) {
              console.log(`New message in group ${data.groupId}:`, data.content ? data.content.substring(0, 20) + '...' : '[No content]');
              updatedGroupIds.add(data.groupId);
            }
          }
        });
        
        if (updatedGroupIds.size > 0) {
          console.log('New messages detected in groups:', Array.from(updatedGroupIds));
          
          // Immediately refresh read statuses to ensure we have the latest
          loadReadStatuses().then(() => {
            // Update unread counts for affected groups
            setGroups(prevGroups => {
              const newGroups = [...prevGroups];
              
              // Process each affected group
              Array.from(updatedGroupIds).forEach(groupId => {
                const index = newGroups.findIndex(g => g.id === groupId);
                if (index !== -1) {
                  // Schedule an update for this group's unread count
                  updateUnreadCount(newGroups[index]).then(updatedGroup => {
                    setGroups(prev => prev.map(g => 
                      g.id === updatedGroup.id ? updatedGroup : g
                    ));
                  });
                }
              });
              
              return newGroups;
            });
          });
        }
      }, error => {
        console.error('Error in messages listener:', error);
      });
      
      // Combine both unsubscribe functions
      messageListenerUnsubscribe = () => {
        groupsUnsubscribe();
        messagesUnsubscribe();
      };
    } catch (error) {
      console.error('Error setting up message listener:', error);
    }
  };

  // Load read status for each group the user is in
  const loadReadStatuses = async () => {
    if (!currentUser?.id) return;
    
    try {
      console.log("Loading read statuses for user:", currentUser.id);
      
      const readStatusRef = collection(db, 'groupReadStatus');
      const q = query(readStatusRef, where('userId', '==', currentUser.id));
      const querySnapshot = await getDocs(q);
      
      const statuses: {[groupId: string]: Date} = {};
      
      if (querySnapshot.empty) {
        console.log("No read statuses found for user");
      } else {
        querySnapshot.forEach((doc) => {
          const data = doc.data() as GroupReadStatus;
          if (data.lastReadTimestamp) {
            statuses[data.groupId] = data.lastReadTimestamp.toDate();
            console.log(`Group ${data.groupId} last read at: ${statuses[data.groupId]}`);
          }
        });
        console.log(`Loaded ${Object.keys(statuses).length} read statuses`);
      }
      
      setReadStatuses(statuses);
      
      // After loading read statuses, let's immediately update unread counts for all groups
      setGroups(prevGroups => {
        const groupsToUpdate = [...prevGroups];
        for (const group of groupsToUpdate) {
          updateUnreadCount(group).then(updatedGroup => {
            // We need to update groups one by one since we can't await inside this loop
            setGroups(prev => prev.map(g => g.id === updatedGroup.id ? updatedGroup : g));
          });
        }
        return groupsToUpdate; // Return immediately, the actual updates will come later
      });
      
      return statuses;
    } catch (error) {
      console.error('Error loading read statuses:', error);
      return {};
    }
  };

  // Load all users who are senders in groups
  const loadGroupSenders = async (groupsData: GroupChat[]) => {
    try {
      // Get all unique sender IDs
      const senderIds = new Set<string>();
      groupsData.forEach(group => {
        if (group.lastMessageSender) {
          senderIds.add(group.lastMessageSender);
        }
      });
      
      // Batch fetch user details
      const senders: {[senderId: string]: string} = {};
      
      // Convert Set to Array to iterate
      const senderIdsArray = Array.from(senderIds);
      
      for (const senderId of senderIdsArray) {
        try {
          const userDoc = await getDoc(doc(db, 'users', senderId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            senders[senderId] = userData.displayName || userData.email || 'Unknown User';
          }
        } catch (err) {
          console.error(`Error fetching sender ${senderId}:`, err);
        }
      }
      
      setGroupSenders(senders);
    } catch (error) {
      console.error('Error loading group senders:', error);
    }
  };

  const loadUserGroups = async () => {
    try {
      // Removing orderBy to avoid composite index requirement
      const groupsRef = collection(db, 'groups');
      const q = query(
        groupsRef, 
        where('members', 'array-contains', currentUser.id)
        // Removed orderBy to avoid index error
      );
      const querySnapshot = await getDocs(q);
      
      const groupsData: GroupChat[] = [];
      querySnapshot.forEach((doc) => {
        groupsData.push({ id: doc.id, ...doc.data() } as GroupChat);
      });
      
      console.log(`Loaded ${groupsData.length} groups for user ${currentUser.id}`);
      
      // Sort groups by lastMessageTime on the client side instead
      groupsData.sort((a, b) => {
        // Handle missing lastMessageTime
        if (!a.lastMessageTime) return 1;
        if (!b.lastMessageTime) return -1;
        
        // Convert Firebase timestamps to milliseconds for comparison
        const timeA = a.lastMessageTime?.toMillis ? a.lastMessageTime.toMillis() : 0;
        const timeB = b.lastMessageTime?.toMillis ? b.lastMessageTime.toMillis() : 0;
        
        // Sort descending (newest first)
        return timeB - timeA;
      });
      
      // For each group, count unread messages
      for (const group of groupsData) {
        await updateUnreadCount(group);
      }
      
      setGroups(groupsData);
      
      // Load sender display names
      await loadGroupSenders(groupsData);
    } catch (error) {
      console.error('Error loading groups:', error);
      toast.error('Failed to load groups. Please try creating the required index by visiting the URL in the console.');
    }
  };

  // Update unread count for a single group
  const updateUnreadCount = async (group: GroupChat) => {
    if (!currentUser?.id || !group.id) return group;
    
    try {
      // Get the user's last read timestamp for this group
      const lastRead = readStatuses[group.id] || new Date(0); // Default to epoch if never read
      
      // Query for all messages in this group - we'll filter by timestamp in memory
      // This avoids the need for a composite index
      const messagesRef = collection(db, 'groupMessages');
      const q = query(
        messagesRef,
        where('groupId', '==', group.id),
        orderBy('timestamp', 'desc'),
        limit(100)
      );
      
      try {
        const querySnapshot = await getDocs(q);
        let count = 0;
        
        querySnapshot.forEach(doc => {
          const data = doc.data();
          
          // Only count if it's not the current user AND the message is after lastRead
          // This filtering is done client-side to avoid index requirements
          if (data.senderId !== currentUser.id && 
              data.timestamp) {
              
            // Get the message timestamp as Date
            let messageDate;
            if (data.timestamp.toDate) {
              messageDate = data.timestamp.toDate();
            } else if (data.timestamp.seconds) {
              // Handle Firestore timestamp format
              messageDate = new Date(data.timestamp.seconds * 1000);
            } else {
              // Fallback to current date which won't be unread
              messageDate = new Date(0);
            }
            
            // Debug output to check timestamps
            const lastReadTime = lastRead.getTime();
            const messageTime = messageDate.getTime();
            
            if (messageTime > lastReadTime) {
              count++;
              console.log(`Unread message in ${group.name}: Message time: ${messageDate}, Last read: ${lastRead}, Diff: ${messageTime - lastReadTime}ms`);
            }
          }
        });
        
        console.log(`Group ${group.name} has ${count} unread messages (Last read: ${lastRead.toISOString()})`);
        group.unreadCount = count;
      } catch (error) {
        console.error(`Error counting unread messages for group ${group.id}:`, error);
        // Set to 0 if we can't determine the count
        group.unreadCount = 0;
      }
      
      return group;
    } catch (error) {
      console.error(`Error updating unread count for group ${group.id}:`, error);
      return group;
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('email', '>=', searchQuery),
        where('email', '<=', searchQuery + '\uf8ff')
      );
      
      const querySnapshot = await getDocs(q);
      const results: User[] = [];
      
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        // Don't include current user in search results
        if (doc.id !== currentUser.id) {
          results.push({
            id: doc.id,
            email: userData.email,
            displayName: userData.displayName,
            photoURL: userData.photoURL,
            status: userData.status
          });
        }
      });
      
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const addUserToSelection = (user: User) => {
    if (!selectedUsers.some(u => u.id === user.id)) {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const removeUserFromSelection = (userId: string) => {
    setSelectedUsers(selectedUsers.filter(user => user.id !== userId));
  };

  const createGroup = async () => {
    if (!newGroupName.trim() || selectedUsers.length === 0) {
      toast.error('Please enter a group name and select at least one user');
      return;
    }

    try {
      // Create a new group document
      const groupRef = await addDoc(collection(db, 'groups'), {
        name: newGroupName.trim(),
        createdBy: currentUser.id,
        createdAt: serverTimestamp(),
        members: [currentUser.id, ...selectedUsers.map(user => user.id)],
        photoURL: null,
        lastMessage: 'Group created',
        lastMessageTime: serverTimestamp(),
        lastMessageSender: currentUser.id
      });

      // Create a group chat document
      await addDoc(collection(db, 'groupMessages'), {
        groupId: groupRef.id,
        senderId: currentUser.id,
        senderName: currentUser.displayName,
        content: `${currentUser.displayName || 'User'} created the group "${newGroupName}"`,
        timestamp: serverTimestamp(),
        type: 'system'
      });
      
      // Set initial read status for creator
      await setDoc(doc(collection(db, 'groupReadStatus')), {
        groupId: groupRef.id,
        userId: currentUser.id,
        lastReadTimestamp: serverTimestamp()
      });

      toast.success('Group created successfully');
      setIsCreateDialogOpen(false);
      setNewGroupName('');
      setSelectedUsers([]);
      loadUserGroups();
    } catch (error) {
      console.error('Error creating group:', error);
      toast.error('Failed to create group');
    }
  };
  
  // Function to create or update read status directly in Firestore
  const ensureReadStatus = async (groupId: string): Promise<void> => {
    if (!currentUser?.id) return;
    
    try {
      const readStatusRef = collection(db, 'groupReadStatus');
      const q = query(
        readStatusRef, 
        where('groupId', '==', groupId),
        where('userId', '==', currentUser.id)
      );
      
      const querySnapshot = await getDocs(q);
      const now = new Date();
      
      if (querySnapshot.empty) {
        // No read status exists, create one
        await addDoc(readStatusRef, {
          groupId,
          userId: currentUser.id,
          lastReadTimestamp: serverTimestamp()
        });
        console.log(`Created read status for group ${groupId} at ${now.toISOString()}`);
        
        // Update local read status
        setReadStatuses(prev => ({
          ...prev,
          [groupId]: now
        }));
      } else {
        // Update existing read status
        const docId = querySnapshot.docs[0].id;
        await updateDoc(doc(readStatusRef, docId), {
          lastReadTimestamp: serverTimestamp()
        });
        console.log(`Updated read status for group ${groupId} at ${now.toISOString()}`);
        
        // Update local read status
        setReadStatuses(prev => ({
          ...prev,
          [groupId]: now
        }));
      }
      
      // Clear unread count for this group
      setGroups(prevGroups => 
        prevGroups.map(g => g.id === groupId ? {...g, unreadCount: 0} : g)
      );
    } catch (error) {
      console.error('Error ensuring read status:', error);
    }
  };
  
  // Function to handle clicking a group - update read status
  const handleGroupClick = async (groupId: string, name: string) => {
    try {
      // Update the active group
      setActiveGroup(groupId);
      
      // First mark as read in Firebase
      await ensureReadStatus(groupId);
      
      // Then call the parent component's onSelect
      onSelect(groupId, name);
    } catch (error) {
      console.error('Error in handleGroupClick:', error);
    }
  };

  // Function to get formatted sender name for the last message
  const getFormattedLastMessage = (group: GroupChat) => {
    if (!group.lastMessage) return '';
    
    if (group.lastMessageSender && group.lastMessageSender === currentUser.id) {
      return `You: ${group.lastMessage}`;
    }
    
    if (group.lastMessageSender && groupSenders[group.lastMessageSender]) {
      return `${groupSenders[group.lastMessageSender]}: ${group.lastMessage}`;
    }
    
    return group.lastMessage;
  };

  // Function to refresh unread counts manually
  const refreshUnreadCounts = async () => {
    if (!currentUser?.id) return;
    
    try {
      // First refresh read statuses
      await loadReadStatuses();
      
      // Then update unread counts for all groups
      const updatedGroups = [...groups];
      let needsUpdate = false;
      
      for (let i = 0; i < updatedGroups.length; i++) {
        const group = { ...updatedGroups[i] };
        await updateUnreadCount(group);
        updatedGroups[i] = group;
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        setGroups(updatedGroups);
        console.log("Unread counts refreshed for all groups");
      }
    } catch (error) {
      console.error("Error refreshing unread counts:", error);
    }
  };

  // Update active group when props change
  useEffect(() => {
    if (activeGroupId !== activeGroup) {
      setActiveGroup(activeGroupId);
      
      // When active group changes, ensure read status is updated
      if (activeGroupId) {
        ensureReadStatus(activeGroupId);
      }
    }
  }, [activeGroupId]);
  
  // Automatically mark active group as read when new messages come in
  useEffect(() => {
    if (activeGroup) {
      // Find the active group in our groups list
      const group = groups.find(g => g.id === activeGroup);
      
      // If it exists and has unread messages, mark as read
      if (group && (group.unreadCount ?? 0) > 0) {
        console.log(`Auto-marking group ${activeGroup} as read since it's the active group`);
        ensureReadStatus(activeGroup);
      }
    }
  }, [groups, activeGroup]);

  return (
    <div className="space-y-4">
      {/* Create Group Button */}
      <div className="flex justify-between mb-2">
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full mr-2">
              <Users className="mr-2 h-4 w-4" />
              Create New Group
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create Group Chat</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Input
                  id="name"
                  placeholder="Group Name"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <div className="relative">
                  <Input
                    id="search"
                    placeholder="Search Users"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={handleSearch}
                    disabled={isSearching}
                  >
                    <Search size={20} />
                  </Button>
                </div>
              </div>
              
              {/* Selected Users */}
              {selectedUsers.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Selected Users</label>
                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.map((user) => (
                      <Badge key={user.id} variant="secondary" className="flex items-center gap-1">
                        {user.displayName || user.email}
                        <button onClick={() => removeUserFromSelection(user.id)} className="ml-1">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Search Results</label>
                  <ScrollArea className="h-[200px] rounded-md border p-2">
                    <div className="space-y-2">
                      {searchResults.map((user) => (
                        <div 
                          key={user.id}
                          className="flex items-center justify-between p-2 hover:bg-accent/50 rounded-md cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={user.photoURL || '/default-avatar.png'} alt={user.displayName || user.email} />
                              <AvatarFallback>{user.displayName?.[0] || user.email?.[0] || 'U'}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{user.displayName || user.email}</p>
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => addUserToSelection(user)}
                            disabled={selectedUsers.some(u => u.id === user.id)}
                          >
                            {selectedUsers.some(u => u.id === user.id) ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Plus className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createGroup} disabled={!newGroupName.trim() || selectedUsers.length === 0}>
                Create Group
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Debug refresh button */}
        <Button 
          variant="outline" 
          size="sm"
          onClick={refreshUnreadCounts}
          title="Manually refresh unread counts"
        >
          Refresh
        </Button>
      </div>

      {/* Group List */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Your Groups</h2>
        {groups.length === 0 ? (
          <p className="text-sm text-center text-muted-foreground">No groups found</p>
        ) : (
          <ScrollArea className="h-[400px]">
            {groups.map((group) => (
              <div
                key={group.id}
                className={`flex items-center space-x-3 p-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer ${group.id === activeGroup ? 'bg-accent/70' : ''}`}
                onClick={() => handleGroupClick(group.id, group.name)}
              >
                <div className="relative">
                  <Avatar>
                    <AvatarImage src={group.photoURL || '/group-avatar.png'} />
                    <AvatarFallback>
                      {group.name[0]?.toUpperCase() || 'G'}
                    </AvatarFallback>
                  </Avatar>
                  
                  {/* Notification Badge */}
                  {(group.unreadCount ?? 0) > 0 && (
                    <Badge 
                      className="absolute -top-1 -right-1 rounded-full h-5 w-5 flex items-center justify-center p-0 bg-red-600 text-white border-2 border-background text-xs font-bold"
                      variant="default"
                    >
                      {(group.unreadCount ?? 0) > 99 ? '99+' : group.unreadCount ?? 0}
                    </Badge>
                  )}
                </div>
                
                <div className="flex flex-col flex-grow min-w-0">
                  <div className="flex justify-between items-center">
                    <h3 className="text-base font-semibold text-gray-800 truncate">
                      {group.name}
                    </h3>
                  </div>
                  {group.lastMessage && (
                    <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                      {getFormattedLastMessage(group)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </ScrollArea>
        )}
      </div>
    </div>
  );
};

// Export a modified component that includes the markGroupAsRead function
interface GroupChatComponentWithFunctions extends React.FC<GroupChatProps> {
  markGroupAsRead: (groupId: string) => Promise<void>;
}

const GroupChatWithFunctions = GroupChatComponent as unknown as GroupChatComponentWithFunctions;
GroupChatWithFunctions.markGroupAsRead = async (groupId: string) => {
  // This is a placeholder - the actual implementation needs to access
  // the component instance to call its markGroupAsRead method
  console.warn('markGroupAsRead called statically - no effect');
};

export default GroupChatWithFunctions; 