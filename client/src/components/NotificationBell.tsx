import React, { useState, useEffect, useRef } from 'react';
import { Bell, Trash2, CheckCheck, Inbox, Search } from 'lucide-react';
import { api } from '../api.js';
import { 
  subscribeToSocketEvent, 
  unsubscribeFromSocketEvent, 
  playNotificationSound, 
  triggerBrowserNotification 
} from '../services/socketService.js';

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  read: boolean;
  createdAt: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  metadata?: any;
}

interface NotificationBellProps {
  onAddToast: (title: string, desc: string, type: 'success' | 'info' | 'warning') => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onAddToast }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [isShaking, setIsShaking] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notifications list
  const fetchNotifications = async () => {
    try {
      const res = await api.notifications.list();
      if (res && res.notifications) {
        setNotifications(res.notifications);
        const unread = res.notifications.filter((n: any) => !n.read).length;
        setUnreadCount(unread);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Check & request browser notification permissions
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Subscribe to Socket.IO events
    const handleNewNotification = (notif: NotificationItem) => {
      // Shake bell
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 1200);

      // Play synthesized audio
      playNotificationSound();

      // Trigger native browser notification if tab minimized
      if (document.hidden) {
        triggerBrowserNotification(notif.title, notif.description, notif.metadata);
      }

      // Add floating toast
      onAddToast(notif.title, notif.description, 'info');

      // Update state
      setNotifications(prev => [notif, ...prev]);
      setUnreadCount(prev => prev + 1);
    };

    subscribeToSocketEvent('notification_added', handleNewNotification);

    // Handle clicks outside of dropdown
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);

    return () => {
      unsubscribeFromSocketEvent('notification_added', handleNewNotification);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const markAllRead = async () => {
    try {
      await api.notifications.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      onAddToast('Success', 'All notifications marked as read', 'success');
    } catch (err) {
      console.error('Mark all read error:', err);
    }
  };

  const markRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.notifications.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Mark read error:', err);
    }
  };

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const target = notifications.find(n => n.id === id);
      await api.notifications.delete(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (target && !target.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Delete notification error:', err);
    }
  };

  // Grouping notifications helper
  const groupNotifications = (list: NotificationItem[]) => {
    const today: NotificationItem[] = [];
    const yesterday: NotificationItem[] = [];
    const older: NotificationItem[] = [];

    const now = new Date();
    const todayDate = now.toDateString();
    
    const yesterdayDate = new Date();
    yesterdayDate.setDate(now.getDate() - 1);
    const yesterdayStr = yesterdayDate.toDateString();

    list.forEach(item => {
      const itemDate = new Date(item.createdAt).toDateString();
      if (itemDate === todayDate) {
        today.push(item);
      } else if (itemDate === yesterdayStr) {
        yesterday.push(item);
      } else {
        older.push(item);
      }
    });

    return { today, yesterday, older };
  };

  // Apply search query and category filtering
  const filtered = notifications.filter(n => {
    const matchesSearch = n.title.toLowerCase().includes(search.toLowerCase()) || 
                          n.description.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || n.category.toLowerCase() === filter.toLowerCase();
    return matchesSearch && matchesFilter;
  });

  const { today, yesterday, older } = groupNotifications(filtered);

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          border: '1px solid var(--border-glass)',
          background: 'var(--bg-input)',
          color: 'var(--text-primary)',
          padding: '0.6rem',
          borderRadius: '10px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          transition: 'all var(--transition-fast)'
        }}
        className={`bell-icon ${isShaking ? 'shake' : ''}`}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              background: '#ef4444',
              color: 'white',
              fontSize: '0.65rem',
              fontWeight: 800,
              padding: '2px 6px',
              borderRadius: '50%',
              boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)',
              animation: 'pulseBadge 2s infinite ease-in-out'
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className="glass-panel"
          style={{
            position: 'absolute',
            top: 'calc(100% + 12px)',
            right: 0,
            width: '380px',
            maxHeight: '520px',
            zIndex: 1000,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeInSlide 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            padding: '1.25rem 0'
          }}
        >
          {/* Dropdown Header */}
          <div style={{ padding: '0 1.25rem 1rem 1.25rem', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Notifications</h4>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--accent-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>

          {/* Search and Filters */}
          <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border-glass)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {/* Search Input */}
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', padding: '4px 8px', border: '1px solid var(--border-glass)' }}>
              <Search size={14} style={{ color: 'var(--text-tertiary)', marginRight: '6px' }} />
              <input
                type="text"
                placeholder="Search alerts..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  outline: 'none',
                  width: '100%'
                }}
              />
            </div>
            {/* Category Pills */}
            <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '2px' }}>
              {['all', 'reminder', 'task', 'goal', 'group'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  style={{
                    border: 'none',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    textTransform: 'capitalize',
                    cursor: 'pointer',
                    background: filter === cat ? 'var(--accent-gradient)' : 'var(--bg-input)',
                    color: filter === cat ? 'white' : 'var(--text-secondary)'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Notifications Scroll Area */}
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '340px' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-tertiary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <Inbox size={32} />
                <span style={{ fontSize: '0.85rem' }}>All caught up! No notifications.</span>
              </div>
            ) : (
              <>
                {/* Render Today */}
                {today.length > 0 && (
                  <div>
                    <div style={{ padding: '6px 1.25rem', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-tertiary)', background: 'rgba(0,0,0,0.05)' }}>Today</div>
                    {today.map(n => renderNotificationRow(n))}
                  </div>
                )}
                {/* Render Yesterday */}
                {yesterday.length > 0 && (
                  <div>
                    <div style={{ padding: '6px 1.25rem', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-tertiary)', background: 'rgba(0,0,0,0.05)' }}>Yesterday</div>
                    {yesterday.map(n => renderNotificationRow(n))}
                  </div>
                )}
                {/* Render Older */}
                {older.length > 0 && (
                  <div>
                    <div style={{ padding: '6px 1.25rem', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-tertiary)', background: 'rgba(0,0,0,0.05)' }}>Older</div>
                    {older.map(n => renderNotificationRow(n))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Styled animation frames */}
      <style>{`
        @keyframes pulseBadge {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.95; }
        }
        @keyframes fadeInSlide {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .shake {
          animation: shakeBell 0.8s ease-in-out;
        }
        @keyframes shakeBell {
          0% { transform: rotate(0); }
          15% { transform: rotate(10deg); }
          30% { transform: rotate(-10deg); }
          45% { transform: rotate(8deg); }
          60% { transform: rotate(-8deg); }
          75% { transform: rotate(4deg); }
          85% { transform: rotate(-4deg); }
          100% { transform: rotate(0); }
        }
      `}</style>
    </div>
  );

  // Render individual notification row
  function renderNotificationRow(n: NotificationItem) {
    return (
      <div
        key={n.id}
        style={{
          padding: '0.9rem 1.25rem',
          borderBottom: '1px solid var(--border-glass)',
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'flex-start',
          background: n.read ? 'transparent' : 'rgba(168, 85, 247, 0.04)',
          position: 'relative',
          transition: 'background var(--transition-fast)'
        }}
        className="glass-panel-hover"
      >
        {/* Category Indicator Dot */}
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: n.priority === 'high' ? '#ef4444' : 'var(--accent-primary)',
            marginTop: '5px',
            flexShrink: 0
          }}
        />

        <div style={{ flex: 1 }}>
          <h5 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{n.title}</h5>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.4' }}>{n.description}</p>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '4px', display: 'block' }}>
            {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Action icons */}
        <div style={{ display: 'flex', gap: '4px', alignSelf: 'center' }}>
          {!n.read && (
            <button
              onClick={(e) => markRead(n.id, e)}
              title="Mark as read"
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--accent-primary)' }}
            >
              <CheckCheck size={14} />
            </button>
          )}
          <button
            onClick={(e) => deleteNotification(n.id, e)}
            title="Delete notification"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-tertiary)' }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    );
  }
};
