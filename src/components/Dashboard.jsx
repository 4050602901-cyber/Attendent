import React, { useState, useEffect } from 'react'
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase'

function today() { return new Date().toISOString().split('T')[0] }

export default function Dashboard() {
  const [stats,       setStats]       = useState({ totalStudents: 0, totalClasses: 0, todayAbsent: 0, todayMissing: 0 })
  const [recentAbsent, setRecentAbsent] = useState([])
  const [classStats,  setClassStats]  = useState([])
  const [loading,     setLoading]     = useState(true)
  const [loadError,   setLoadError]   = useState(null)   // null | string
  const todayStr = today()

  function loadWithTimeout() {
    setLoading(true)
    setLoadError(null)
    const fallback = setTimeout(() => {
      setLoading(false)
      setLoadError('Timeout — queries took > 15 s. Check Supabase connection.')
    }, 15000)
    load().finally(() => clearTimeout(fallback))
  }

  useEffect(() => { loadWithTimeout() }, [])

  async function load() {
    try {
      // ── Step 1: raw fetch ping to test REST API connectivity ──
      let pingInfo = ''
      try {
        const ctrl = new AbortController()
        const t = setTimeout(() => ctrl.abort(), 8000)
        const r = await fetch(
          `${supabaseUrl}/rest/v1/students?select=id&limit=1`,
          { headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
            signal: ctrl.signal }
        )
        clearTimeout(t)
        pingInfo = `HTTP ${r.status}`
        if (!r.ok) {
          const body = await r.text()
          setLoadError(`REST API error ${r.status}: ${body}`)
          return
        }
      } catch (pingErr) {
        setLoadError(`REST API unreachable: ${pingErr.message} — URL: ${supabaseUrl}`)
        return
      }

      // ── Step 2: real queries with Promise.race timeout ──
      const TIMEOUT_MS = 10000
      const timeout = new Promise((_, rej) =>
        setTimeout(() => rej(new Error(`Supabase REST មិនឆ្លើយក្នុង ${TIMEOUT_MS/1000}s (ping=${pingInfo})`)), TIMEOUT_MS)
      )

      const [countRes, clsRes, absentRes, missingRes] = await Promise.race([
        Promise.all([
          supabase.from('students').select('*', { count: 'exact', head: true }),
          supabase.from('students').select('classroom').limit(5000),
          supabase.from('attendance')
            .select('id,status,date,students(name,student_code,classroom),subjects(subject_name)')
            .eq('date', todayStr).neq('status', 'វត្តមាន')
            .order('created_at', { ascending: false }),
          supabase.from('homework_records')
            .select('*', { count: 'exact', head: true })
            .eq('date', todayStr).eq('status', 'មិនបានធ្វើ'),
        ]),
        timeout,
      ])

      // Surface any query errors visibly for diagnosis
      const firstError = [countRes, clsRes, absentRes, missingRes]
        .map(r => r.error).find(Boolean)
      if (firstError) {
        setLoadError(`DB Error: ${firstError.message} (code: ${firstError.code})`)
        return
      }

      const classRows  = clsRes.data  || []
      const absentList = absentRes.data || []
      const classrooms = [...new Set(classRows.map(s => s.classroom))].sort()

      setStats({
        totalStudents: countRes.count   || 0,
        totalClasses:  classrooms.length,
        todayAbsent:   absentList.length,
        todayMissing:  missingRes.count || 0,
      })
      setRecentAbsent(absentList.slice(0, 8))
      setClassStats(classrooms.map(cls => ({
        classroom: cls,
        total:  classRows.filter(s => s.classroom === cls).length,
        absent: absentList.filter(a => a.students?.classroom === cls).length,
      })))
    } catch (e) {
      console.error('Dashboard load error:', e)
      setLoadError(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  const cards = [
    { label: 'សិស្សសរុប',        val: stats.totalStudents, bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   icon: '👨‍🎓' },
    { label: 'ថ្នាក់រៀន',         val: stats.totalClasses,  bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', icon: '🏫' },
    { label: 'អវត្តមានថ្ងៃនេះ',   val: stats.todayAbsent,   bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    icon: '⚠️' },
    { label: 'មិនធ្វើកិច្ចការ',   val: stats.todayMissing,  bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', icon: '📝' },
  ]

  if (loading) return (
    <div className="text-center py-20">
      <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3"></div>
      <div className="text-gray-400 text-sm">កំពុងភ្ជាប់ទៅ Server…</div>
      <div className="text-gray-300 text-xs mt-1">ប្រសិនបើយូរ — Supabase free server កំពុង wake up (រង់ចាំ ~30 វិ)</div>
    </div>
  )

  if (loadError) return (
    <div className="py-12 px-4 max-w-xl mx-auto">
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">⚠️</div>
        <div className="text-gray-700 font-semibold mb-1">មានបញ្ហាក្នុងការភ្ជាប់ Supabase</div>
      </div>

      {/* Error detail */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
        <div className="text-xs text-red-500 font-medium mb-1">Error:</div>
        <code className="text-red-700 text-xs break-all">{loadError}</code>
      </div>

      {/* URL in use */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 text-xs">
        <div className="text-gray-500 font-medium mb-1">Supabase URL ដែលប្រើ:</div>
        <code className="text-gray-700 break-all">{supabaseUrl || '(មិនបានកំណត់)'}</code>
      </div>

      {/* Checklist */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-5 text-xs text-blue-800 space-y-1">
        <div className="font-semibold mb-2">✅ សូមពិនិត្យ:</div>
        <div>1. <strong>Netlify → Site Settings → Environment Variables</strong> — មាន VITE_SUPABASE_URL និង VITE_SUPABASE_ANON_KEY?</div>
        <div>2. <strong>Supabase → Table Editor</strong> — មានតារាង students, attendance, homework_records?</div>
        <div>3. <strong>Supabase → Project Settings → API</strong> — URL ត្រូវគ្នា?</div>
        <div>4. បន្ទាប់ពីកំណត់ ENV ក្នុង Netlify ត្រូវ <strong>Redeploy</strong> ម្ដងទៀត</div>
      </div>

      <div className="text-center">
        <button
          onClick={loadWithTimeout}
          className="bg-blue-600 text-white text-sm px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          🔄 ព្យាយាម​ម្ដងទៀត
        </button>
      </div>
    </div>
  )

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">Dashboard</h2>
        <span className="text-sm text-gray-400 bg-white px-3 py-1 rounded-lg shadow-sm">📅 {todayStr}</span>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map(c => (
          <div key={c.label} className={`${c.bg} ${c.border} border rounded-xl p-4`}>
            <div className="text-2xl mb-2">{c.icon}</div>
            <div className={`text-3xl font-bold ${c.text}`}>{c.val}</div>
            <div className={`text-xs mt-1 ${c.text} opacity-80`}>{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today's absent */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 border-b bg-red-50">
            <h3 className="font-semibold text-red-800 text-sm">⚠️ អវត្តមានថ្ងៃនេះ</h3>
          </div>
          {recentAbsent.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              <div className="text-3xl mb-2">✅</div>
              <div>សិស្សទាំងអស់វត្តមាន!</div>
            </div>
          ) : (
            <div className="divide-y">
              {recentAbsent.map(a => (
                <div key={a.id} className="px-4 py-3 flex justify-between items-center">
                  <div>
                    <div className="font-medium text-sm">{a.students?.name}</div>
                    <div className="text-xs text-gray-400">{a.students?.classroom} · {a.subjects?.subject_name}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    a.status === 'ច្បាប់' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                  }`}>{a.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Class breakdown */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 border-b bg-blue-50">
            <h3 className="font-semibold text-blue-800 text-sm">🏫 ស្ថិតិតាមថ្នាក់ (ថ្ងៃនេះ)</h3>
          </div>
          {classStats.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              <div className="text-3xl mb-2">📋</div>
              <div>មិនទាន់មានសិស្ស — ចូល "គ្រប់គ្រងសិស្ស" ដើម្បីបន្ថែម</div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left text-gray-600 font-medium">ថ្នាក់</th>
                  <th className="px-4 py-2 text-center text-gray-600 font-medium">សិស្សសរុប</th>
                  <th className="px-4 py-2 text-center text-red-500 font-medium">អវត្តមាន</th>
                </tr>
              </thead>
              <tbody>
                {classStats.map(c => (
                  <tr key={c.classroom} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-medium">{c.classroom}</span>
                    </td>
                    <td className="px-4 py-2.5 text-center font-medium">{c.total}</td>
                    <td className="px-4 py-2.5 text-center">
                      {c.absent > 0
                        ? <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-bold">{c.absent}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
