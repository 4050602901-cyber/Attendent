import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function today() { return new Date().toISOString().split('T')[0] }

export default function Dashboard() {
  const [stats,       setStats]       = useState({ totalStudents: 0, totalClasses: 0, todayAbsent: 0, todayMissing: 0 })
  const [recentAbsent, setRecentAbsent] = useState([])
  const [classStats,  setClassStats]  = useState([])
  const [loading,     setLoading]     = useState(true)
  const todayStr = today()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)

    // ── 1. Total student count (HEAD request — zero data transfer) ──
    const { count: totalStudents } = await supabase
      .from('students').select('*', { count: 'exact', head: true })

    // ── 2. Fetch ALL classrooms in batches (bypasses 1000-row limit) ──
    const BATCH = 500
    let allStudents = []; let from = 0; let hasMore = true
    while (hasMore) {
      const { data } = await supabase
        .from('students').select('classroom')
        .range(from, from + BATCH - 1)
      const rows = data || []
      allStudents = allStudents.concat(rows)
      hasMore = rows.length === BATCH
      from += BATCH
    }

    // ── 3. Today's attendance & homework (filtered by date → small set) ──
    const [absentRes, missingRes] = await Promise.all([
      supabase.from('attendance')
        .select('id, status, date, students(name, student_code, classroom), subjects(subject_name)')
        .eq('date', todayStr).neq('status', 'វត្តមាន')
        .order('created_at', { ascending: false }),
      supabase.from('homework_records')
        .select('id').eq('date', todayStr).eq('status', 'មិនបានធ្វើ'),
    ])

    const absentList = absentRes.data || []
    const classrooms = [...new Set(allStudents.map(s => s.classroom))].sort()

    setStats({
      totalStudents: totalStudents || 0,
      totalClasses:  classrooms.length,
      todayAbsent:   absentList.length,
      todayMissing:  (missingRes.data || []).length,
    })
    setRecentAbsent(absentList.slice(0, 8))
    setClassStats(classrooms.map(cls => ({
      classroom: cls,
      total:  allStudents.filter(s => s.classroom === cls).length,
      absent: absentList.filter(a => a.students?.classroom === cls).length,
    })))
    setLoading(false)
  }

  const cards = [
    { label: 'សិស្សសរុប',        val: stats.totalStudents, bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   icon: '👨‍🎓' },
    { label: 'ថ្នាក់រៀន',         val: stats.totalClasses,  bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', icon: '🏫' },
    { label: 'អវត្តមានថ្ងៃនេះ',   val: stats.todayAbsent,   bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    icon: '⚠️' },
    { label: 'មិនធ្វើកិច្ចការ',   val: stats.todayMissing,  bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', icon: '📝' },
  ]

  if (loading) return <div className="text-center py-20 text-gray-400 text-sm">កំពុងផ្ទុក…</div>

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
