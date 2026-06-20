import React, { useState, useEffect, useRef } from 'react';
import { ListTodo, CheckSquare, ShieldAlert, Pin, CalendarDays, Plus, Trash, ChevronLeft, ChevronRight } from 'lucide-react';
import { GlassCard } from '../components/GlassCard.js';
import { api } from '../api.js';

// Custom Date Picker Dropdown Component
interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
}

const DatePicker: React.FC<DatePickerProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Parse current value
  const currentDate = new Date(value + 'T00:00:00');
  const [viewYear, setViewYear] = useState(currentDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(currentDate.getMonth()); // 0-11

  // Keep view in sync if external value changes
  useEffect(() => {
    const cur = new Date(value + 'T00:00:00');
    if (!isNaN(cur.getTime())) {
      setViewYear(cur.getFullYear());
      setViewMonth(cur.getMonth());
    }
  }, [value]);

  const formatDisplayDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const y = d.getFullYear();
    return `${m}/${day}/${y}`;
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getStartDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const handleSelectDay = (day: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    onChange(`${viewYear}-${m}-${d}`);
    setIsOpen(false);
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const startDay = getStartDayOfMonth(viewYear, viewMonth);

  const dayCells = [];
  for (let i = 0; i < startDay; i++) {
    dayCells.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    dayCells.push(i);
  }

  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          background: 'var(--bg-input)',
          padding: '0.4rem 0.8rem',
          borderRadius: '10px',
          border: '1px solid var(--border-glass)',
          cursor: 'pointer',
          fontFamily: 'var(--font-title)',
          fontWeight: 600,
          color: 'var(--text-primary)',
          fontSize: '0.9rem',
          transition: 'all var(--transition-fast)'
        }}
        className="glass-panel-hover"
      >
        <CalendarDays size={16} style={{ color: 'var(--accent-primary)' }} />
        <span>{formatDisplayDate(value)}</span>
      </button>

      {isOpen && (
        <div
          className="glass-panel"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: '280px',
            padding: '1rem',
            zIndex: 100,
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            background: 'var(--bg-card)',
            backdropFilter: 'var(--backdrop-blur)'
          }}
        >
          {/* Calendar Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handlePrevMonth}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontWeight: 700, fontFamily: 'var(--font-title)', fontSize: '0.95rem' }}>
              {months[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Weekdays */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' }}>
            {weekdays.map(day => (
              <span key={day} style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                {day}
              </span>
            ))}
          </div>

          {/* Day Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {dayCells.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} />;
              }

              const m = String(viewMonth + 1).padStart(2, '0');
              const d = String(day).padStart(2, '0');
              const isSelected = `${viewYear}-${m}-${d}` === value;

              return (
                <button
                  key={`day-${day}`}
                  type="button"
                  onClick={(e) => handleSelectDay(day, e)}
                  style={{
                    background: isSelected ? 'var(--accent-gradient)' : 'transparent',
                    border: 'none',
                    color: isSelected ? 'white' : 'var(--text-primary)',
                    borderRadius: '8px',
                    padding: '6px 0',
                    fontSize: '0.85rem',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                  className={isSelected ? '' : 'btn-secondary'}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export const Planner: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(() => {
    const date = new Date();
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - (offset * 60 * 1000));
    return local.toISOString().split('T')[0];
  });

  const [goals, setGoals] = useState<string[]>([]);
  const [priorities, setPriorities] = useState<{ text: string; completed: boolean; priority: 'High' | 'Medium' | 'Low' }[]>([]);
  const [checklist, setChecklist] = useState<{ id: string; text: string; completed: boolean }[]>([]);
  const [reminders, setReminders] = useState<string[]>([]);

  // Input states
  const [newGoal, setNewGoal] = useState('');
  const [newPriorityText, setNewPriorityText] = useState('');
  const [newPriorityLevel, setNewPriorityLevel] = useState<'High' | 'Medium' | 'Low'>('High');
  const [newChecklistText, setNewChecklistText] = useState('');
  const [newReminder, setNewReminder] = useState('');

  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');

  const fetchPlanner = async (date: string) => {
    try {
      const data = await api.planner.get(date);
      setGoals(data.goals || []);
      setPriorities(data.priorities || []);
      setChecklist(data.checklist || []);
      setReminders(data.reminders || []);
    } catch (err) {
      console.error('Failed to load planner logs:', err);
    }
  };

  useEffect(() => {
    fetchPlanner(selectedDate);
  }, [selectedDate]);

  const savePlanner = async (
    updatedGoals = goals,
    updatedPriorities = priorities,
    updatedChecklist = checklist,
    updatedReminders = reminders
  ) => {
    setSaveStatus('saving');
    try {
      await api.planner.update(selectedDate, {
        goals: updatedGoals,
        priorities: updatedPriorities,
        checklist: updatedChecklist,
        reminders: updatedReminders
      });
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to save planner updates:', err);
      setSaveStatus('error');
    }
  };

  // Goals CRUD
  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoal.trim()) return;
    const updated = [...goals, newGoal.trim()];
    setGoals(updated);
    setNewGoal('');
    savePlanner(updated);
  };

  const handleRemoveGoal = (index: number) => {
    const updated = goals.filter((_, i) => i !== index);
    setGoals(updated);
    savePlanner(updated);
  };

  // Priorities CRUD
  const handleAddPriority = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPriorityText.trim()) return;
    const updated = [
      ...priorities,
      { text: newPriorityText.trim(), completed: false, priority: newPriorityLevel }
    ];
    setPriorities(updated);
    setNewPriorityText('');
    savePlanner(goals, updated);
  };

  const handleTogglePriority = (index: number) => {
    const updated = priorities.map((p, i) =>
      i === index ? { ...p, completed: !p.completed } : p
    );
    setPriorities(updated);
    savePlanner(goals, updated);
  };

  const handleRemovePriority = (index: number) => {
    const updated = priorities.filter((_, i) => i !== index);
    setPriorities(updated);
    savePlanner(goals, updated);
  };

  // Tasks Checklist CRUD
  const handleAddChecklist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistText.trim()) return;
    const updated = [
      ...checklist,
      { id: Date.now().toString(), text: newChecklistText.trim(), completed: false }
    ];
    setChecklist(updated);
    setNewChecklistText('');
    savePlanner(goals, priorities, updated);
  };

  const handleToggleChecklist = (id: string) => {
    const updated = checklist.map(item =>
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    setChecklist(updated);
    savePlanner(goals, priorities, updated);
  };

  const handleRemoveChecklist = (id: string) => {
    const updated = checklist.filter(item => item.id !== id);
    setChecklist(updated);
    savePlanner(goals, priorities, updated);
  };

  // Reminders CRUD
  const handleAddReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReminder.trim()) return;
    const updated = [...reminders, newReminder.trim()];
    setReminders(updated);
    setNewReminder('');
    savePlanner(goals, priorities, checklist, updated);
  };

  const handleRemoveReminder = (index: number) => {
    const updated = reminders.filter((_, i) => i !== index);
    setReminders(updated);
    savePlanner(goals, priorities, checklist, updated);
  };

  const getPriorityColor = (level: 'High' | 'Medium' | 'Low') => {
    switch (level) {
      case 'High': return '#ef4444'; // Red
      case 'Medium': return '#f59e0b'; // Amber
      default: return '#3b82f6'; // Blue
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Planner Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.25rem' }}>Schedule Planner</h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
            Set priorities, align goals, and track checkboxes for selected calendar days.
          </p>
        </div>

        {/* Sync & Date selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', color: saveStatus === 'saving' ? 'var(--color-break)' : saveStatus === 'error' ? '#ef4444' : 'var(--color-working)' }}>
            {saveStatus === 'saving' ? 'Syncing...' : saveStatus === 'error' ? 'Connection Error' : 'Database Synced'}
          </span>
          <DatePicker value={selectedDate} onChange={setSelectedDate} />
        </div>
      </div>

      {/* Grid panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }} id="planner-grid">
        
        {/* Left Column: Daily Goals & Priorities */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Daily Goals */}
          <GlassCard>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem', marginBottom: '1.25rem' }}>
              <ListTodo size={20} style={{ color: 'var(--accent-primary)' }} /> Core Daily Goals
            </h3>
            
            <form onSubmit={handleAddGoal} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input
                type="text"
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                placeholder="Add daily focus target..."
                className="form-input"
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn-primary" style={{ padding: '0.75rem' }}><Plus size={16} /></button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {goals.length === 0 ? (
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>
                  No major targets mapped for this date.
                </p>
              ) : (
                goals.map((g, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--border-glass)', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>• {g}</span>
                    <button onClick={() => handleRemoveGoal(idx)} style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}><Trash size={14} /></button>
                  </div>
                ))
              )}
            </div>
          </GlassCard>

          {/* Work Priorities */}
          <GlassCard>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem', marginBottom: '1.25rem' }}>
              <ShieldAlert size={20} style={{ color: '#ef4444' }} /> Work Priorities
            </h3>

            <form onSubmit={handleAddPriority} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={newPriorityText}
                  onChange={(e) => setNewPriorityText(e.target.value)}
                  placeholder="What is your priority?"
                  className="form-input"
                  style={{ flex: 1 }}
                />
                <select
                  value={newPriorityLevel}
                  onChange={(e: any) => setNewPriorityLevel(e.target.value)}
                  className="form-input"
                  style={{ fontFamily: 'var(--font-title)', fontWeight: 600, width: '110px' }}
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%' }}><Plus size={16} /> Add Priority</button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {priorities.length === 0 ? (
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>
                  No priorities set. Choose High/Medium/Low tasks to anchor your day.
                </p>
              ) : (
                priorities.map((p, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      background: 'rgba(0,0,0,0.02)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: '8px',
                      opacity: p.completed ? 0.6 : 1
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <input
                        type="checkbox"
                        checked={p.completed}
                        onChange={() => handleTogglePriority(idx)}
                        style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--accent-primary)' }}
                      />
                      <span
                        style={{
                          fontSize: '0.9rem',
                          textDecoration: p.completed ? 'line-through' : 'none',
                          color: 'var(--text-primary)'
                        }}
                      >
                        {p.text}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          backgroundColor: `${getPriorityColor(p.priority)}20`,
                          color: getPriorityColor(p.priority),
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}
                      >
                        {p.priority}
                      </span>
                      <button onClick={() => handleRemovePriority(idx)} style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}><Trash size={14} /></button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </GlassCard>
        </div>

        {/* Right Column: Checklists & Reminders */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Checklist */}
          <GlassCard>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem', marginBottom: '1.25rem' }}>
              <CheckSquare size={20} style={{ color: 'var(--color-working)' }} /> Task Checklist
            </h3>

            <form onSubmit={handleAddChecklist} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input
                type="text"
                value={newChecklistText}
                onChange={(e) => setNewChecklistText(e.target.value)}
                placeholder="Add task item..."
                className="form-input"
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn-primary" style={{ padding: '0.75rem' }}><Plus size={16} /></button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {checklist.length === 0 ? (
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>
                  Your general checklist is empty.
                </p>
              ) : (
                checklist.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      background: 'rgba(0,0,0,0.02)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: '8px',
                      opacity: item.completed ? 0.6 : 1
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => handleToggleChecklist(item.id)}
                        style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--accent-primary)' }}
                      />
                      <span
                        style={{
                          fontSize: '0.9rem',
                          textDecoration: item.completed ? 'line-through' : 'none',
                          color: 'var(--text-primary)'
                        }}
                      >
                        {item.text}
                      </span>
                    </div>

                    <button onClick={() => handleRemoveChecklist(item.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}><Trash size={14} /></button>
                  </div>
                ))
              )}
            </div>
          </GlassCard>

          {/* Pinned Reminders */}
          <GlassCard>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem', marginBottom: '1.25rem' }}>
              <Pin size={20} style={{ color: 'var(--color-break)' }} /> Important Reminders
            </h3>

            <form onSubmit={handleAddReminder} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input
                type="text"
                value={newReminder}
                onChange={(e) => setNewReminder(e.target.value)}
                placeholder="Pin a note or critical alert..."
                className="form-input"
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn-primary" style={{ padding: '0.75rem' }}><Plus size={16} /></button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {reminders.length === 0 ? (
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>
                  No reminders pinned for this date.
                </p>
              ) : (
                reminders.map((r, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '1rem',
                      background: 'rgba(245, 158, 11, 0.04)',
                      border: '1px dashed rgba(245, 158, 11, 0.2)',
                      borderRadius: '8px'
                    }}
                  >
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>📌 {r}</span>
                    <button onClick={() => handleRemoveReminder(idx)} style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}><Trash size={14} /></button>
                  </div>
                ))
              )}
            </div>
          </GlassCard>
        </div>
      </div>

      <style>{`
        @media (max-width: 800px) {
          #planner-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};
