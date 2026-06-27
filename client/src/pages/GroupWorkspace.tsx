import React, { useState, useEffect } from 'react';
import { 
  Users, Layers, Calendar, Trophy, Activity, Sparkles, Plus, 
  Trash2, LogOut, Crown, Copy, Check, MessageSquare, ClipboardCheck,
  ChevronRight, ShieldCheck, Clock, UserPlus
} from 'lucide-react';
import { GlassCard } from '../components/GlassCard.js';
import { api } from '../api.js';

interface GroupItem {
  id: string;
  name: string;
  description: string;
  avatar: string;
  inviteCode: string;
  owner: string;
  createdAt: string;
  myRole: 'owner' | 'admin' | 'member';
}

interface MemberItem {
  groupId: string;
  username: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
}

interface TaskItem {
  id: string;
  groupId: string | null;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'todo' | 'in_progress' | 'completed' | 'overdue';
  dueDate: string;
  createdBy: string;
  tags: string[];
  checklist: { id: string; text: string; completed: boolean }[];
  progress: number;
  assignedUsers: string[];
  comments?: { id: string; username: string; name: string; text: string; createdAt: string }[];
}

interface GoalItem {
  id: string;
  groupId: string;
  title: string;
  description: string;
  deadline: string;
  milestones: { id: string; text: string; completed: boolean }[];
  progress: number;
  completionPercent: number;
  assignedMembers: string[];
}

interface ActivityItem {
  id: string;
  groupId: string;
  username: string;
  action: string;
  createdAt: string;
}

interface GroupWorkspaceProps {
  currentUser: { username: string; name?: string; role: 'admin' | 'user' } | null;
  enqueueOfflineMutation: (action: any, payload: any) => void;
  isOnline: boolean;
}

