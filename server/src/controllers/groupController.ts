import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware.js';
import { 
  saveGroup, 
  getGroup, 
  deleteGroup, 
  saveMember, 
  getMember, 
  deleteMember, 
  getGroupMembers, 
  getAllGroups,
  saveNotification,
  saveActivityLog
} from '../config/db.js';
import { sendToGroup, sendToUser } from '../config/socket.js';
import crypto from 'crypto';

// Generate a random 6-character group invite code
const generateInviteCode = (): string => {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
};

export async function createGroup(req: AuthenticatedRequest, res: Response) {
  const { name, description, avatar } = req.body;
  const username = req.user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized: Missing username' });
  }

  if (!name) {
    return res.status(400).json({ error: 'Group name is required' });
  }

  try {
    const groupId = crypto.randomUUID();
    const inviteCode = generateInviteCode();
    const timestamp = new Date().toISOString();

    const newGroup = {
      id: groupId,
      name,
      description: description || '',
      avatar: avatar || '👥',
      inviteCode,
      owner: username,
      createdAt: timestamp,
      settings: {}
    };

    await saveGroup(groupId, newGroup);

    // Auto-add creator as 'owner' member
    const memberId = `${groupId}_${username.toLowerCase()}`;
    const newMember = {
      id: memberId,
      groupId,
      username,
      role: 'owner' as const,
      joinedAt: timestamp
    };

    await saveMember(memberId, newMember);

    // Save Activity Log
    const logId = crypto.randomUUID();
    await saveActivityLog(logId, {
      id: logId,
      groupId,
      username,
      action: 'created the group',
      createdAt: timestamp
    });

    return res.status(201).json({ group: newGroup, member: newMember });
  } catch (error) {
    console.error('Create group error:', error);
    return res.status(500).json({ error: 'Failed to create group' });
  }
}

export async function listGroups(req: AuthenticatedRequest, res: Response) {
  const username = req.user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Return all groups where user is a member
    const normUser = username.toLowerCase();
    const groups = getAllGroups();
    const userGroups = [];

    for (const group of groups) {
      const member = await getMember(`${group.id}_${normUser}`);
      if (member) {
        userGroups.push({
          ...group,
          myRole: member.role
        });
      }
    }

    return res.json({ groups: userGroups });
  } catch (error) {
    console.error('List groups error:', error);
    return res.status(500).json({ error: 'Failed to retrieve groups' });
  }
}

export async function getGroupDetails(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const username = req.user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const group = await getGroup(id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Verify requesting user is a member
    const member = await getMember(`${id}_${username.toLowerCase()}`);
    if (!member) {
      return res.status(403).json({ error: 'Access denied: You are not a member of this group' });
    }

    return res.json({ group, role: member.role });
  } catch (error) {
    console.error('Get group details error:', error);
    return res.status(500).json({ error: 'Failed to retrieve group details' });
  }
}

export async function joinGroup(req: AuthenticatedRequest, res: Response) {
  const { inviteCode } = req.body;
  const username = req.user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!inviteCode) {
    return res.status(400).json({ error: 'Invite code is required' });
  }

  try {
    const groups = getAllGroups();
    const group = groups.find(g => g.inviteCode.toUpperCase() === inviteCode.trim().toUpperCase());

    if (!group) {
      return res.status(404).json({ error: 'Invalid invite code: Group not found' });
    }

    const normUser = username.toLowerCase();
    const memberId = `${group.id}_${normUser}`;
    
    // Check if already a member
    const existing = await getMember(memberId);
    if (existing) {
      return res.status(400).json({ error: 'You are already a member of this group' });
    }

    const timestamp = new Date().toISOString();
    const newMember = {
      id: memberId,
      groupId: group.id,
      username,
      role: 'member' as const,
      joinedAt: timestamp
    };

    await saveMember(memberId, newMember);

    // Save Notification
    const notifId = crypto.randomUUID();
    const notif = {
      id: notifId,
      username: group.owner,
      type: 'member_joined' as const,
      title: 'New Member Joined',
      description: `${username} joined "${group.name}".`,
      read: false,
      createdAt: timestamp,
      category: 'group',
      priority: 'low' as const,
      metadata: { groupId: group.id }
    };
    await saveNotification(notifId, notif);

    // Save Activity Log
    const logId = crypto.randomUUID();
    await saveActivityLog(logId, {
      id: logId,
      groupId: group.id,
      username,
      action: 'joined the group',
      createdAt: timestamp
    });

    // Notify group room of new member
    sendToGroup(group.id, 'member_joined', { member: newMember, username });
    sendToUser(group.owner, 'notification_added', notif);

    return res.json({ group, member: newMember });
  } catch (error) {
    console.error('Join group error:', error);
    return res.status(500).json({ error: 'Failed to join group' });
  }
}

export async function leaveGroup(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const username = req.user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const group = await getGroup(id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const normUser = username.toLowerCase();
    const memberId = `${id}_${normUser}`;
    const member = await getMember(memberId);

    if (!member) {
      return res.status(400).json({ error: 'You are not a member of this group' });
    }

    if (member.role === 'owner') {
      return res.status(400).json({ error: 'Group owners cannot leave. Transfer ownership first.' });
    }

    await deleteMember(memberId);

    const timestamp = new Date().toISOString();

    // Log Activity
    const logId = crypto.randomUUID();
    await saveActivityLog(logId, {
      id: logId,
      groupId: id,
      username,
      action: 'left the group',
      createdAt: timestamp
    });

    // Notify group members
    sendToGroup(id, 'member_left', { username });

    return res.json({ message: 'Successfully left the group' });
  } catch (error) {
    console.error('Leave group error:', error);
    return res.status(500).json({ error: 'Failed to leave group' });
  }
}

