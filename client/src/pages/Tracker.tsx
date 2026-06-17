import React, { useState, useEffect } from 'react';
import { Play, Pause, Square, CheckCircle, FileText, Star, AlertTriangle } from 'lucide-react';
import { GlassCard } from '../components/GlassCard.js';
import { api } from '../api.js';

interface TrackerProps {
  status: 'Working' | 'On Break' | 'Offline';
  setStatus: (status: 'Working' | 'On Break' | 'Offline') => void;
  session: any;
  setSession: (session: any) => void;
  refreshSession: () => Promise<void>;
}

export const Tracker: React.FC<TrackerProps> = ({
  status,
  setStatus,
  session,
  setSession,
  refreshSession
}) => {
  const [workTimer, setWorkTimer] = useState('00:00:00');
  const [breakTimer, setBreakTimer] = useState('00:00:00');
  const [notes, setNotes] = useState('');
  const [rating, setRating] = useState(0);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [showEndWorkConfirm, setShowEndWorkConfirm] = useState(false);
  
  // Forgotten session recovery state
  const [showForgottenModal, setShowForgottenModal] = useState(false);
  const [forgottenSessionData, setForgottenSessionData] = useState<any>(null);
  const [forgottenEndTime, setForgottenEndTime] = useState('17:00');
  const [isResolving, setIsResolving] = useState(false);
  
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');

  // Load session notes, tasks, and ratings when session changes
  useEffect(() => {
    if (session) {
      setNotes(session.notes || '');
      setRating(session.rating || 0);
      setCompletedTasks(session.completedTasks || []);
    } else {
      setNotes('');
      setRating(0);
      setCompletedTasks([]);
    }
  }, [session]);

  // Check for forgotten sessions on load
  useEffect(() => {
    const checkForgottenSession = async () => {
      try {
        const response = await api.session.getCurrent();
        if (response.forgotten && response.session) {
          setForgottenSessionData(response.session);
          setShowForgottenModal(true);
          
          // Default forgotten end time calculation (8 hours from start)
          const start = new Date(response.session.workStart);
          start.setHours(start.getHours() + 8);
          const hrs = start.getHours().toString().padStart(2, '0');
          const mins = start.getMinutes().toString().padStart(2, '0');
          setForgottenEndTime(`${hrs}:${mins}`);
        }
      } catch (err) {
        console.error('Failed to query forgotten sessions:', err);
      }
    };
    checkForgottenSession();
  }, []);

  // Format milliseconds into HH:MM:SS
  const formatTime = (ms: number): string => {
    if (ms <= 0) return '00:00:00';
    const totalSecs = Math.floor(ms / 1000);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format duration between two timestamps
  const formatDuration = (startStr: string, endStr: string | null): string => {
    const start = new Date(startStr).getTime();
    const end = endStr ? new Date(endStr).getTime() : new Date().getTime();
    const diffMs = end - start;
    if (diffMs <= 0) return '0s';
    const totalSecs = Math.floor(diffMs / 1000);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  // Timer Tick Hook
  useEffect(() => {
    let interval: any;

    if (session && status !== 'Offline') {
      interval = setInterval(() => {
        const now = new Date().getTime();
        const start = new Date(session.workStart).getTime();
        
        // Sum completed breaks
        let completedBreaksMs = 0;
        session.breaks.forEach((b: any) => {
          if (b.end) {
            completedBreaksMs += (new Date(b.end).getTime() - new Date(b.start).getTime());
          }
        });

        if (status === 'Working') {
          // Work Timer ticks up: (now - workStart) - completedBreaksMs
          const workMs = (now - start) - completedBreaksMs;
          setWorkTimer(formatTime(workMs));
          setBreakTimer(formatTime(completedBreaksMs));
        } else if (status === 'On Break') {
          // Find the active break
          const activeBreak = session.breaks.find((b: any) => !b.end);
          if (activeBreak) {
            const activeBreakStart = new Date(activeBreak.start).getTime();
            const activeBreakMs = now - activeBreakStart;
            
            // Break timer is sum of completed + active break
            setBreakTimer(formatTime(completedBreaksMs + activeBreakMs));
            
            // Work timer stays frozen at the time work was suspended
            const workMs = (activeBreakStart - start) - completedBreaksMs;
            setWorkTimer(formatTime(workMs));
          }
        }
      }, 1000);
    } else {
      // Set to final session parameters or 0
      if (session && session.workStart && session.workEnd) {
        const start = new Date(session.workStart).getTime();
        const end = new Date(session.workEnd).getTime();
        const total = end - start;
        let breakMs = 0;
        session.breaks.forEach((b: any) => {
          if (b.end) {
            breakMs += (new Date(b.end).getTime() - new Date(b.start).getTime());
          }
        });
        setWorkTimer(formatTime(Math.max(0, total - breakMs)));
        setBreakTimer(formatTime(breakMs));
      } else {
        setWorkTimer('00:00:00');
        setBreakTimer('00:00:00');
      }
    }

    return () => clearInterval(interval);
  }, [session, status]);

  // Session Control handlers
  const handleStartWork = async () => {
    try {
      const response = await api.session.start();
      setSession(response.session);
      setStatus('Working');
      await refreshSession();
    } catch (err: any) {
      alert(err.message || 'Failed to start work session');
    }
  };

  const handleStartBreak = async () => {
    try {
      const response = await api.session.breakStart();
      setSession(response.session);
      setStatus('On Break');
      await refreshSession();
    } catch (err: any) {
      alert(err.message || 'Failed to start break');
    }
  };

  const handleEndBreak = async () => {
    try {
      const response = await api.session.breakEnd();
      setSession(response.session);
      setStatus('Working');
      await refreshSession();
    } catch (err: any) {
      alert(err.message || 'Failed to end break');
    }
  };

  const handleEndWorkClick = () => {
    setShowEndWorkConfirm(true);
  };

  const handleEndWorkConfirm = async () => {
    setShowEndWorkConfirm(false);
    try {
      const response = await api.session.end();
      setSession(response.session);
      setStatus('Offline');
      await refreshSession();
    } catch (err: any) {
      alert(err.message || 'Failed to end work session');
    }
  };

  // Resolve Forgotten Session
  const handleResolveForgotten = async (action: 'close' | 'discard') => {
    setIsResolving(true);
    try {
      await api.session.resolveForgotten(action, action === 'close' ? forgottenEndTime : undefined);
      setShowForgottenModal(false);
      setForgottenSessionData(null);
      await refreshSession();
    } catch (err: any) {
      alert(err.message || 'Failed to resolve forgotten session');
    } finally {
      setIsResolving(false);
    }
  };

  // Productivity autosave trigger (triggers on save button or blurs)
  const saveProductivity = async (customNotes = notes, customRating = rating, customTasks = completedTasks) => {
    if (!session) return;
    setSaveStatus('saving');
    try {
      const response = await api.productivity.update({
        date: session.date,
        notes: customNotes,
        rating: customRating,
        completedTasks: customTasks
      });
      // Update session locally
      setSession(response.session);
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to auto-save productivity:', err);
      setSaveStatus('error');
    }
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    const updated = [...completedTasks, newTaskText.trim()];
    setCompletedTasks(updated);
    setNewTaskText('');
    saveProductivity(notes, rating, updated);
  };

  const handleRemoveTask = (index: number) => {
    const updated = completedTasks.filter((_, i) => i !== index);
    setCompletedTasks(updated);
    saveProductivity(notes, rating, updated);
  };

  const handleRatingSelect = (rate: number) => {
    setRating(rate);
    saveProductivity(notes, rate, completedTasks);
  };

  const handleNotesBlur = () => {
    saveProductivity(notes, rating, completedTasks);
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Dynamic Status Banner */}
      <GlassCard
        className="glass-panel"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.5rem',
          padding: '2rem',
          borderLeft: `5px solid ${status === 'Working' ? 'var(--color-working)' : status === 'On Break' ? 'var(--color-break)' : session && session.workStart ? 'var(--color-working)' : 'var(--color-offline)'}`
        }}
      >
        <div>
          <span
            style={{
              textTransform: 'uppercase',
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: status === 'Working' ? 'var(--color-working)' : status === 'On Break' ? 'var(--color-break)' : session && session.workStart ? 'var(--color-working)' : 'var(--text-tertiary)'
            }}
          >
            System Status
          </span>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.25rem' }}>
            {status === 'Working' ? 'Focus Session Active' : status === 'On Break' ? 'Decompressing (On Break)' : session && session.workStart ? 'Daily Session Completed' : 'System Offline'}
          </h1>
          {session && session.workStart && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              Date: <strong>{session.date}</strong> | Start: {new Date(session.workStart).toLocaleTimeString()} {session.workEnd && `| End: ${new Date(session.workEnd).toLocaleTimeString()}`}
            </p>
          )}
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {status === 'Offline' && (
            session && session.workStart ? (
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem', 
                  padding: '0.75rem 1.25rem', 
                  background: 'rgba(16, 185, 129, 0.1)', 
                  border: '1px solid rgba(16, 185, 129, 0.2)', 
                  borderRadius: '8px', 
                  color: '#10b981', 
                  fontWeight: 700, 
                  fontSize: '0.9rem',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                ✓ Daily Session Completed
              </div>
            ) : (
              <button className="btn-primary" onClick={handleStartWork} style={{ background: 'var(--color-working)', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)' }}>
                <Play size={18} /> Start Work
              </button>
            )
          )}

          {status === 'Working' && (
            <>
              <button className="btn-secondary" onClick={handleStartBreak} style={{ color: 'var(--color-break)' }}>
                <Pause size={18} /> Start Break
              </button>
              <button className="btn-primary" onClick={handleEndWorkClick} style={{ background: '#ef4444', boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)' }}>
                <Square size={16} /> End Work
              </button>
            </>
          )}

          {status === 'On Break' && (
            <>
              <button className="btn-primary" onClick={handleEndBreak} style={{ background: 'var(--color-working)', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)' }}>
                <Play size={18} /> End Break
              </button>
              <button className="btn-secondary" onClick={handleEndWorkClick} style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <Square size={16} /> End Work
              </button>
            </>
          )}
        </div>
      </GlassCard>

      {/* Dual Timers Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }} id="timers-grid">
        <GlassCard style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2.5rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
            Effective Working Hours
          </span>
          <span style={{ fontSize: '3.5rem', fontWeight: 800, fontFamily: 'monospace', margin: '1rem 0', color: 'var(--text-primary)' }}>
            {workTimer}
          </span>
          <div style={{ width: '100%', height: '4px', background: 'rgba(99, 102, 241, 0.15)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: status === 'Working' ? '100%' : '0%', height: '100%', background: 'var(--accent-gradient)', transition: 'width 0.5s' }} />
          </div>
        </GlassCard>

        <GlassCard style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2.5rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
            Total Break Time
          </span>
          <span style={{ fontSize: '3.5rem', fontWeight: 800, fontFamily: 'monospace', margin: '1rem 0', color: status === 'On Break' ? 'var(--color-break)' : 'var(--text-secondary)' }}>
            {breakTimer}
          </span>
          <div style={{ width: '100%', height: '4px', background: 'rgba(245, 158, 11, 0.15)', borderRadius: '2px', overflow: 'hidden', marginBottom: session && session.breaks && session.breaks.length > 0 ? '1.5rem' : '0' }}>
            <div style={{ width: status === 'On Break' ? '100%' : '0%', height: '100%', background: 'var(--color-break)', transition: 'width 0.5s' }} />
          </div>

          {session && session.breaks && session.breaks.length > 0 && (
            <div style={{ width: '100%', borderTop: '1px solid var(--border-glass)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between' }}>
                <span>Break Laps</span>
                <span style={{ color: 'var(--color-break)', textTransform: 'none', fontWeight: 500 }}>
                  {session.breaks.length} {session.breaks.length === 1 ? 'break' : 'breaks'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                {session.breaks.map((b: any, idx: number) => {
                  const duration = formatDuration(b.start, b.end);
                  const startLocal = new Date(b.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  const endLocal = b.end 
                    ? new Date(b.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : 'Active';
                  return (
                    <div 
                      key={idx} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '0.6rem 0.75rem', 
                        background: b.end ? 'rgba(255, 255, 255, 0.02)' : 'rgba(245, 158, 11, 0.08)', 
                        border: '1px solid var(--border-glass)', 
                        borderRadius: '6px',
                        fontSize: '0.85rem'
                      }}
                    >
                      <span style={{ fontWeight: 600, color: b.end ? 'var(--text-secondary)' : 'var(--color-break)' }}>
                        Lap {idx + 1} {!b.end && '⏱️'}
                      </span>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
                        {startLocal} - {endLocal}
                      </span>
                      <span style={{ fontWeight: 700, color: b.end ? 'var(--text-primary)' : 'var(--color-break)' }}>
                        {duration}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Daily Logs & Productivity Inputs */}
      {session && (
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '1.5rem' }} id="logs-grid">
          
          {/* Notes & Tasks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <GlassCard>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem' }}>
                  <FileText size={18} /> Daily Work Notes
                </h3>
                <span style={{ fontSize: '0.75rem', color: saveStatus === 'saving' ? 'var(--color-break)' : saveStatus === 'error' ? '#ef4444' : 'var(--color-working)' }}>
                  {saveStatus === 'saving' ? 'Saving changes...' : saveStatus === 'error' ? 'Connection Error' : 'Auto-saved'}
                </span>
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleNotesBlur}
                placeholder="Log notes, breakthroughs, links, or issues encountered today..."
                className="form-input"
                style={{
                  width: '100%',
                  minHeight: '200px',
                  resize: 'vertical',
                  fontSize: '0.95rem',
                  lineHeight: '1.6'
                }}
              />
            </GlassCard>

            <GlassCard>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem', marginBottom: '1rem' }}>
                <CheckCircle size={18} /> Completed Tasks
              </h3>
              
              <form onSubmit={handleAddTask} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <input
                  type="text"
                  placeholder="What did you complete?"
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  className="form-input"
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn-secondary" style={{ padding: '0.75rem' }}>Add</button>
              </form>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {completedTasks.length === 0 ? (
                  <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>
                    No tasks marked completed today. Add them as you finish!
                  </p>
                ) : (
                  completedTasks.map((task, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem 1rem',
                        background: 'rgba(0, 0, 0, 0.02)',
                        border: '1px solid var(--border-glass)',
                        borderRadius: '8px'
                      }}
                    >
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>✓ {task}</span>
                      <button
                        onClick={() => handleRemoveTask(idx)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontSize: '0.8rem'
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </GlassCard>
          </div>

          {/* Rating */}
          <GlassCard style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: 'fit-content' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem' }}>
              <Star size={18} /> Daily Productivity Rating
            </h3>
            
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              On a scale from 1 (severe fatigue/distraction) to 10 (peak focus and achievements), rate your flow state:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                const isSelected = rating === num;
                return (
                  <button
                    key={num}
                    onClick={() => handleRatingSelect(num)}
                    style={{
                      height: '42px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: isSelected ? 'none' : '1px solid var(--border-glass)',
                      borderRadius: '8px',
                      background: isSelected ? 'var(--accent-gradient)' : 'var(--bg-input)',
                      color: isSelected ? 'white' : 'var(--text-primary)',
                      fontFamily: 'var(--font-title)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 4px 10px rgba(168, 85, 247, 0.25)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {num}
                  </button>
                );
              })}
            </div>

            <div
              style={{
                marginTop: '1rem',
                padding: '1rem',
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.05)',
                border: '1px solid var(--border-glass)',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Focus Rating</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                {rating > 0 ? `${rating} / 10` : 'Not Rated'}
              </div>
            </div>
          </GlassCard>

        </div>
      )}

      {/* Forgotten Session Recovery Overlay Modal */}
      {showForgottenModal && forgottenSessionData && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.5rem'
          }}
        >
          <GlassCard
            style={{
              width: '100%',
              maxWidth: '500px',
              padding: '2.5rem 2rem',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid rgba(239, 68, 68, 0.2)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#f59e0b', marginBottom: '1rem' }}>
              <AlertTriangle size={32} />
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Forgotten Session Detected</h2>
            </div>
            
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              You left a work session active from <strong>{forgottenSessionData.date}</strong>. 
              The session was started at <strong>{new Date(forgottenSessionData.workStart).toLocaleTimeString()}</strong> but was not finalized.
            </p>

            <div
              style={{
                background: 'var(--bg-input)',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid var(--border-glass)',
                marginBottom: '1.5rem'
              }}
            >
              <label htmlFor="end-time-input" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
                Set Retroactive End Time (HH:MM)
              </label>
              <input
                id="end-time-input"
                type="time"
                value={forgottenEndTime}
                onChange={(e) => setForgottenEndTime(e.target.value)}
                className="form-input"
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                disabled={isResolving}
                onClick={() => handleResolveForgotten('close')}
                className="btn-primary"
                style={{ flex: 1, background: 'var(--color-working)', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)' }}
              >
                Close Session
              </button>
              
              <button
                disabled={isResolving}
                onClick={() => handleResolveForgotten('discard')}
                className="btn-secondary"
                style={{ flex: 1, color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
              >
                Discard Session
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {showEndWorkConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.5rem'
          }}
        >
          <GlassCard
            style={{
              width: '100%',
              maxWidth: '400px',
              padding: '2rem',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              textAlign: 'center'
            }}
          >
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '1rem', color: '#ef4444' }}>End Work Session</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              Are you ready to end your work session for today? This will finalize your daily totals and log your completed tasks.
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={handleEndWorkConfirm}
                className="btn-primary"
                style={{ flex: 1, background: '#ef4444', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)' }}
              >
                End Session
              </button>
              <button
                onClick={() => setShowEndWorkConfirm(false)}
                className="btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          #timers-grid, #logs-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};