export const GroupWorkspace: React.FC<GroupWorkspaceProps> = ({ currentUser, enqueueOfflineMutation, isOnline }) => {
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [activeGroup, setActiveGroup] = useState<GroupItem | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Navigation
  const [activeSubTab, setActiveSubTab] = useState<'kanban' | 'goals' | 'members' | 'activity' | 'ai'>('kanban');

  // Modal/Forms
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupAvatar, setGroupAvatar] = useState('👥');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  
  // Group Specific Data State
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [aiInsights, setAiInsights] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Task & Goal Creation states
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskTags, setTaskTags] = useState('');
  const [taskAssigned, setTaskAssigned] = useState<string[]>([]);
  const [taskChecklistText, setTaskChecklistText] = useState('');
  const [taskChecklist, setTaskChecklist] = useState<{ id: string; text: string; completed: boolean }[]>([]);

  // Task comments
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [commentText, setCommentText] = useState('');

  // Goal Form
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDesc, setGoalDesc] = useState('');
  const [goalDeadline, setGoalDeadline] = useState('');
  const [goalMilestoneText, setGoalMilestoneText] = useState('');
  const [goalMilestones, setGoalMilestones] = useState<{ id: string; text: string; completed: boolean }[]>([]);
  const [goalAssigned, setGoalAssigned] = useState<string[]>([]);

  // Ownership transfer
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [transferTarget, setTransferTarget] = useState('');

  // Role modification
  const [editingRoleUser, setEditingRoleUser] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<'admin' | 'member'>('member');

  // Fetch groups
  const loadGroupsList = async () => {
    setLoading(true);
    try {
      const res = await api.groups.list();
      setGroups(res.groups || []);
    } catch (err) {
      console.error('Failed to load workspaces:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroupsList();
  }, []);

  // Fetch specific details when active group changes
  const fetchGroupDetails = async (groupId: string) => {
    try {
      const [membersRes, tasksRes, goalsRes, activityRes] = await Promise.all([
        api.groups.getMembers(groupId),
        api.tasks.list(groupId),
        api.goals.list(groupId),
        api.groups.getActivity(groupId)
      ]);
      setMembers(membersRes.members || []);
      setTasks(tasksRes.tasks || []);
      setGoals(goalsRes.goals || []);
      setActivities(activityRes.activity || []);
      setAiInsights('');
    } catch (err) {
      console.error('Failed to load group sub-details:', err);
    }
  };

  useEffect(() => {
    if (activeGroup) {
      fetchGroupDetails(activeGroup.id);
    }
  }, [activeGroup]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName) return;

    try {
      const res = await api.groups.create({
        name: groupName,
        description: groupDesc,
        avatar: groupAvatar
      });
      setGroupName('');
      setGroupDesc('');
      setGroupAvatar('👥');
      setShowCreateModal(false);
      await loadGroupsList();
      if (res && res.group) {
        setActiveGroup({ ...res.group, myRole: 'owner' });
      }
    } catch (err) {
      alert('Error creating group workspace.');
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCodeInput) return;

    try {
      const res = await api.groups.join(inviteCodeInput);
      setInviteCodeInput('');
      setShowJoinModal(false);
      await loadGroupsList();
      if (res && res.group) {
        setActiveGroup({ ...res.group, myRole: 'member' });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to join group. Verify your code.');
    }
  };

  const handleLeaveGroup = async () => {
    if (!activeGroup) return;
    if (window.confirm(`Are you sure you want to leave ${activeGroup.name}?`)) {
      try {
        await api.groups.leave(activeGroup.id);
        setActiveGroup(null);
        await loadGroupsList();
      } catch (err: any) {
        alert(err.message || 'Failed to leave group.');
      }
    }
  };

  const handleDeleteGroup = async () => {
    if (!activeGroup) return;
    if (window.confirm(`WARNING: This will permanently delete "${activeGroup.name}" and all its goals, tasks, and history. Proceed?`)) {
      try {
        await api.groups.delete(activeGroup.id);
        setActiveGroup(null);
        await loadGroupsList();
      } catch (err: any) {
        alert(err.message || 'Failed to delete group.');
      }
    }
  };

  const handleTransferOwnership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup || !transferTarget) return;

    try {
      await api.groups.transfer(activeGroup.id, transferTarget);
      setTransferTarget('');
      setShowTransferForm(false);
      setActiveGroup(prev => prev ? { ...prev, myRole: 'admin' } : null);
      await fetchGroupDetails(activeGroup.id);
    } catch (err: any) {
      alert(err.message || 'Ownership transfer failed.');
    }
  };

  const handleRemoveMember = async (username: string) => {
    if (!activeGroup) return;
    if (window.confirm(`Are you sure you want to remove ${username} from the group?`)) {
      try {
        await api.groups.removeMember(activeGroup.id, username);
        await fetchGroupDetails(activeGroup.id);
      } catch (err: any) {
        alert(err.message || 'Failed to remove member.');
      }
    }
  };

  const handleUpdateRole = async (username: string) => {
    if (!activeGroup) return;
    try {
      await api.groups.updateRole(activeGroup.id, username, newRole);
      setEditingRoleUser(null);
      await fetchGroupDetails(activeGroup.id);
    } catch (err: any) {
      alert(err.message || 'Role change failed.');
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup || !taskTitle || !taskDueDate) return;

    const payload = {
      groupId: activeGroup.id,
      title: taskTitle,
      description: taskDesc,
      priority: taskPriority,
      dueDate: taskDueDate,
      tags: taskTags ? taskTags.split(',').map(t => t.trim()) : [],
      checklist: taskChecklist,
      assignedUsers: taskAssigned
    };

    if (!isOnline) {
      // Optimistic offline creation
      const localId = 'local_' + Math.random().toString(36).substring(2, 9);
      const tempTask: TaskItem = {
        ...payload,
        id: localId,
        createdBy: currentUser?.username || 'user',
        progress: 0,
        status: 'todo',
        comments: []
      };
      setTasks(prev => [...prev, tempTask]);
      enqueueOfflineMutation('CREATE_TASK', payload);
      resetTaskForm();
      return;
    }

    try {
      await api.tasks.create(payload);
      resetTaskForm();
      await fetchGroupDetails(activeGroup.id);
    } catch (err: any) {
      alert(err.message || 'Failed to create task.');
    }
  };

  const resetTaskForm = () => {
    setTaskTitle('');
    setTaskDesc('');
    setTaskPriority('medium');
    setTaskDueDate('');
    setTaskTags('');
    setTaskAssigned([]);
    setTaskChecklist([]);
    setTaskChecklistText('');
    setShowTaskForm(false);
  };

  const handleCompleteTask = async (taskId: string) => {
    if (!isOnline) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed', progress: 100 } : t));
      enqueueOfflineMutation('UPDATE_TASK', { id: taskId, status: 'completed', progress: 100 });
      return;
    }

    try {
      await api.tasks.complete(taskId);
      await fetchGroupDetails(activeGroup!.id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTaskChecklistItemToggle = async (task: TaskItem, itemIdx: number) => {
    const updatedChecklist = task.checklist.map((c, idx) => idx === itemIdx ? { ...c, completed: !c.completed } : c);
    const completedCount = updatedChecklist.filter(c => c.completed).length;
    const progress = Math.round((completedCount / updatedChecklist.length) * 100);
    const status = progress === 100 ? 'completed' : task.status;

    if (!isOnline) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, checklist: updatedChecklist, progress, status } : t));
      enqueueOfflineMutation('UPDATE_TASK', { id: task.id, checklist: updatedChecklist, progress, status });
      return;
    }

    try {
      await api.tasks.update(task.id, { checklist: updatedChecklist, progress, status });
      await fetchGroupDetails(activeGroup!.id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddTaskComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !commentText) return;

    try {
      await api.tasks.addComment(selectedTask.id, commentText);
      setCommentText('');
      // Reload details
      const detail = await api.tasks.get(selectedTask.id);
      setSelectedTask(detail.task);
      await fetchGroupDetails(activeGroup!.id);
    } catch (err) {
      alert('Failed to add comment');
    }
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup || !goalTitle || !goalDeadline) return;

    const payload = {
      groupId: activeGroup.id,
      title: goalTitle,
      description: goalDesc,
      deadline: goalDeadline,
      milestones: goalMilestones,
      assignedMembers: goalAssigned
    };

    if (!isOnline) {
      const localId = 'local_' + Math.random().toString(36).substring(2, 9);
      const tempGoal: GoalItem = {
        ...payload,
        id: localId,
        progress: 0,
        completionPercent: 0
      };
      setGoals(prev => [...prev, tempGoal]);
      enqueueOfflineMutation('CREATE_GOAL', payload);
      resetGoalForm();
      return;
    }

    try {
      await api.goals.create(payload);
      resetGoalForm();
      await fetchGroupDetails(activeGroup.id);
    } catch (err) {
      alert('Goal creation failed.');
    }
  };

  const resetGoalForm = () => {
    setGoalTitle('');
    setGoalDesc('');
    setGoalDeadline('');
    setGoalMilestones([]);
    setGoalMilestoneText('');
    setGoalAssigned([]);
    setShowGoalForm(false);
  };

  const handleGoalMilestoneToggle = async (goal: GoalItem, milestoneId: string) => {
    const updatedMilestones = goal.milestones.map(m => m.id === milestoneId ? { ...m, completed: !m.completed } : m);
    const completedCount = updatedMilestones.filter(m => m.completed).length;
    const progress = Math.round((completedCount / updatedMilestones.length) * 100);

    if (!isOnline) {
      setGoals(prev => prev.map(g => g.id === goal.id ? { ...g, milestones: updatedMilestones, progress, completionPercent: progress } : g));
      enqueueOfflineMutation('UPDATE_GOAL', { id: goal.id, milestones: updatedMilestones, progress, completionPercent: progress });
      return;
    }

    try {
      await api.goals.update(goal.id, { milestones: updatedMilestones, progress, completionPercent: progress });
      await fetchGroupDetails(activeGroup!.id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateAiInsights = async () => {
    if (!activeGroup) return;
    setAiLoading(true);
    try {
      const res = await api.ai.getGroupInsights(activeGroup.id);
      setAiInsights(res.insights);
    } catch (err) {
      setAiInsights('Failed to generate insights. Check your network or API status.');
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'ai' && activeGroup && !aiInsights) {
      handleGenerateAiInsights();
    }
  }, [activeSubTab]);

  const copyInviteCode = () => {
    if (!activeGroup) return;
    navigator.clipboard.writeText(activeGroup.inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Remaining days count helper
  const getRemainingDays = (deadlineStr: string) => {
    const deadline = new Date(deadlineStr);
    const diff = deadline.getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days >= 0 ? `${days} day(s) left` : `${Math.abs(days)} day(s) overdue`;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Loading workspaces...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Workspace Selector Bar */}
      {!activeGroup ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.25rem' }}>Team Workspaces</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Select a group workspace below or register a new one.</p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-secondary" onClick={() => setShowJoinModal(true)}><UserPlus size={16} /> Join Group</button>
              <button className="btn-primary" onClick={() => setShowCreateModal(true)}><Plus size={16} /> Create Group</button>
            </div>
          </div>

          {groups.length === 0 ? (
            <GlassCard style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <Users size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>No Workspaces Found</h3>
              <p style={{ fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto 1.5rem auto' }}>
                You are not registered in any team workspaces yet. Join an existing team via invite code or spin up your own workspace.
              </p>
            </GlassCard>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
              {groups.map(g => (
                <GlassCard 
                  key={g.id} 
                  hoverEffect 
                  style={{ padding: '1.75rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '1rem' }}
                  onClick={() => setActiveGroup(g)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '2.5rem' }}>{g.avatar}</span>
                    <span style={{ 
                      fontSize: '0.7rem', 
                      fontWeight: 700, 
                      padding: '3px 8px', 
                      borderRadius: '6px', 
                      background: g.myRole === 'owner' ? 'rgba(245,158,11,0.15)' : 'rgba(168,85,247,0.15)',
                      color: g.myRole === 'owner' ? 'var(--color-break)' : 'var(--accent-primary)',
                      textTransform: 'uppercase'
                    }}>{g.myRole}</span>
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{g.name}</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '4px', lineClamp: 2 }}>{g.description}</p>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', borderTop: '1px solid var(--border-glass)', paddingTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    <span>Code: <strong>{g.inviteCode}</strong></span>
                    <ChevronRight size={16} />
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Workspace Active View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Header Panel */}
          <GlassCard style={{ padding: '1.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button 
                onClick={() => setActiveGroup(null)}
                style={{ border: 'none', background: 'var(--bg-input)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}
              >
                ← Back
              </button>
              <span style={{ fontSize: '2.2rem' }}>{activeGroup.avatar}</span>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{activeGroup.name}</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{activeGroup.description}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <div 
                onClick={copyInviteCode}
                style={{ cursor: 'pointer', background: 'var(--bg-input)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-glass)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
              >
                <span>Code: <strong>{activeGroup.inviteCode}</strong></span>
                {copiedCode ? <Check size={14} style={{ color: 'var(--color-working)' }} /> : <Copy size={13} style={{ color: 'var(--text-tertiary)' }} />}
              </div>
              {activeGroup.myRole !== 'owner' ? (
                <button className="btn-secondary" onClick={handleLeaveGroup} style={{ border: '1px solid rgba(239, 68, 68, 0.25)', color: '#ef4444', background: 'rgba(239, 68, 68, 0.05)' }}><LogOut size={14} /> Leave</button>
              ) : (
                <button className="btn-secondary" onClick={handleDeleteGroup} style={{ border: '1px solid rgba(239, 68, 68, 0.25)', color: '#ef4444', background: 'rgba(239, 68, 68, 0.05)' }}><Trash2 size={14} /> Delete Group</button>
              )}
            </div>
          </GlassCard>

          {/* Sub Navigation */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-glass)', paddingBottom: '2px', gap: '1rem', overflowX: 'auto' }}>
            {[
              { id: 'kanban', label: 'Kanban Board', icon: Layers },
              { id: 'goals', label: 'Team Goals', icon: Trophy },
              { id: 'members', label: 'Members', icon: Users },
              { id: 'activity', label: 'Activity Feed', icon: Activity },
              { id: 'ai', label: 'AI Group Insights', icon: Sparkles }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id as any)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: activeSubTab === tab.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    padding: '8px 16px',
                    fontSize: '0.85rem',
                    fontWeight: activeSubTab === tab.id ? 700 : 500,
                    cursor: 'pointer',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Icon size={15} />
                  {tab.label}
                  {activeSubTab === tab.id && (
                    <div style={{ position: 'absolute', bottom: '-2px', left: 0, right: 0, height: '2px', background: 'var(--accent-primary)', borderRadius: '4px' }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Sub-Tab Contents */}
          <div style={{ marginTop: '1rem' }}>
            {activeSubTab === 'kanban' && renderKanbanTab()}
            {activeSubTab === 'goals' && renderGoalsTab()}
            {activeSubTab === 'members' && renderMembersTab()}
            {activeSubTab === 'activity' && renderActivityTab()}
            {activeSubTab === 'ai' && renderAiTab()}
          </div>
        </div>
      )}

      {/* MODALS */}
      {/* Create Modal */}
      {showCreateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
          <GlassCard style={{ width: '100%', maxWidth: '480px', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.25rem' }}>Create New Workspace</h3>
            <form onSubmit={handleCreateGroup} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Avatar Icon</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {['👥', '🚀', '💻', '📈', '🔬', '🎨', '✨'].map(av => (
                    <button 
                      key={av} 
                      type="button" 
                      onClick={() => setGroupAvatar(av)}
                      style={{ fontSize: '1.5rem', border: '1px solid var(--border-glass)', background: groupAvatar === av ? 'var(--accent-gradient)' : 'var(--bg-input)', padding: '6px', borderRadius: '8px', cursor: 'pointer' }}
                    >
                      {av}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Workspace Name</label>
                <input type="text" className="form-input" value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="e.g. Zenith Backend Devs" required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Description</label>
                <textarea className="form-input" value={groupDesc} onChange={e => setGroupDesc(e.target.value)} placeholder="What this team does..." rows={3} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Create Workspace</button>
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* Join Modal */}
      {showJoinModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
          <GlassCard style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.25rem' }}>Join Team Workspace</h3>
            <form onSubmit={handleJoinGroup} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Invite Code</label>
                <input type="text" className="form-input" value={inviteCodeInput} onChange={e => setInviteCodeInput(e.target.value)} placeholder="e.g. A9B8C7" required />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Join Workspace</button>
                <button type="button" className="btn-secondary" onClick={() => setShowJoinModal(false)}>Cancel</button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* Task Comment View Modal */}
      {selectedTask && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
          <GlassCard style={{ width: '100%', maxWidth: '520px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '90vh' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(0,0,0,0.2)', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700 }}>Task #{selectedTask.id.slice(0, 5)}</span>
                <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: selectedTask.priority === 'high' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.1)', color: selectedTask.priority === 'high' ? '#ef4444' : 'var(--text-secondary)' }}>{selectedTask.priority.toUpperCase()}</span>
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '4px' }}>{selectedTask.title}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>{selectedTask.description}</p>
            </div>

            {/* Checklist */}
            {selectedTask.checklist && selectedTask.checklist.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '0.75rem' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}><ClipboardCheck size={14} /> Checklist</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {selectedTask.checklist.map((item, idx) => (
                    <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={item.completed} 
                        onChange={() => handleTaskChecklistItemToggle(selectedTask, idx)}
                        style={{ accentColor: 'var(--accent-primary)' }}
                      />
                      <span style={{ textDecoration: item.completed ? 'line-through' : 'none', color: item.completed ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>{item.text}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Comments scrollable list */}
            <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '0.75rem', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: '150px' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}><MessageSquare size={14} /> Comments ({selectedTask.comments?.length || 0})</h4>
              {(!selectedTask.comments || selectedTask.comments.length === 0) ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>No comments yet. Start a discussion.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedTask.comments.map(c => (
                    <div key={c.id} style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.12)', borderRadius: '8px', fontSize: '0.8rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: '2px' }}>
                        <span>{c.name || c.username}</span>
                        <span>{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div style={{ color: 'var(--text-secondary)' }}>{c.text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Comment form */}
            <form onSubmit={handleAddTaskComment} style={{ display: 'flex', gap: '6px' }}>
              <input type="text" className="form-input" value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Ask a question or provide update..." style={{ flex: 1 }} required />
              <button type="submit" className="btn-primary">Post</button>
            </form>

            <button type="button" className="btn-secondary" style={{ width: '100%' }} onClick={() => setSelectedTask(null)}>Close</button>
          </GlassCard>
        </div>
      )}

    </div>
  );

  // TAB RENDERING FUNCTIONS
  // 1. Kanban Board Tab
  function renderKanbanTab() {
    const isLead = activeGroup?.myRole === 'owner' || activeGroup?.myRole === 'admin';
    const columns: TaskItem['status'][] = ['todo', 'in_progress', 'completed', 'overdue'];

    const getColumnTitle = (col: string) => {
      switch (col) {
        case 'todo': return 'To Do';
        case 'in_progress': return 'In Progress';
        case 'completed': return 'Completed';
        case 'overdue': return 'Overdue';
        default: return col;
      }
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Shared Tasks</h3>
          {isLead && (
            <button className="btn-primary" onClick={() => setShowTaskForm(true)}><Plus size={16} /> Add Task</button>
          )}
        </div>

        {/* Task Creation Form (Inline Collapse) */}
        {showTaskForm && (
          <GlassCard style={{ padding: '1.5rem' }}>
            <h4 style={{ fontWeight: 800, marginBottom: '1rem' }}>Create Team Task</h4>
            <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }} id="task-grid-cols">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Task Title</label>
                  <input type="text" className="form-input" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="e.g. Design Landing Page" required />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Priority</label>
                  <select className="form-input" value={taskPriority} onChange={e => setTaskPriority(e.target.value as any)}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Due Date</label>
                  <input type="date" className="form-input" value={taskDueDate} onChange={e => setTaskDueDate(e.target.value)} required />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Description</label>
                <textarea className="form-input" value={taskDesc} onChange={e => setTaskDesc(e.target.value)} placeholder="Provide specifications or attachment links..." rows={2} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} id="task-sub-grid-cols">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Assign Members (Multi-select)</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '100px', overflowY: 'auto', padding: '6px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                    {members.map(m => (
                      <label key={m.username} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '2px 6px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={taskAssigned.includes(m.username)}
                          onChange={() => {
                            if (taskAssigned.includes(m.username)) {
                              setTaskAssigned(prev => prev.filter(u => u !== m.username));
                            } else {
                              setTaskAssigned(prev => [...prev, m.username]);
                            }
                          }}
                        />
                        {m.username}
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Checklist Items (Comma separated)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={taskChecklistText}
                    onChange={e => {
                      setTaskChecklistText(e.target.value);
                      const items = e.target.value.split(',').filter(x => x.trim()).map(x => ({
                        id: Math.random().toString(36).substring(2, 9),
                        text: x.trim(),
                        completed: false
                      }));
                      setTaskChecklist(items);
                    }}
                    placeholder="e.g. Draft UI mockup, Create asset files, Review content"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn-primary">Create Task</button>
                <button type="button" className="btn-secondary" onClick={() => setShowTaskForm(false)}>Cancel</button>
              </div>
            </form>
          </GlassCard>
        )}

        {/* Kanban Board Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem' }} id="kanban-columns">
          {columns.map(col => {
            const colTasks = tasks.filter(t => t.status === col);
            return (
              <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '400px', background: 'rgba(0,0,0,0.12)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{getColumnTitle(col)}</h4>
                  <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(0,0,0,0.2)', fontWeight: 800 }}>{colTasks.length}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, overflowY: 'auto' }}>
                  {colTasks.map(t => (
                    <GlassCard 
                      key={t.id} 
                      onClick={() => setSelectedTask(t)}
                      style={{ padding: '1.25rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px' }}
                      hoverEffect
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ 
                          fontSize: '0.65rem', 
                          fontWeight: 700, 
                          padding: '2px 6px', 
                          borderRadius: '4px',
                          background: t.priority === 'high' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.06)',
                          color: t.priority === 'high' ? '#ef4444' : 'var(--text-secondary)'
                        }}>{t.priority.toUpperCase()}</span>
                        <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                          <Clock size={10} style={{ color: 'var(--text-tertiary)' }} />
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{t.dueDate}</span>
                        </div>
                      </div>

                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>{t.title}</h4>
                      {t.description && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineClamp: 2, overflow: 'hidden' }}>{t.description}</p>
                      )}

                      {/* Checklist progress */}
                      {t.checklist && t.checklist.length > 0 && (
                        <div style={{ width: '100%', marginTop: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-tertiary)', marginBottom: '2px' }}>
                            <span>Progress</span>
                            <span>{t.progress}%</span>
                          </div>
                          <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: `${t.progress}%`, height: '100%', background: 'var(--accent-gradient)' }} />
                          </div>
                        </div>
                      )}

                      {/* Footer assignees */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '6px' }}>
                        <div style={{ display: 'flex', gap: '-6px' }}>
                          {t.assignedUsers && t.assignedUsers.map(user => (
                            <span 
                              key={user} 
                              title={user}
                              style={{ 
                                width: '22px', 
                                height: '22px', 
                                borderRadius: '50%', 
                                background: 'var(--accent-gradient)', 
                                border: '1px solid var(--bg-card)', 
                                fontSize: '0.6rem', 
                                fontWeight: 800, 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                color: 'white',
                                marginRight: '-6px'
                              }}
                            >
                              {user.substring(0, 2).toUpperCase()}
                            </span>
                          ))}
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {t.comments && t.comments.length > 0 && (
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                              <MessageSquare size={11} /> {t.comments.length}
                            </span>
                          )}
                          {t.status !== 'completed' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCompleteTask(t.id);
                              }}
                              style={{
                                border: 'none',
                                background: 'rgba(16, 185, 129, 0.15)',
                                color: 'var(--color-working)',
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '6px',
                                cursor: 'pointer'
                              }}
                            >
                              ✓ Done
                            </button>
                          )}
                        </div>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 2. Goals Tab
  function renderGoalsTab() {
    const isLead = activeGroup?.myRole === 'owner' || activeGroup?.myRole === 'admin';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Shared Goals & Milestones</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Track long term goals and verify milestones checklist.</p>
          </div>
          {isLead && (
            <button className="btn-primary" onClick={() => setShowGoalForm(true)}><Plus size={16} /> Add Goal</button>
          )}
        </div>

        {/* Goal Form collapse */}
        {showGoalForm && (
          <GlassCard style={{ padding: '1.5rem' }}>
            <h4 style={{ fontWeight: 800, marginBottom: '1rem' }}>Create Workspace Goal</h4>
            <form onSubmit={handleCreateGoal} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }} id="goal-grid-cols">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Goal Title</label>
                  <input type="text" className="form-input" value={goalTitle} onChange={e => setGoalTitle(e.target.value)} placeholder="e.g. Q3 Server Optimization" required />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Deadline</label>
                  <input type="date" className="form-input" value={goalDeadline} onChange={e => setGoalDeadline(e.target.value)} required />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Description</label>
                <textarea className="form-input" value={goalDesc} onChange={e => setGoalDesc(e.target.value)} placeholder="Describe the goal metrics..." rows={2} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} id="goal-sub-cols">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Milestones (Comma separated list)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={goalMilestoneText} 
                    onChange={e => {
                      setGoalMilestoneText(e.target.value);
                      const milestones = e.target.value.split(',').filter(x => x.trim()).map(x => ({
                        id: Math.random().toString(36).substring(2, 9),
                        text: x.trim(),
                        completed: false
                      }));
                      setGoalMilestones(milestones);
                    }}
                    placeholder="e.g. Setup database indexes, Optimize node caching, Complete benchmarking" 
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Assign Members</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '100px', overflowY: 'auto', padding: '6px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                    {members.map(m => (
                      <label key={m.username} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '2px 6px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={goalAssigned.includes(m.username)}
                          onChange={() => {
                            if (goalAssigned.includes(m.username)) {
                              setGoalAssigned(prev => prev.filter(u => u !== m.username));
                            } else {
                              setGoalAssigned(prev => [...prev, m.username]);
                            }
                          }}
                        />
                        {m.username}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn-primary">Create Goal</button>
                <button type="button" className="btn-secondary" onClick={() => setShowGoalForm(false)}>Cancel</button>
              </div>
            </form>
          </GlassCard>
        )}

        {/* Goals List */}
        {goals.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No active workspace goals defined.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {goals.map(goal => (
              <GlassCard key={goal.id} style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h4 style={{ fontSize: '1.15rem', fontWeight: 800 }}>{goal.title}</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>{goal.description}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-tertiary)', background: 'rgba(0,0,0,0.15)', padding: '4px 10px', borderRadius: '8px' }}>
                    <Calendar size={14} />
                    <span>{goal.deadline} ({getRemainingDays(goal.deadline)})</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    <span>Completion Rate</span>
                    <span>{goal.progress}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${goal.progress}%`, height: '100%', background: 'var(--accent-gradient)' }} />
                  </div>
                </div>

                {/* Milestones checklist columns */}
                {goal.milestones && goal.milestones.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
                    <h5 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>Milestones Checklist</h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
                      {goal.milestones.map(milestone => (
                        <label key={milestone.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', padding: '8px 12px', background: 'rgba(0,0,0,0.1)', borderRadius: '8px', cursor: 'pointer', transition: 'background var(--transition-fast)' }} className="glass-panel-hover">
                          <input 
                            type="checkbox" 
                            checked={milestone.completed} 
                            onChange={() => handleGoalMilestoneToggle(goal, milestone.id)}
                            style={{ accentColor: 'var(--accent-primary)' }}
                          />
                          <span style={{ textDecoration: milestone.completed ? 'line-through' : 'none', color: milestone.completed ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>{milestone.text}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Assignees */}
                {goal.assignedMembers && goal.assignedMembers.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-tertiary)', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '0.75rem' }}>
                    <span>Assigned Members:</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {goal.assignedMembers.map(user => (
                        <span key={user} style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(168,85,247,0.1)', color: 'var(--accent-primary)', fontWeight: 600 }}>{user}</span>
                      ))}
                    </div>
                  </div>
                )}
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    );
  }

  // 3. Members Tab
  function renderMembersTab() {
    const isOwner = activeGroup?.myRole === 'owner';
    const isAdmin = activeGroup?.myRole === 'owner' || activeGroup?.myRole === 'admin';

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: '2rem' }} id="members-layout">
        {/* Left list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Workspace Roster</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {members.map(m => (
              <GlassCard key={m.username} style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800 }}>
                    {m.username.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>{m.username}</h4>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Joined: {new Date(m.joinedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  {editingRoleUser === m.username ? (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <select 
                        className="form-input" 
                        value={newRole} 
                        onChange={e => setNewRole(e.target.value as any)}
                        style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                      >
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                      </select>
                      <button onClick={() => handleUpdateRole(m.username)} style={{ border: 'none', background: 'var(--color-working)', color: 'white', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}>Save</button>
                      <button onClick={() => setEditingRoleUser(null)} style={{ border: 'none', background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  ) : (
                    <>
                      <span style={{ 
                        fontSize: '0.75rem', 
                        fontWeight: 700, 
                        color: m.role === 'owner' ? '#fbbf24' : m.role === 'admin' ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {m.role === 'owner' && <Crown size={12} />}
                        {m.role.toUpperCase()}
                      </span>

                      {/* Owner actions */}
                      {isOwner && m.role !== 'owner' && (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button 
                            onClick={() => {
                              setEditingRoleUser(m.username);
                              setNewRole(m.role as any);
                            }}
                            style={{ border: 'none', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            Edit Role
                          </button>
                          <button 
                            onClick={() => handleRemoveMember(m.username)}
                            style={{ border: 'none', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            Remove
                          </button>
                        </div>
                      )}

                      {/* Admin actions (remove members, but not admins/owner) */}
                      {isAdmin && !isOwner && m.role === 'member' && (
                        <button 
                          onClick={() => handleRemoveMember(m.username)}
                          style={{ border: 'none', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Remove
                        </button>
                      )}
                    </>
                  )}
                </div>
              </GlassCard>
            ))}
          </div>
        </div>

        {/* Right configuration tools */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Workspace Tools</h3>
          
          {/* Owner options */}
          {isOwner ? (
            <GlassCard style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}><Crown size={16} style={{ color: '#fbbf24' }} /> Owner Actions</h4>
              
              {!showTransferForm ? (
                <button className="btn-secondary" onClick={() => setShowTransferForm(true)} style={{ width: '100%' }}>Transfer Ownership</button>
              ) : (
                <form onSubmit={handleTransferOwnership} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Target Username</label>
                  <select 
                    className="form-input" 
                    value={transferTarget} 
                    onChange={e => setTransferTarget(e.target.value)}
                    required
                  >
                    <option value="">Select members...</option>
                    {members.filter(m => m.username.toLowerCase() !== currentUser?.username.toLowerCase()).map(m => (
                      <option key={m.username} value={m.username}>{m.username}</option>
                    ))}
                  </select>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                    <button type="submit" className="btn-primary" style={{ flex: 1, padding: '6px' }}>Transfer</button>
                    <button type="button" className="btn-secondary" style={{ flex: 1, padding: '6px' }} onClick={() => setShowTransferForm(false)}>Cancel</button>
                  </div>
                </form>
              )}
            </GlassCard>
          ) : (
            <GlassCard style={{ padding: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <ShieldCheck size={18} style={{ color: 'var(--accent-primary)' }} />
              <span>You are logged in as a <strong>{activeGroup?.myRole.toUpperCase()}</strong>. Group settings are managed by the owner.</span>
            </GlassCard>
          )}

          {/* Guidelines */}
          <GlassCard style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 800 }}>Role Definitions</h4>
            <div style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)' }}>
              <div>• <strong>Owner</strong>: Manage members, delete workspace, transfer ownership, assign admins, and edit settings.</div>
              <div>• <strong>Admin</strong>: Create tasks, assign goals, edit timeline items, manage checklists.</div>
              <div>• <strong>Member</strong>: View cards, complete checklists on assigned tasks, comment on cards.</div>
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  // 4. Activity Tab
  function renderActivityTab() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Activity Timeline</h3>
        
        {activities.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No recent workspace activities recorded.</div>
        ) : (
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '1rem', paddingLeft: '1.5rem' }}>
            {/* Timeline vertical bar */}
            <div style={{ position: 'absolute', top: '10px', bottom: '10px', left: '4px', width: '2px', background: 'var(--border-glass)' }} />

            {activities.map(act => (
              <div key={act.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {/* timeline dot */}
                <div style={{ position: 'absolute', left: '-22px', top: '5px', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent-primary)', border: '2px solid var(--bg-card)' }} />
                
                <div style={{ fontSize: '0.85rem' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{act.username}</strong>{' '}
                  <span style={{ color: 'var(--text-secondary)' }}>{act.action}</span>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={11} />
                  {new Date(act.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // 5. AI Group Insights Tab
  function renderAiTab() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}><Sparkles size={20} style={{ color: 'var(--accent-primary)' }} /> AI Team Analytics</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Generate insights on workload distributions, delayed tasks, and burnout flags.</p>
          </div>
          <button 
            onClick={handleGenerateAiInsights} 
            disabled={aiLoading} 
            className="btn-primary" 
            style={{ gap: '6px' }}
          >
            <Sparkles size={15} /> Re-Evaluate Team
          </button>
        </div>

        <GlassCard style={{ padding: '2rem' }}>
          {aiLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', gap: '1rem' }}>
              <Sparkles size={32} className="animate-pulse" style={{ color: 'var(--accent-primary)' }} />
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Analyzing workloads & task completions...</span>
            </div>
          ) : !aiInsights ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>Click "Re-Evaluate Team" to run the evaluation algorithms.</div>
          ) : (
            <div style={{ padding: '0.5rem' }}>
              {/* Render Markdown heuristics */}
              <div style={{ lineHeight: '1.7', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                {aiInsights.split('\n').map((line, idx) => {
                  if (line.startsWith('### ')) {
                    return <h4 key={idx} style={{ fontSize: '1.15rem', margin: '1.25rem 0 0.5rem 0', color: 'var(--text-primary)', fontWeight: 700 }}>{line.replace('### ', '')}</h4>;
                  }
                  if (line.startsWith('## ')) {
                    return <h3 key={idx} style={{ fontSize: '1.3rem', margin: '1.5rem 0 0.75rem 0', color: 'var(--text-primary)', fontWeight: 700 }}>{line.replace('## ', '')}</h3>;
                  }
                  if (line.startsWith('# ')) {
                    return <h2 key={idx} style={{ fontSize: '1.5rem', margin: '1.75rem 0 1rem 0', color: 'var(--text-primary)', fontWeight: 800 }}>{line.replace('# ', '')}</h2>;
                  }
                  if (line.startsWith('* ') || line.startsWith('- ')) {
                    return <li key={idx} style={{ marginLeft: '1.25rem', marginBottom: '0.5rem' }}>{parseBoldText(line.substring(2))}</li>;
                  }
                  if (!line.trim()) return <div key={idx} style={{ height: '0.75rem' }} />;
                  return <p key={idx} style={{ marginBottom: '0.75rem' }}>{parseBoldText(line)}</p>;
                })}
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    );
  }

  function parseBoldText(text: string) {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    if (parts.length === 1) return text;
    
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return <strong key={index} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{part}</strong>;
      }
      return part;
    });
  }
};
