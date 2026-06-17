import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Clock, Star, FileText, CheckSquare, X } from 'lucide-react';
import { GlassCard } from '../components/GlassCard.js';
import { api } from '../api.js';

export const CalendarView: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [history, setHistory] = useState<any[]>([]);
  const [selectedDaySession, setSelectedDaySession] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await api.productivity.getHistory();
      setHistory(data);
    } catch (err) {
      console.error('Failed to load session logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay(); // 0 is Sunday, 1 is Monday
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const formatHours = (minutes: number): string => {
    if (!minutes) return '0h';
    const hrs = (minutes / 60).toFixed(1);
    return `${hrs} hrs`;
  };

  // Find a session in history matching a specific Date object
  const getSessionForDate = (dayNum: number) => {
    const year = currentDate.getFullYear();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const day = dayNum.toString().padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return history.find(s => s.date === dateStr);
  };

  const handleDayClick = (session: any, dayNum: number) => {
    if (!session) {
      // Create a dummy offline day shell to inspect
      const year = currentDate.getFullYear();
      const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
      const day = dayNum.toString().padStart(2, '0');
      setSelectedDaySession({
        date: `${year}-${month}-${day}`,
        status: 'Offline',
        notes: 'No records available for this date.',
        rating: 0,
        completedTasks: [],
        breaks: [],
        totalWorkMinutes: 0,
        totalBreakMinutes: 0,
        effectiveWorkMinutes: 0
      });
    } else {
      setSelectedDaySession(session);
    }
    setShowModal(true);
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDayIndex = getFirstDayOfMonth(currentDate); // Offset (0 for Sun, 1 for Mon, etc.)
  
  const calendarCells = [];
  // Fill empty prefix padding blocks
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(<div key={`empty-${i}`} style={{ background: 'transparent' }} />);
  }

  // Fill calendar month dates
  for (let d = 1; d <= daysInMonth; d++) {
    const session = getSessionForDate(d);
    const hasWork = session && session.effectiveWorkMinutes > 0;
    
    calendarCells.push(
      <button
        key={`day-${d}`}
        onClick={() => handleDayClick(session, d)}
        className="glass-panel"
        style={{
          aspectRatio: '1',
          padding: '0.5rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          border: '1px solid var(--border-glass)',
          background: hasWork ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-input)',
          cursor: 'pointer',
          textAlign: 'left',
          borderRadius: '8px',
          width: '100%',
          transition: 'all 0.15s ease'
        }}
      >
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{d}</span>
        
        {session && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%', marginTop: 'auto' }}>
            {session.effectiveWorkMinutes > 0 && (
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: 'var(--color-working)',
                  padding: '1px 4px',
                  borderRadius: '4px',
                  display: 'inline-block',
                  width: 'fit-content'
                }}
              >
                {formatHours(session.effectiveWorkMinutes)}
              </span>
            )}
            
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', height: '12px' }}>
              {session.rating > 0 && <span style={{ color: 'var(--color-break)', fontSize: '0.7rem' }}>★ {session.rating}</span>}
              {session.notes && <span style={{ color: 'var(--text-tertiary)', fontSize: '0.65rem' }}>✍</span>}
              {session.completedTasks?.length > 0 && <span style={{ color: 'var(--accent-primary)', fontSize: '0.65rem' }}>✓</span>}
            </div>
          </div>
        )}
      </button>
    );
  }

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* View Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.25rem' }}>Calendar Log</h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
            Browse and review your productivity records by date.
          </p>
        </div>

        {/* Month Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--bg-input)', padding: '0.5rem 1rem', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
          <button onClick={handlePrevMonth} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex' }}>
            <ChevronLeft size={20} />
          </button>
          <span style={{ fontSize: '1rem', fontWeight: 700, minWidth: '130px', textAlign: 'center', fontFamily: 'var(--font-title)' }}>
            {currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={handleNextMonth} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex' }}>
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Calendar Grid panel */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Loading history logs...</span>
        </div>
      ) : (
        <GlassCard style={{ padding: '1.5rem' }}>
          {/* Weekday headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', marginBottom: '0.5rem', textAlign: 'center' }}>
            {weekdays.map(day => (
              <span key={day} style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-tertiary)', padding: '0.5rem 0' }}>
                {day}
              </span>
            ))}
          </div>
          
          {/* Cells grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
            {calendarCells}
          </div>
        </GlassCard>
      )}

      {/* Date Details Modal */}
      {showModal && selectedDaySession && (
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
              maxWidth: '650px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '2.5rem 2rem',
              position: 'relative'
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowModal(false)}
              style={{
                position: 'absolute',
                right: '20px',
                top: '20px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                padding: '5px'
              }}
            >
              <X size={20} />
            </button>

            <div style={{ marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                Daily Summary Log
              </span>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{selectedDaySession.date}</h2>
            </div>

            {/* Session Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ background: 'var(--bg-input)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '3px' }}><Clock size={12} /> Work Time</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-working)', marginTop: '2px' }}>
                  {formatHours(selectedDaySession.effectiveWorkMinutes)}
                </div>
              </div>
              <div style={{ background: 'var(--bg-input)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Break Duration</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-break)', marginTop: '2px' }}>
                  {formatHours(selectedDaySession.totalBreakMinutes)}
                </div>
              </div>
              <div style={{ background: 'var(--bg-input)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '3px' }}><Star size={12} /> Focus Score</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--accent-primary)', marginTop: '2px' }}>
                  {selectedDaySession.rating > 0 ? `${selectedDaySession.rating}/10` : 'Unrated'}
                </div>
              </div>
            </div>

            {/* Work Details & Notes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Working Timestamps */}
              {selectedDaySession.workStart && (
                <div style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '1rem' }}>
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Work Details</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    ⏱ Session Span: <strong>{new Date(selectedDaySession.workStart).toLocaleTimeString()}</strong> to <strong>{selectedDaySession.workEnd ? new Date(selectedDaySession.workEnd).toLocaleTimeString() : 'Active'}</strong>
                  </p>
                  {selectedDaySession.breaks?.length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Breaks list:</span>
                      <ol style={{ paddingLeft: '1.25rem', marginTop: '2px' }}>
                        {selectedDaySession.breaks.map((b: any, index: number) => (
                          <li key={index} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {new Date(b.start).toLocaleTimeString()} - {b.end ? new Date(b.end).toLocaleTimeString() : 'Active'}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <div>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <FileText size={14} /> Notes
                </h4>
                <div
                  style={{
                    background: 'rgba(0,0,0,0.02)',
                    padding: '1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-glass)',
                    fontSize: '0.9rem',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    minHeight: '80px',
                    color: 'var(--text-secondary)'
                  }}
                >
                  {selectedDaySession.notes || 'No notes written for this date.'}
                </div>
              </div>

              {/* Completed Tasks */}
              <div>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckSquare size={14} /> Accomplished Tasks
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {selectedDaySession.completedTasks?.length === 0 ? (
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', fontStyle: 'italic' }}>No tasks logged.</p>
                  ) : (
                    selectedDaySession.completedTasks?.map((t: string, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          fontSize: '0.85rem',
                          color: 'var(--text-secondary)',
                          padding: '0.5rem 0.75rem',
                          background: 'var(--bg-input)',
                          borderRadius: '6px',
                          border: '1px solid var(--border-glass)'
                        }}
                      >
                        ✓ {t}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
};
