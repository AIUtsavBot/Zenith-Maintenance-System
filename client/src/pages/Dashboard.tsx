import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Clock,
  Brain,
  CalendarDays,
  Sparkles,
  Trophy,
  AlertTriangle,
  Bell,
  ListTodo
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer
} from 'recharts';
import { GlassCard } from '../components/GlassCard.js';
import { api } from '../api.js';

// Simple Markdown parser for AI insights display
const RenderMarkdown: React.FC<{ content: string }> = ({ content }) => {
  if (!content) return null;

  const lines = content.split('\n');
  return (
    <div style={{ lineHeight: '1.7', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
      {lines.map((line, idx) => {
        // Headers
        if (line.startsWith('### ')) {
          return <h4 key={idx} style={{ fontSize: '1.15rem', margin: '1.25rem 0 0.5rem 0', color: 'var(--text-primary)', fontWeight: 700 }}>{line.replace('### ', '')}</h4>;
        }
        if (line.startsWith('## ')) {
          return <h3 key={idx} style={{ fontSize: '1.3rem', margin: '1.5rem 0 0.75rem 0', color: 'var(--text-primary)', fontWeight: 700 }}>{line.replace('## ', '')}</h3>;
        }
        if (line.startsWith('# ')) {
          return <h2 key={idx} style={{ fontSize: '1.5rem', margin: '1.75rem 0 1rem 0', color: 'var(--text-primary)', fontWeight: 800 }}>{line.replace('# ', '')}</h2>;
        }
        
        // Bullet Points
        if (line.startsWith('* ') || line.startsWith('- ')) {
          const cleanText = line.substring(2);
          return (
            <li key={idx} style={{ marginLeft: '1.25rem', marginBottom: '0.5rem' }}>
              {parseBold(cleanText)}
            </li>
          );
        }

        // Checklist items in MD
        if (line.match(/^\d+\.\s/)) {
          const cleanText = line.replace(/^\d+\.\s/, '');
          return (
            <div key={idx} style={{ display: 'flex', gap: '0.5rem', margin: '0.5rem 0', alignItems: 'flex-start' }}>
              <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{line.match(/^\d+/)?.[0]}.</span>
              <div>{parseBold(cleanText)}</div>
            </div>
          );
        }

        // Empty line
        if (!line.trim()) return <div key={idx} style={{ height: '0.75rem' }} />;

        // Normal paragraph
        return <p key={idx} style={{ marginBottom: '0.75rem' }}>{parseBold(line)}</p>;
      })}
    </div>
  );
};

// Parse **bold** syntax in text
function parseBold(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  if (parts.length === 1) return text;
  
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return <strong key={index} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{part}</strong>;
    }
    return part;
  });
}

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState('');
  const [insightPeriod, setInsightPeriod] = useState<'daily' | 'weekly'>('daily');
  const [insightsLoading, setInsightsLoading] = useState(false);

  // Collaborative Dashboard Widgets States
  const [upcomingTasks, setUpcomingTasks] = useState<any[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<any[]>([]);
  const [todayReminders, setTodayReminders] = useState<any[]>([]);
  const [activeGoals, setActiveGoals] = useState<any[]>([]);
  const [recentNotifs, setRecentNotifs] = useState<any[]>([]);
  const [collaborationLoading, setCollaborationLoading] = useState(true);

  const fetchCollaborationMetrics = async () => {
    setCollaborationLoading(true);
    try {
      const [tasksRes, remindersRes, notifsRes, groupsRes] = await Promise.all([
        api.tasks.list().catch(() => ({ tasks: [] })),
        api.reminders.list().catch(() => ({ reminders: [] })),
        api.notifications.list().catch(() => ({ notifications: [] })),
        api.groups.list().catch(() => ({ groups: [] }))
      ]);

      const allTasks = tasksRes.tasks || [];
      const now = new Date();

      // Filter upcoming tasks (due in next 3 days) and not completed
      const upcoming = allTasks.filter((t: any) => {
        if (t.status === 'completed') return false;
        const due = new Date(t.dueDate);
        const diffDays = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= 3;
      });
      setUpcomingTasks(upcoming);

      // Filter overdue tasks
      const overdue = allTasks.filter((t: any) => {
        if (t.status === 'completed') return false;
        const due = new Date(t.dueDate);
        return due < now || t.status === 'overdue';
      });
      setOverdueTasks(overdue);

      // Filter today's reminders
      const todayStr = now.toDateString();
      const reminders = remindersRes.reminders || [];
      const todayR = reminders.filter((r: any) => 
        r.triggerTimes.some((time: string) => new Date(time).toDateString() === todayStr)
      );
      setTodayReminders(todayR);

      // Get unread notifications
      const notifs = notifsRes.notifications || [];
      setRecentNotifs(notifs.filter((n: any) => !n.read).slice(0, 5));

      // Gather active goals across all user groups
      const userGroups = groupsRes.groups || [];
      let allGoals: any[] = [];
      for (const group of userGroups) {
        try {
          const goalsRes = await api.goals.list(group.id);
          const enriched = (goalsRes.goals || []).map((g: any) => ({ ...g, groupName: group.name }));
          allGoals = [...allGoals, ...enriched];
        } catch {}
      }
      setActiveGoals(allGoals.slice(0, 4));
    } catch (err) {
      console.error('Failed to load dashboard collaborative widgets:', err);
    } finally {
      setCollaborationLoading(false);
    }
  };

  useEffect(() => {
    fetchCollaborationMetrics();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const data = await api.productivity.getDashboardSummary();
      setStats(data);
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleGenerateInsights = async () => {
    setInsightsLoading(true);
    try {
      const data = await api.ai.getInsights(insightPeriod);
      setInsights(data.insights);
    } catch (err) {
      setInsights('Failed to generate insights. Check your network or API configurations.');
    } finally {
      setInsightsLoading(false);
    }
  };

  // Run initial insight query on load
  useEffect(() => {
    if (stats) {
      handleGenerateInsights();
    }
  }, [insightPeriod, !!stats]);

  if (loading || !stats) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: 500 }}>
          Calculating productivity metrics...
        </div>
      </div>
    );
  }

  const formatHours = (hours: number): string => {
    const hrs = Math.floor(hours);
    const mins = Math.round((hours - hrs) * 60);
    return `${hrs}h ${mins}m`;
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Page Header */}
      <div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.25rem' }}>Productivity Dashboard</h1>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
          Aggregated analytics, trends, and AI-driven coaching insights.
        </p>
      </div>

      {/* Overview Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }} id="overview-grid">
        {/* Today */}
        <GlassCard style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }} hoverEffect>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-primary)' }}>
            <Clock size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>Today Focus</span>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '2px 0' }}>{formatHours(stats.today.effectiveHours)}</h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              Break time: {formatHours(stats.today.totalBreakHours)}
            </p>
          </div>
        </GlassCard>

        {/* Weekly */}
        <GlassCard style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }} hoverEffect>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-working)' }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>Weekly Hours</span>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '2px 0' }}>{formatHours(stats.weekly.totalHours)}</h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              Daily Avg: {formatHours(stats.weekly.avgHours)}
            </p>
          </div>
        </GlassCard>

        {/* Monthly */}
        <GlassCard style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }} hoverEffect>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--color-break)' }}>
            <Brain size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>Monthly Score</span>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '2px 0' }}>{stats.monthly.avgProductivityRating} / 10</h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              Total Hours: {formatHours(stats.monthly.totalHours)}
            </p>
          </div>
        </GlassCard>
      </div>

      {/* Visual Analytics & AI Insights Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: '1.5rem' }} id="analytics-grid">
        
        {/* Left Column - Charts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Weekly Hours Graph */}
          <GlassCard style={{ padding: '2rem 1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CalendarDays size={18} /> Weekly Performance
            </h3>
            <div style={{ width: '100%', height: '280px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.weekly.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.05)" />
                  <XAxis dataKey="dayLabel" stroke="var(--text-tertiary)" tickLine={false} style={{ fontSize: '0.8rem' }} />
                  <YAxis stroke="var(--text-tertiary)" tickLine={false} axisLine={false} style={{ fontSize: '0.8rem' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-card)',
                      borderColor: 'var(--border-glass)',
                      backdropFilter: 'var(--backdrop-blur)',
                      borderRadius: '10px',
                      color: 'var(--text-primary)'
                    }}
                  />
                  <Area type="monotone" dataKey="effectiveHours" stroke="var(--accent-primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorHours)" name="Hours Worked" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* Monthly Ratings Graph */}
          <GlassCard style={{ padding: '2rem 1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={18} /> Monthly Productivity Trends
            </h3>
            <div style={{ width: '100%', height: '280px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.monthly.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.05)" />
                  <XAxis dataKey="dayNumber" stroke="var(--text-tertiary)" tickLine={false} style={{ fontSize: '0.8rem' }} />
                  <YAxis stroke="var(--text-tertiary)" tickLine={false} axisLine={false} style={{ fontSize: '0.8rem' }} domain={[0, 10]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-card)',
                      borderColor: 'var(--border-glass)',
                      backdropFilter: 'var(--backdrop-blur)',
                      borderRadius: '10px',
                      color: 'var(--text-primary)'
                    }}
                  />
                  <Bar dataKey="rating" fill="var(--color-break)" radius={[4, 4, 0, 0]} name="Focus Score" maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>

        {/* Right Column - AI Insights */}
        <GlassCard
          style={{
            padding: '2rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            height: '100%'
          }}
          className="glass-panel"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Brain size={20} style={{ color: 'var(--accent-primary)' }} /> AI Productivity Coach
            </h3>
            <div style={{ display: 'flex', gap: '2px', background: 'rgba(0, 0, 0, 0.15)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
              <button
                onClick={() => setInsightPeriod('daily')}
                style={{
                  border: 'none',
                  background: insightPeriod === 'daily' ? 'var(--accent-gradient)' : 'transparent',
                  color: insightPeriod === 'daily' ? 'white' : 'var(--text-secondary)',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Daily
              </button>
              <button
                onClick={() => setInsightPeriod('weekly')}
                style={{
                  border: 'none',
                  background: insightPeriod === 'weekly' ? 'var(--accent-gradient)' : 'transparent',
                  color: insightPeriod === 'weekly' ? 'white' : 'var(--text-secondary)',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Weekly
              </button>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              minHeight: '350px',
              maxHeight: '500px',
              padding: '1.25rem',
              borderRadius: '12px',
              background: 'rgba(0, 0, 0, 0.05)',
              border: '1px solid var(--border-glass)',
              position: 'relative'
            }}
          >
            {insightsLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem' }}>
                <Sparkles size={28} className="animate-pulse" style={{ color: 'var(--accent-primary)' }} />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Analyzing work metrics & break ratios...</span>
              </div>
            ) : (
              <RenderMarkdown content={insights} />
            )}
          </div>

          <button
            onClick={handleGenerateInsights}
            disabled={insightsLoading}
            className="btn-primary"
            style={{ width: '100%', gap: '0.5rem', marginTop: 'auto' }}
          >
            <Sparkles size={16} /> Re-Generate Audit
          </button>
        </GlassCard>
      </div>

      {/* Team Collaboration Workspace Overview */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.025em' }}>Team Collaboration Overview</h2>
        
        {collaborationLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Calculating team workloads...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }} id="collab-grid">
            {/* Widget 1: Upcoming & Overdue Tasks */}
            <GlassCard style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}><ListTodo size={18} style={{ color: 'var(--accent-primary)' }} /> Task Backlog</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto', maxHeight: '250px' }}>
                {overdueTasks.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12} /> Overdue Tasks</div>
                    {overdueTasks.map(t => (
                      <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600 }}>{t.title}</span>
                        <span style={{ color: '#ef4444', fontSize: '0.75rem' }}>{t.dueDate}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>Upcoming (Next 3 Days)</div>
                  {upcomingTasks.length === 0 ? (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', padding: '4px' }}>No upcoming deadlines.</div>
                  ) : (
                    upcomingTasks.map(t => (
                      <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(0,0,0,0.1)', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '4px' }}>
                        <span>{t.title}</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{t.dueDate}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </GlassCard>

            {/* Widget 2: Today's Reminders & Alerts */}
            <GlassCard style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}><Bell size={18} style={{ color: 'var(--color-break)' }} /> Today's Reminders</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto', maxHeight: '250px' }}>
                {todayReminders.length === 0 ? (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', padding: '4px' }}>No reminders scheduled for today.</div>
                ) : (
                  todayReminders.map(r => (
                    <div key={r.id} style={{ padding: '8px 12px', background: 'rgba(245, 158, 11, 0.05)', borderLeft: '3px solid var(--color-break)', borderRadius: '4px', fontSize: '0.8rem' }}>
                      <div style={{ fontWeight: 700 }}>{r.title}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '2px' }}>{r.message}</div>
                    </div>
                  ))
                )}

                {recentNotifs.length > 0 && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>Recent Unread Alerts</div>
                    {recentNotifs.map(n => (
                      <div key={n.id} style={{ padding: '4px 6px', fontSize: '0.75rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-glass)' }}>
                        • {n.description}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </GlassCard>

            {/* Widget 3: Active Goals & Group Progress */}
            <GlassCard style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}><Trophy size={18} style={{ color: '#fbbf24' }} /> Active Goals</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto', maxHeight: '250px' }}>
                {activeGoals.length === 0 ? (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', padding: '4px' }}>No active team goals.</div>
                ) : (
                  activeGoals.map(g => (
                    <div key={g.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700 }}>
                        <span>{g.title}</span>
                        <span style={{ color: 'var(--accent-primary)' }}>{g.progress}%</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Group: {g.groupName}</div>
                      <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${g.progress}%`, height: '100%', background: 'var(--accent-gradient)' }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </GlassCard>
          </div>
        )}
      </div>

      <style>{`
        .animate-pulse {
          animation: pulse 1.5s infinite ease-in-out;
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        @media (max-width: 900px) {
          #analytics-grid {
            grid-template-columns: 1fr !important;
          }
          #collab-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 600px) {
          #overview-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};