export async function deleteGroupEndpoint(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const username = req.user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const group = await getGroup(id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (group.owner.toLowerCase() !== username.toLowerCase()) {
      return res.status(403).json({ error: 'Access denied: Only the group owner can delete it' });
    }

    await deleteGroup(id);

    return res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Delete group error:', error);
    return res.status(500).json({ error: 'Failed to delete group' });
  }
}

export async function transferOwnership(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const { targetUsername } = req.body;
  const username = req.user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!targetUsername) {
    return res.status(400).json({ error: 'Target username is required' });
  }

  try {
    const group = await getGroup(id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (group.owner.toLowerCase() !== username.toLowerCase()) {
      return res.status(403).json({ error: 'Access denied: Only the owner can transfer ownership' });
    }

    const targetMemberId = `${id}_${targetUsername.toLowerCase()}`;
    const targetMember = await getMember(targetMemberId);

    if (!targetMember) {
      return res.status(400).json({ error: 'Target user is not a member of this group' });
    }

    // Demote current owner to admin, promote target to owner
    const currentMemberId = `${id}_${username.toLowerCase()}`;
    const currentMember = await getMember(currentMemberId);
    
    if (currentMember) {
      currentMember.role = 'admin';
      await saveMember(currentMemberId, currentMember);
    }

    targetMember.role = 'owner';
    await saveMember(targetMemberId, targetMember);

    group.owner = targetUsername;
    await saveGroup(id, group);

    const timestamp = new Date().toISOString();

    // Log Activity
    const logId = crypto.randomUUID();
    await saveActivityLog(logId, {
      id: logId,
      groupId: id,
      username,
      action: `transferred group ownership to ${targetUsername}`,
      createdAt: timestamp
    });

    sendToGroup(id, 'ownership_transferred', { owner: targetUsername });

    return res.json({ message: 'Ownership transferred successfully', group });
  } catch (error) {
    console.error('Transfer ownership error:', error);
    return res.status(500).json({ error: 'Failed to transfer ownership' });
  }
}

export async function listGroupMembers(req: AuthenticatedRequest, res: Response) {
  const { id } = req.params;
  const username = req.user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const member = await getMember(`${id}_${username.toLowerCase()}`);
    if (!member) {
      return res.status(403).json({ error: 'Access denied: You are not a member of this group' });
    }

    const members = getGroupMembers(id);
    return res.json({ members });
  } catch (error) {
    console.error('List group members error:', error);
    return res.status(500).json({ error: 'Failed to retrieve members' });
  }
}

export async function removeGroupMember(req: AuthenticatedRequest, res: Response) {
  const { id, memberUsername } = req.params;
  const username = req.user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const group = await getGroup(id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const actingMember = await getMember(`${id}_${username.toLowerCase()}`);
    if (!actingMember || (actingMember.role !== 'owner' && actingMember.role !== 'admin')) {
      return res.status(403).json({ error: 'Access denied: Only owners and admins can remove members' });
    }

    const targetMemberId = `${id}_${memberUsername.toLowerCase()}`;
    const targetMember = await getMember(targetMemberId);
    if (!targetMember) {
      return res.status(404).json({ error: 'Member not found in this group' });
    }

    // Admins cannot remove owners or other admins
    if (actingMember.role === 'admin' && (targetMember.role === 'owner' || targetMember.role === 'admin')) {
      return res.status(403).json({ error: 'Access denied: Admins cannot remove other admins or owners' });
    }

    await deleteMember(targetMemberId);

    const timestamp = new Date().toISOString();

    // Log Activity
    const logId = crypto.randomUUID();
    await saveActivityLog(logId, {
      id: logId,
      groupId: id,
      username,
      action: `removed ${memberUsername} from the group`,
      createdAt: timestamp
    });

    sendToGroup(id, 'member_removed', { username: memberUsername });
    sendToUser(memberUsername, 'group_removed', { groupId: id });

    return res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove member error:', error);
    return res.status(500).json({ error: 'Failed to remove member' });
  }
}

export async function updateGroupMemberRole(req: AuthenticatedRequest, res: Response) {
  const { id, memberUsername } = req.params;
  const { role } = req.body; // admin, member
  const username = req.user?.username;

  if (!username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!role || (role !== 'admin' && role !== 'member')) {
    return res.status(400).json({ error: 'Invalid role. Must be admin or member.' });
  }

  try {
    const group = await getGroup(id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (group.owner.toLowerCase() !== username.toLowerCase()) {
      return res.status(403).json({ error: 'Access denied: Only group owners can change roles' });
    }

    const targetMemberId = `${id}_${memberUsername.toLowerCase()}`;
    const targetMember = await getMember(targetMemberId);
    if (!targetMember) {
      return res.status(404).json({ error: 'Member not found in this group' });
    }

    if (targetMember.role === 'owner') {
      return res.status(400).json({ error: 'Cannot change the role of the group owner' });
    }

    targetMember.role = role;
    await saveMember(targetMemberId, targetMember);

    const timestamp = new Date().toISOString();

    // Log Activity
    const logId = crypto.randomUUID();
    await saveActivityLog(logId, {
      id: logId,
      groupId: id,
      username,
      action: `updated ${memberUsername}'s role to ${role}`,
      createdAt: timestamp
    });

    sendToGroup(id, 'member_role_updated', { username: memberUsername, role });

    return res.json({ message: 'Member role updated successfully', member: targetMember });
  } catch (error) {
    console.error('Update member role error:', error);
    return res.status(500).json({ error: 'Failed to update member role' });
  }
}
