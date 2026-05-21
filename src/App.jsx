import React, { useState, useEffect } from 'react'
import { supabase, qdb, isConfigured } from './lib/supabase'
import Navigation         from './components/Navigation'
import Login              from './components/Login'
import Dashboard          from './components/Dashboard'
import StudentManagement  from './components/StudentManagement'
import AttendanceTracking from './components/AttendanceTracking'
import HomeworkTracking   from './components/HomeworkTracking'
import Reports            from './components/Reports'
import SubjectManagement  from './components/SubjectManagement'
import UserManagement     from './components/UserManagement'
import TeacherAttendance  from './components/TeacherAttendance'

export default function App() {
  const [session,     setSession]     = useState(null)
  const [profile,     setProfile]     = useState(null)   // { id, role, full_name, email }
  const [authLoading, setAuthLoading] = useState(true)
  const [activeTab,   setActiveTab]   = useState('dashboard')

  useEffect(() => {
    if (!isConfigured) { setAuthLoading(false); return }

    // Safety net: force-show Login after 6 s even if Supabase never responds
    const fallback = setTimeout(() => setAuthLoading(false), 6000)

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setSession(session)
        if (session) await loadProfile(session.user.id)
      } catch (e) {
        console.warn('Auth init error:', e)
      } finally {
        clearTimeout(fallback)
        setAuthLoading(false)
      }
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, session) => {
      setSession(session)
      if (session) await loadProfile(session.user.id)
      else         setProfile(null)
    })
    return () => { subscription.unsubscribe(); clearTimeout(fallback) }
  }, [])

  async function loadProfile(userId) {
    try {
      // Use qdb (no JWT lock) so this never hangs
      const { data, error } = await qdb
        .from('profiles').select('*').eq('id', userId).single()
      setProfile(
        (!error && data)
          ? data
          : { id: userId, role: 'admin', full_name: '', email: '' }
      )
    } catch {
      setProfile({ id: userId, role: 'admin', full_name: '', email: '' })
    }
  }

  // Robust logout — works even if signOut() is blocked by JWT lock
  async function handleLogout() {
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, rej) => setTimeout(() => rej('timeout'), 3000)),
      ])
    } catch { /* ignore — clearing manually */ }
    // Force-clear all Supabase session keys from localStorage
    Object.keys(localStorage)
      .filter(k => k.startsWith('sb-') || k.includes('supabase'))
      .forEach(k => localStorage.removeItem(k))
    window.location.reload()
  }

  const isAdmin    = profile?.role === 'admin'
  const isMStudent = profile?.role === 'mstudent'

  /* ── Not configured ── */
  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-lg w-full p-8">
          <div className="text-4xl mb-4 text-center">⚙️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2 text-center">តំឡើង Supabase</h2>
          <p className="text-gray-500 text-sm text-center mb-6">Setup required before using the app</p>
          <ol className="space-y-3 text-sm text-gray-700">
            {[
              <>បង្កើត project នៅ <strong>supabase.com</strong></>,
              <>ដំណើរការ SQL ក្នុង <strong>sql/schema.sql</strong> នៅ SQL Editor</>,
              <>ចំលង <code className="bg-gray-100 px-1 rounded">.env.example</code> ទៅជា <code className="bg-gray-100 px-1 rounded">.env</code></>,
              <>បំពេញ <code className="bg-gray-100 px-1 rounded">VITE_SUPABASE_URL</code> និង <code className="bg-gray-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code></>,
              <>Restart: <code className="bg-gray-100 px-1 rounded">npm run dev</code></>,
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-xs font-bold">{i+1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    )
  }

  /* ── Auth loading ── */
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    )
  }

  /* ── Not logged in ── */
  if (!session) return <Login />

  /* ── Main app ── */
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold leading-tight">ប្រព័ន្ធគ្រប់គ្រងវត្តមាន និងកិច្ចការ</h1>
            <p className="text-blue-200 text-xs mt-0.5">Student Attendance &amp; Homework Tracker</p>
          </div>
          <div className="flex items-center gap-3">
            {/* User info */}
            {profile && (
              <div className="hidden sm:flex flex-col items-end">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-white leading-tight">
                    {profile.full_name || 'អ្នកប្រើ'}
                  </span>
                  {/* Verified Pro badge — Admin only */}
                  {isAdmin && (
                    <span className="flex items-center gap-0.5 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                      ✦ Pro
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-medium mt-0.5 ${
                  isAdmin    ? 'text-yellow-300' :
                  isMStudent ? 'text-green-300'  :
                               'text-blue-200'
                }`}>
                  {isAdmin ? '👑 Admin' : isMStudent ? '🎓 ប្រធានថ្នាក់' : '👨‍🏫 Teacher'}
                </span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="text-xs bg-blue-600 hover:bg-blue-500 border border-blue-500 px-3 py-1.5 rounded-lg transition-colors">
              Logout
            </button>
          </div>
        </div>
      </header>

      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} isAdmin={isAdmin} isMStudent={isMStudent} />

      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'dashboard'   && <Dashboard />}
        {activeTab === 'attendance'  && <AttendanceTracking profile={profile} />}
        {activeTab === 'homework'    && !isMStudent && <HomeworkTracking />}
        {activeTab === 'reports'     && !isMStudent && <Reports />}
        {/* mstudent-only tab */}
        {activeTab === 'teacher-att' && isMStudent && <TeacherAttendance />}
        {/* Admin-only tabs */}
        {activeTab === 'students'    && isAdmin && <StudentManagement />}
        {activeTab === 'subjects'    && isAdmin && <SubjectManagement />}
        {activeTab === 'users'       && isAdmin && <UserManagement profile={profile} />}
      </main>
    </div>
  )
}
