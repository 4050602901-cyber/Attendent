import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function today() { return new Date().toISOString().split('T')[0] }

function startOf(unit) {
  const d = new Date()
  if (unit === 'week') {
    const day = d.getDay() || 7
    d.setDate(d.getDate() - day + 1)
  } else if (unit === 'month') {
    d.setDate(1)
  } else if (unit === 'semester') {
    d.setDate(1)
    d.setMonth(d.getMonth() >= 7 ? 7 : 0)
  }
  return d.toISOString().split('T')[0]
}

export default function Reports() {
  const [subjects,   setSubjects]   = useState([])
  const [classrooms, setClassrooms] = useState([])
  const [filters,    setFilters]    = useState({
    classroom: 'ទាំងអស់', subject: 'ទាំងអស់',
    dateFrom: today(), dateTo: today(),
  })
  const [mode,       setMode]       = useState('daily')
  const [attData,    setAttData]    = useState([])
  const [hwData,     setHwData]     = useState([])
  const [loading,    setLoading]    = useState(false)
  const [hasRun,     setHasRun]     = useState(false)

  useEffect(() => { loadMeta() }, [])

  async function loadMeta() {
    const [s, c] = await Promise.all([
      supabase.from('subjects').select('*').order('subject_name'),
      supabase.from('students').select('classroom'),
    ])
    setSubjects(s.data || [])
    setClassrooms([...new Set((c.data || []).map(r => r.classroom))].sort())
  }

  async function runReport() {
    setLoading(true)
    setHasRun(true)

    let attQ = supabase
      .from('attendance')
      .select('id, student_id, subject_id, date, status, students(id,name,student_code,classroom), subjects(subject_name)')
      .gte('date', filters.dateFrom).lte('date', filters.dateTo)
      .order('date', { ascending: false })

    let hwQ = supabase
      .from('homework_records')
      .select('id, student_id, subject_id, date, homework_title, status, students(id,name,student_code,classroom), subjects(subject_name)')
      .gte('date', filters.dateFrom).lte('date', filters.dateTo)
      .order('date', { ascending: false })

    if (filters.subject !== 'ទាំងអស់') {
      attQ = attQ.eq('subject_id', filters.subject)
      hwQ  = hwQ.eq('subject_id', filters.subject)
    }

    const [ar, hr] = await Promise.all([attQ, hwQ])
    let att = ar.data || []
    let hw  = hr.data || []

    if (filters.classroom !== 'ទាំងអស់') {
      att = att.filter(a => a.students?.classroom === filters.classroom)
      hw  = hw.filter(h => h.students?.classroom === filters.classroom)
    }

    setAttData(att)
    setHwData(hw)
    setLoading(false)
  }

  function setPreset(p) {
    const to = today()
    const from = p === 'today' ? to : startOf(p === 'week' ? 'week' : p === 'month' ? 'month' : 'semester')
    setFilters(f => ({ ...f, dateFrom: from, dateTo: to }))
  }

  // ---- aggregate per student ----
  function aggAtt() {
    const m = {}
    attData.forEach(a => {
      const k = a.student_id
      if (!m[k]) m[k] = { ...a.students, present: 0, excused: 0, absent: 0 }
      if (a.status === 'វត្តមាន')   m[k].present++
      else if (a.status === 'ច្បាប់')    m[k].excused++
      else if (a.status === 'អត់ច្បាប់') m[k].absent++
    })
    return Object.values(m).sort((a, b) => b.absent - a.absent)
  }

  function aggHw() {
    const m = {}
    hwData.forEach(h => {
      const k = h.student_id
      if (!m[k]) m[k] = { ...h.students, done: 0, half: 0, notDone: 0 }
      if (h.status === 'បានធ្វើ')            m[k].done++
      else if (h.status === 'ធ្វើបានពាក់កណ្តាល') m[k].half++
      else if (h.status === 'មិនបានធ្វើ')        m[k].notDone++
    })
    return Object.values(m).sort((a, b) => b.notDone - a.notDone)
  }

  const dailyAbsent  = attData.filter(a => a.status !== 'វត្តមាន')
  const dailyMissing = hwData.filter(h => h.status !== 'បានធ្វើ')

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">របាយការណ៍</h2>

      {/* Filter panel */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">ថ្នាក់</label>
            <select value={filters.classroom} onChange={e => setFilters(f => ({ ...f, classroom: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
              <option>ទាំងអស់</option>
              {classrooms.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">មុខវិជ្ជា</label>
            <select value={filters.subject} onChange={e => setFilters(f => ({ ...f, subject: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
              <option value="ទាំងអស់">ទាំងអស់</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">ចាប់ពី</label>
            <input type="date" value={filters.dateFrom}
              onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">រហូតដល់</label>
            <input type="date" value={filters.dateTo}
              onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* Preset buttons */}
        <div className="flex flex-wrap gap-2 mb-3">
          {[['today','ថ្ងៃនេះ'],['week','សប្ដាហ៍'],['month','ខែ'],['semester','ឆមាស']].map(([k,l]) => (
            <button key={k} onClick={() => setPreset(k)}
              className="px-3 py-1 text-xs border rounded-full text-gray-600 hover:bg-gray-100">
              {l}
            </button>
          ))}
        </div>

        {/* Mode + Run */}
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            {[['daily','ប្រចាំថ្ងៃ / ជ្រើស'],['summary','សង្ខេបតាមសិស្ស']].map(([k,l]) => (
              <button key={k} onClick={() => setMode(k)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  mode === k ? 'bg-blue-600 text-white' : 'border text-gray-600 hover:bg-gray-50'
                }`}>
                {l}
              </button>
            ))}
          </div>
          <button onClick={runReport} disabled={loading}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 font-medium">
            {loading ? 'កំពុងស្វែង…' : 'ទាញរបាយការណ៍'}
          </button>
        </div>
      </div>

      {/* Results */}
      {!hasRun && (
        <div className="text-center py-16 text-gray-400">
          ជ្រើសតម្រង រួចចុច "ទាញរបាយការណ៍"
        </div>
      )}

      {hasRun && mode === 'daily' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ResultTable
            title={`សិស្សអវត្តមាន (${dailyAbsent.length})`}
            headerBg="bg-red-50 border-red-100"
            headerText="text-red-800"
            rows={dailyAbsent}
            cols={[
              { label: 'ឈ្មោះ',     render: r => <><div>{r.students?.name}</div><div className="text-xs text-gray-400">{r.students?.classroom}</div></> },
              { label: 'មុខវិជ្ជា',  render: r => <span className="text-xs">{r.subjects?.subject_name}</span> },
              { label: 'ស្ថានភាព',  render: r => <StatusBadge status={r.status} /> },
              { label: 'ថ្ងៃ',       render: r => <span className="text-xs text-gray-500">{r.date}</span> },
            ]}
          />
          <ResultTable
            title={`កិច្ចការមិនបានធ្វើ (${dailyMissing.length})`}
            headerBg="bg-orange-50 border-orange-100"
            headerText="text-orange-800"
            rows={dailyMissing}
            cols={[
              { label: 'ឈ្មោះ',     render: r => <><div>{r.students?.name}</div><div className="text-xs text-gray-400">{r.students?.classroom}</div></> },
              { label: 'កិច្ចការ',   render: r => <span className="text-xs">{r.homework_title}</span> },
              { label: 'ស្ថានភាព',  render: r => <StatusBadge status={r.status} /> },
            ]}
          />
        </div>
      )}

      {hasRun && mode === 'summary' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Attendance summary */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
              <h3 className="font-semibold text-blue-800">សង្ខេបវត្តមានតាមសិស្ស</h3>
            </div>
            {aggAtt().length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">គ្មានទិន្នន័យ</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left text-gray-600 font-medium">ឈ្មោះ</th>
                    <th className="px-3 py-2 text-center text-green-600 font-medium">វត្ត</th>
                    <th className="px-3 py-2 text-center text-yellow-600 font-medium">ច្បាប់</th>
                    <th className="px-3 py-2 text-center text-red-600 font-medium">អត់ច្បាប់</th>
                  </tr>
                </thead>
                <tbody>
                  {aggAtt().map(s => (
                    <tr key={s.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-gray-400">{s.classroom}</div>
                      </td>
                      <td className="px-3 py-2 text-center font-semibold text-green-600">{s.present}</td>
                      <td className="px-3 py-2 text-center font-semibold text-yellow-600">{s.excused}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`font-bold ${s.absent > 0 ? 'text-red-600' : 'text-gray-300'}`}>{s.absent}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Homework summary */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 bg-purple-50 border-b border-purple-100">
              <h3 className="font-semibold text-purple-800">សង្ខេបកិច្ចការតាមសិស្ស</h3>
            </div>
            {aggHw().length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">គ្មានទិន្នន័យ</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left text-gray-600 font-medium">ឈ្មោះ</th>
                    <th className="px-3 py-2 text-center text-green-600 font-medium">បានធ្វើ</th>
                    <th className="px-3 py-2 text-center text-yellow-600 font-medium">ពាក់កណ្ដាល</th>
                    <th className="px-3 py-2 text-center text-red-600 font-medium">មិនធ្វើ</th>
                  </tr>
                </thead>
                <tbody>
                  {aggHw().map(s => (
                    <tr key={s.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-gray-400">{s.classroom}</div>
                      </td>
                      <td className="px-3 py-2 text-center font-semibold text-green-600">{s.done}</td>
                      <td className="px-3 py-2 text-center font-semibold text-yellow-600">{s.half}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`font-bold ${s.notDone > 0 ? 'text-red-600' : 'text-gray-300'}`}>{s.notDone}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ResultTable({ title, headerBg, headerText, rows, cols }) {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className={`px-4 py-3 border-b ${headerBg}`}>
        <h3 className={`font-semibold ${headerText}`}>{title}</h3>
      </div>
      {rows.length === 0 ? (
        <div className="p-8 text-center text-gray-400 text-sm">គ្មានទិន្នន័យ</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {cols.map(c => (
                  <th key={c.label} className="px-3 py-2 text-left text-gray-600 font-medium">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b hover:bg-gray-50">
                  {cols.map(c => (
                    <td key={c.label} className="px-3 py-2">{c.render(r)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    'ច្បាប់':            'bg-yellow-100 text-yellow-700',
    'អត់ច្បាប់':         'bg-red-100 text-red-700',
    'ធ្វើបានពាក់កណ្តាល': 'bg-yellow-100 text-yellow-700',
    'មិនបានធ្វើ':        'bg-red-100 text-red-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}
