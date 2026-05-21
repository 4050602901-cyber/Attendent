import React, { useState, useEffect } from 'react'
import { qdb } from '../lib/supabase'

const STATUS_OPTS = [
  { value: 'វត្តមាន',  cls: 'bg-green-100 text-green-700 border-green-300' },
  { value: 'អវត្តមាន', cls: 'bg-red-100 text-red-700 border-red-300' },
  { value: 'ច្បាប់',   cls: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  { value: 'ឈឺ',      cls: 'bg-orange-100 text-orange-700 border-orange-300' },
]
const INACTIVE = 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'

function today() {
  return new Date().toISOString().split('T')[0]
}

// Natural sort for Khmer/Latin names
function naturalSort(a, b) {
  return a.full_name.localeCompare(b.full_name, 'km', { numeric: true, sensitivity: 'base' })
}

export default function TeacherAttendance() {
  const [date,       setDate]       = useState(today())
  const [teachers,   setTeachers]   = useState([])
  const [attendance, setAttendance] = useState({})   // { teacher_id: status }
  const [loading,    setLoading]    = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)

  useEffect(() => { loadTeachers() }, [])
  useEffect(() => { if (teachers.length) loadAttendance(date) }, [date, teachers])

  async function loadTeachers() {
    setLoading(true)
    const { data } = await qdb
      .from('profiles')
      .select('id, full_name, email, role')
      .in('role', ['teacher', 'admin'])
      .order('full_name')
    const list = (data || []).sort(naturalSort)
    setTeachers(list)
    setLoading(false)
  }

  async function loadAttendance(d) {
    if (!teachers.length) return
    setSaved(false)
    const { data } = await qdb
      .from('teacher_attendance')
      .select('teacher_id, status')
      .eq('date', d)
      .in('teacher_id', teachers.map(t => t.id))

    const map = {}
    teachers.forEach(t => { map[t.id] = 'វត្តមាន' })
    ;(data || []).forEach(r => { map[r.teacher_id] = r.status })
    setAttendance(map)
  }

  async function handleSave() {
    if (!teachers.length) return
    setSaving(true)
    const records = teachers.map(t => ({
      teacher_id: t.id,
      date,
      status: attendance[t.id] || 'វត្តមាន',
    }))
    await qdb
      .from('teacher_attendance')
      .upsert(records, { onConflict: 'teacher_id,date' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const counts = { present: 0, absent: 0, leave: 0, sick: 0 }
  Object.values(attendance).forEach(s => {
    if (s === 'វត្តមាន')  counts.present++
    else if (s === 'អវត្តមាន') counts.absent++
    else if (s === 'ច្បាប់')   counts.leave++
    else if (s === 'ឈឺ')      counts.sick++
  })

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">វត្តមានគ្រូ</h2>

      {/* Date picker */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <label className="block text-xs font-medium text-gray-600 mb-1">ថ្ងៃខែ</label>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Summary chips */}
      {teachers.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[
            { label: 'វត្តមាន',  val: counts.present, bg: 'bg-green-50  border-green-200',  text: 'text-green-600' },
            { label: 'អវត្តមាន', val: counts.absent,  bg: 'bg-red-50    border-red-200',    text: 'text-red-600' },
            { label: 'ច្បាប់',   val: counts.leave,   bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-600' },
            { label: 'ឈឺ',      val: counts.sick,    bg: 'bg-orange-50 border-orange-200', text: 'text-orange-600' },
          ].map(c => (
            <div key={c.label} className={`${c.bg} border rounded-lg p-3 text-center`}>
              <div className={`text-2xl font-bold ${c.text}`}>{c.val}</div>
              <div className={`text-xs ${c.text}`}>{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {loading && <div className="text-center py-16 text-gray-400">កំពុងផ្ទុក…</div>}

      {!loading && teachers.length === 0 && (
        <div className="text-center py-16 text-gray-400 bg-white rounded-lg shadow">
          គ្មានគ្រូក្នុងប្រព័ន្ធ
        </div>
      )}

      {!loading && teachers.length > 0 && (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <span className="text-sm font-medium text-gray-700">
                វត្តមានគ្រូ · {date}
              </span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left text-gray-600 font-medium">#</th>
                  <th className="px-4 py-2 text-left text-gray-600 font-medium">ឈ្មោះ</th>
                  <th className="px-4 py-2 text-left text-gray-600 font-medium">Email</th>
                  <th className="px-4 py-2 text-center text-gray-600 font-medium">ស្ថានភាព</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t, i) => (
                  <tr key={t.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-3 font-medium">{t.full_name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">{t.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-1 flex-wrap">
                        {STATUS_OPTS.map(opt => (
                          <label key={opt.value} className="cursor-pointer">
                            <input
                              type="radio"
                              className="sr-only"
                              name={`tatt-${t.id}`}
                              value={opt.value}
                              checked={attendance[t.id] === opt.value}
                              onChange={() => {
                                setAttendance(p => ({ ...p, [t.id]: opt.value }))
                                setSaved(false)
                              }}
                            />
                            <span className={`inline-block px-3 py-1 rounded-full text-xs border transition-colors ${
                              attendance[t.id] === opt.value
                                ? opt.cls + ' font-semibold'
                                : INACTIVE
                            }`}>
                              {opt.value}
                            </span>
                          </label>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-6 py-2 rounded-lg font-medium text-sm transition-colors ${
                saved
                  ? 'bg-green-600 text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
              }`}
            >
              {saving ? 'កំពុងរក្សា…' : saved ? '✓ បានរក្សាទុក' : '💾 រក្សាទុក'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
