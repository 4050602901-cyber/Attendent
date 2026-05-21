import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllClassrooms } from '../lib/fetchAll'
import SearchableSelect from './SearchableSelect'

const STATUS_OPTS = [
  { value: 'វត្តមាន',   active: 'bg-green-100  text-green-700  border-green-300' },
  { value: 'ច្បាប់',    active: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  { value: 'អត់ច្បាប់', active: 'bg-red-100    text-red-700    border-red-300' },
]
const INACTIVE = 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'

export default function AttendanceTracking() {
  const [subjects,  setSubjects]  = useState([])
  const [classrooms, setClassrooms] = useState([])
  const [students,  setStudents]  = useState([])
  const [attendance, setAttendance] = useState({})
  const [date,      setDate]      = useState(today())
  const [classroom, setClassroom] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [loading,   setLoading]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)

  useEffect(() => { loadMeta() }, [])
  useEffect(() => { if (classroom && subjectId && date) loadStudents() }, [classroom, subjectId, date])

  async function loadMeta() {
    const [subRes, cls] = await Promise.all([
      supabase.from('subjects').select('*').order('subject_name'),
      fetchAllClassrooms(),   // batch-loops — no 1000-row cap
    ])
    const subs = subRes.data || []
    setSubjects(subs)
    setClassrooms(cls)
    if (cls.length)  setClassroom(cls[0])
    if (subs.length) setSubjectId(String(subs[0].id))
  }

  async function loadStudents() {
    setLoading(true)
    const { data: studs } = await supabase
      .from('students').select('*').eq('classroom', classroom).order('name')
    const list = studs || []
    setStudents(list)

    if (list.length) {
      const { data: att } = await supabase
        .from('attendance').select('*')
        .eq('subject_id', subjectId).eq('date', date)
        .in('student_id', list.map(s => s.id))
      const map = {}
      list.forEach(s => { map[s.id] = 'វត្តមាន' })
      ;(att || []).forEach(a => { map[a.student_id] = a.status })
      setAttendance(map)
    } else {
      setAttendance({})
    }
    setLoading(false)
    setSaved(false)
  }

  async function saveAll() {
    if (!students.length) return
    setSaving(true)
    const records = students.map(s => ({
      student_id: s.id,
      subject_id: parseInt(subjectId),
      date,
      status: attendance[s.id] || 'វត្តមាន',
    }))
    await supabase.from('attendance').upsert(records, { onConflict: 'student_id,subject_id,date' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const counts = { present: 0, excused: 0, absent: 0 }
  Object.values(attendance).forEach(s => {
    if (s === 'វត្តមាន')   counts.present++
    else if (s === 'ច្បាប់')    counts.excused++
    else if (s === 'អត់ច្បាប់') counts.absent++
  })

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">កត់ត្រាវត្តមាន</h2>

      {/* Selector bar */}
      <div className="bg-white rounded-lg shadow p-4 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">ថ្ងៃខែ</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <SearchableSelect
            label="ថ្នាក់រៀន"
            value={classroom}
            onChange={setClassroom}
            options={classrooms}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">មុខវិជ្ជា</label>
          <select value={subjectId} onChange={e => setSubjectId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
            {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
          </select>
        </div>
      </div>

      {/* Summary chips */}
      {students.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: 'វត្តមាន',   val: counts.present, bg: 'bg-green-50  border-green-200',  text: 'text-green-600' },
            { label: 'ច្បាប់',    val: counts.excused,  bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-600' },
            { label: 'អត់ច្បាប់', val: counts.absent,   bg: 'bg-red-50    border-red-200',    text: 'text-red-600' },
          ].map(c => (
            <div key={c.label} className={`${c.bg} border rounded-lg p-3 text-center`}>
              <div className={`text-2xl font-bold ${c.text}`}>{c.val}</div>
              <div className={`text-xs ${c.text}`}>{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Student list */}
      {loading && <div className="text-center py-16 text-gray-400">កំពុងផ្ទុក…</div>}

      {!loading && students.length === 0 && (
        <div className="text-center py-16 text-gray-400 bg-white rounded-lg shadow">
          {classroom ? `គ្មានសិស្សក្នុងថ្នាក់ ${classroom}` : 'សូមជ្រើស ថ្នាក់ និង មុខវិជ្ជា'}
        </div>
      )}

      {!loading && students.length > 0 && (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50 flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">
                {classroom} · {subjects.find(s => String(s.id) === subjectId)?.subject_name} · {date}
              </span>
              <button onClick={() => {
                const all = {}
                students.forEach(s => { all[s.id] = 'វត្តមាន' })
                setAttendance(all)
              }} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200">
                ទាំងអស់វត្តមាន
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left text-gray-600 font-medium">#</th>
                  <th className="px-4 py-2 text-left text-gray-600 font-medium">ឈ្មោះ</th>
                  <th className="px-4 py-2 text-center text-gray-600 font-medium">ស្ថានភាព</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={s.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-gray-400">{s.student_code}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-1 flex-wrap">
                        {STATUS_OPTS.map(opt => (
                          <label key={opt.value} className="cursor-pointer">
                            <input type="radio" className="sr-only"
                              name={`att-${s.id}`} value={opt.value}
                              checked={attendance[s.id] === opt.value}
                              onChange={() => {
                                setAttendance(p => ({ ...p, [s.id]: opt.value }))
                                setSaved(false)
                              }} />
                            <span className={`inline-block px-3 py-1 rounded-full text-xs border transition-colors ${
                              attendance[s.id] === opt.value ? opt.active + ' font-semibold' : INACTIVE
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
            <button onClick={saveAll} disabled={saving}
              className={`px-6 py-2 rounded-lg font-medium text-sm transition-colors ${
                saved ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
              }`}>
              {saving ? 'កំពុងរក្សា…' : saved ? '✓ បានរក្សាទុក' : 'រក្សាទុកវត្តមាន'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function today() {
  return new Date().toISOString().split('T')[0]
}
