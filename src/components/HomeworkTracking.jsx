import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const HW_OPTS = [
  { value: 'បានធ្វើ',            active: 'bg-green-100  text-green-700  border-green-300' },
  { value: 'ធ្វើបានពាក់កណ្តាល', active: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  { value: 'មិនបានធ្វើ',        active: 'bg-red-100    text-red-700    border-red-300' },
]
const INACTIVE = 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'

export default function HomeworkTracking() {
  const [subjects,   setSubjects]   = useState([])
  const [classrooms, setClassrooms] = useState([])
  const [students,   setStudents]   = useState([])
  const [statuses,   setStatuses]   = useState({})
  const [date,       setDate]       = useState(today())
  const [classroom,  setClassroom]  = useState('')
  const [subjectId,  setSubjectId]  = useState('')
  const [hwTitle,    setHwTitle]    = useState('')
  const [loading,    setLoading]    = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [saveError,  setSaveError]  = useState('')

  useEffect(() => { loadMeta() }, [])
  useEffect(() => { if (classroom) loadStudents() }, [classroom])

  async function loadMeta() {
    const [s, c] = await Promise.all([
      supabase.from('subjects').select('*').order('subject_name'),
      supabase.from('students').select('classroom'),
    ])
    const subs = s.data || []
    const cls  = [...new Set((c.data || []).map(r => r.classroom))].sort()
    setSubjects(subs)
    setClassrooms(cls)
    if (cls.length)  setClassroom(cls[0])
    if (subs.length) setSubjectId(String(subs[0].id))
  }

  async function loadStudents() {
    setLoading(true)
    const { data } = await supabase
      .from('students').select('*').eq('classroom', classroom).order('name')
    const list = data || []
    setStudents(list)
    const defaults = {}
    list.forEach(s => { defaults[s.id] = 'បានធ្វើ' })
    setStatuses(defaults)
    setLoading(false)
    setSaved(false)
  }

  async function saveAll() {
    if (!hwTitle.trim()) { setSaveError('សូមបញ្ចូលចំណងជើងកិច្ចការ'); return }
    if (!students.length) return
    setSaving(true)
    setSaveError('')
    const records = students.map(s => ({
      student_id:     s.id,
      subject_id:     parseInt(subjectId),
      date,
      homework_title: hwTitle.trim(),
      status:         statuses[s.id] || 'បានធ្វើ',
    }))
    const { error } = await supabase.from('homework_records').insert(records)
    setSaving(false)
    if (error) {
      setSaveError(error.message)
    } else {
      setSaved(true)
      setHwTitle('')
      setTimeout(() => setSaved(false), 3000)
    }
  }

  const counts = { done: 0, half: 0, notDone: 0 }
  Object.values(statuses).forEach(s => {
    if (s === 'បានធ្វើ') counts.done++
    else if (s === 'ធ្វើបានពាក់កណ្តាល') counts.half++
    else if (s === 'មិនបានធ្វើ') counts.notDone++
  })

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">កត់ត្រាកិច្ចការផ្ទះ</h2>

      {/* Selector bar */}
      <div className="bg-white rounded-lg shadow p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">ថ្ងៃខែ</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">ថ្នាក់រៀន</label>
          <select value={classroom} onChange={e => setClassroom(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
            {classrooms.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">មុខវិជ្ជា</label>
          <select value={subjectId} onChange={e => setSubjectId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
            {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">ចំណងជើងកិច្ចការ *</label>
          <input type="text" value={hwTitle} onChange={e => { setHwTitle(e.target.value); setSaveError('') }}
            placeholder="ឧ. លំហាត់ទំព័រ ៤៥–៤៦"
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* Summary */}
      {students.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: 'បានធ្វើ',          val: counts.done,    bg: 'bg-green-50  border-green-200',  text: 'text-green-600' },
            { label: 'ពាក់កណ្តាល',      val: counts.half,    bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-600' },
            { label: 'មិនបានធ្វើ',       val: counts.notDone, bg: 'bg-red-50    border-red-200',    text: 'text-red-600' },
          ].map(c => (
            <div key={c.label} className={`${c.bg} border rounded-lg p-3 text-center`}>
              <div className={`text-2xl font-bold ${c.text}`}>{c.val}</div>
              <div className={`text-xs ${c.text}`}>{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {loading && <div className="text-center py-16 text-gray-400">កំពុងផ្ទុក…</div>}

      {!loading && students.length === 0 && (
        <div className="text-center py-16 text-gray-400 bg-white rounded-lg shadow">
          {classroom ? `គ្មានសិស្សក្នុងថ្នាក់ ${classroom}` : 'សូមជ្រើស ថ្នាក់'}
        </div>
      )}

      {!loading && students.length > 0 && (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <span className="text-sm font-medium text-gray-700">
                {classroom} · {subjects.find(s => String(s.id) === subjectId)?.subject_name}
              </span>
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
                        {HW_OPTS.map(opt => (
                          <label key={opt.value} className="cursor-pointer">
                            <input type="radio" className="sr-only"
                              name={`hw-${s.id}`} value={opt.value}
                              checked={statuses[s.id] === opt.value}
                              onChange={() => {
                                setStatuses(p => ({ ...p, [s.id]: opt.value }))
                                setSaved(false)
                              }} />
                            <span className={`inline-block px-2 py-1 rounded-full text-xs border transition-colors ${
                              statuses[s.id] === opt.value ? opt.active + ' font-semibold' : INACTIVE
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

          {saveError && <p className="mt-2 text-sm text-red-600">{saveError}</p>}

          <div className="mt-4 flex justify-end">
            <button onClick={saveAll} disabled={saving}
              className={`px-6 py-2 rounded-lg font-medium text-sm transition-colors ${
                saved ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
              }`}>
              {saving ? 'កំពុងរក្សា…' : saved ? '✓ បានរក្សាទុក' : 'រក្សាទុកកិច្ចការ'}
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
