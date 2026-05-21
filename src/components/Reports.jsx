import React, { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'

function today() { return new Date().toISOString().split('T')[0] }

function startOf(unit) {
  const d = new Date()
  if (unit === 'week')     { const day = d.getDay() || 7; d.setDate(d.getDate() - day + 1) }
  else if (unit === 'month')    { d.setDate(1) }
  else if (unit === 'semester') { d.setDate(1); d.setMonth(d.getMonth() >= 7 ? 7 : 0) }
  return d.toISOString().split('T')[0]
}

export default function Reports() {
  const [subjects,   setSubjects]   = useState([])
  const [classrooms, setClassrooms] = useState([])
  const [filters,    setFilters]    = useState({
    classroom: 'ទាំងអស់', subject: 'ទាំងអស់',
    dateFrom: today(), dateTo: today(),
  })
  const [mode,    setMode]    = useState('daily')
  const [attData, setAttData] = useState([])
  const [hwData,  setHwData]  = useState([])
  const [loading, setLoading] = useState(false)
  const [hasRun,  setHasRun]  = useState(false)

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
    setLoading(true); setHasRun(true)

    // Fetch all pages (500/batch) to bypass Supabase 1000-row default limit
    async function fetchAll(table, select, extraFilters = []) {
      const BATCH = 500
      let all = []; let from = 0; let hasMore = true
      while (hasMore) {
        let q = supabase.from(table).select(select)
          .gte('date', filters.dateFrom).lte('date', filters.dateTo)
          .order('date', { ascending: false })
          .range(from, from + BATCH - 1)
        if (filters.subject !== 'ទាំងអស់') q = q.eq('subject_id', filters.subject)
        if (filters.classroom !== 'ទាំងអស់') {
          // filter classroom via students join — handled post-fetch below
        }
        extraFilters.forEach(f => { q = q[f.fn](...f.args) })
        const { data } = await q
        const rows = data || []
        all = all.concat(rows)
        hasMore = rows.length === BATCH
        from += BATCH
      }
      return all
    }

    const [att, hw] = await Promise.all([
      fetchAll('attendance',
        'id,student_id,subject_id,date,status,students(id,name,student_code,classroom),subjects(subject_name)'),
      fetchAll('homework_records',
        'id,student_id,subject_id,date,homework_title,status,students(id,name,student_code,classroom),subjects(subject_name)'),
    ])

    const filtAtt = filters.classroom !== 'ទាំងអស់' ? att.filter(a => a.students?.classroom === filters.classroom) : att
    const filtHw  = filters.classroom !== 'ទាំងអស់' ? hw.filter(h => h.students?.classroom === filters.classroom)  : hw

    setAttData(filtAtt); setHwData(filtHw)
    setLoading(false)
  }

  function setPreset(p) {
    const to   = today()
    const from = p === 'today' ? to : startOf(p === 'week' ? 'week' : p === 'month' ? 'month' : 'semester')
    setFilters(f => ({ ...f, dateFrom: from, dateTo: to }))
  }

  /* ── Aggregation ── */
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
      if (h.status === 'បានធ្វើ')             m[k].done++
      else if (h.status === 'ធ្វើបានពាក់កណ្តាល') m[k].half++
      else if (h.status === 'មិនបានធ្វើ')         m[k].notDone++
    })
    return Object.values(m).sort((a, b) => b.notDone - a.notDone)
  }

  const dailyAbsent  = attData.filter(a => a.status !== 'វត្តមាន')
  const dailyMissing = hwData.filter(h => h.status !== 'បានធ្វើ')

  /* ── PDF Export ── */
  function exportPDF() {
    const subjectLabel = filters.subject === 'ទាំងអស់'
      ? 'ទាំងអស់'
      : subjects.find(s => String(s.id) === filters.subject)?.subject_name || filters.subject

    const rows = (data, cols) =>
      data.length
        ? data.map(r => `<tr>${cols.map(c => `<td>${c(r)}</td>`).join('')}</tr>`).join('')
        : `<tr><td colspan="${cols.length}" style="text-align:center;color:#9ca3af;padding:16px">គ្មានទិន្នន័យ</td></tr>`

    const badge = (text, color) =>
      `<span style="background:${color==='yellow'?'#fef9c3':'#fee2e2'};color:${color==='yellow'?'#92400e':'#991b1b'};padding:2px 8px;border-radius:9999px;font-size:11px">${text}</span>`

    let body = ''

    if (mode === 'daily') {
      body = `
        <div class="section">
          <h3>សិស្សអវត្តមាន (${dailyAbsent.length} នាក់)</h3>
          <table>
            <thead><tr><th>#</th><th>ឈ្មោះ</th><th>ថ្នាក់</th><th>មុខវិជ្ជា</th><th>ស្ថានភាព</th><th>ថ្ងៃ</th></tr></thead>
            <tbody>${rows(dailyAbsent, [
              (_, i) => i + 1,
              r => r.students?.name || '',
              r => r.students?.classroom || '',
              r => r.subjects?.subject_name || '',
              r => badge(r.status, r.status === 'ច្បាប់' ? 'yellow' : 'red'),
              r => r.date,
            ])}</tbody>
          </table>
        </div>
        <div class="section">
          <h3>សិស្សមិនបានធ្វើកិច្ចការ (${dailyMissing.length} នាក់)</h3>
          <table>
            <thead><tr><th>#</th><th>ឈ្មោះ</th><th>ថ្នាក់</th><th>កិច្ចការ</th><th>ស្ថានភាព</th></tr></thead>
            <tbody>${rows(dailyMissing, [
              (_, i) => i + 1,
              r => r.students?.name || '',
              r => r.students?.classroom || '',
              r => r.homework_title || '',
              r => badge(r.status, r.status === 'ធ្វើបានពាក់កណ្តាល' ? 'yellow' : 'red'),
            ])}</tbody>
          </table>
        </div>`
    } else {
      const agg = aggAtt(); const hw = aggHw()
      body = `
        <div class="section">
          <h3>សង្ខេបវត្តមានតាមសិស្ស</h3>
          <table>
            <thead><tr><th>#</th><th>ឈ្មោះ</th><th>ថ្នាក់</th><th style="color:#16a34a">វត្តមាន</th><th style="color:#ca8a04">ច្បាប់</th><th style="color:#dc2626">អត់ច្បាប់</th></tr></thead>
            <tbody>${rows(agg, [
              (_, i) => i + 1,
              r => r.name || '',
              r => r.classroom || '',
              r => r.present,
              r => r.excused,
              r => `<strong style="color:${r.absent>0?'#dc2626':'#9ca3af'}">${r.absent}</strong>`,
            ])}</tbody>
          </table>
        </div>
        <div class="section">
          <h3>សង្ខេបកិច្ចការតាមសិស្ស</h3>
          <table>
            <thead><tr><th>#</th><th>ឈ្មោះ</th><th>ថ្នាក់</th><th style="color:#16a34a">បានធ្វើ</th><th style="color:#ca8a04">ពាក់កណ្ដាល</th><th style="color:#dc2626">មិនធ្វើ</th></tr></thead>
            <tbody>${rows(hw, [
              (_, i) => i + 1,
              r => r.name || '',
              r => r.classroom || '',
              r => r.done,
              r => r.half,
              r => `<strong style="color:${r.notDone>0?'#dc2626':'#9ca3af'}">${r.notDone}</strong>`,
            ])}</tbody>
          </table>
        </div>`
    }

    const html = `<!DOCTYPE html>
<html lang="km">
<head>
  <meta charset="UTF-8">
  <title>របាយការណ៍ ${filters.dateFrom}</title>
  <link href="https://fonts.googleapis.com/css2?family=Hanuman:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Hanuman', sans-serif; padding: 30px; color: #111; font-size: 13px; }
    .header { margin-bottom: 20px; border-bottom: 2px solid #1d4ed8; padding-bottom: 12px; }
    .header h1 { font-size: 18px; color: #1d4ed8; margin-bottom: 4px; }
    .header p  { color: #6b7280; font-size: 12px; }
    .section { margin-bottom: 28px; }
    .section h3 { font-size: 14px; margin-bottom: 8px; color: #374151; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #1d4ed8; color: white; padding: 7px 10px; text-align: left; font-weight: 600; }
    td { padding: 6px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: middle; }
    tr:nth-child(even) td { background: #f9fafb; }
    @media print { body { padding: 15px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>របាយការណ៍អវត្តមាន និងកិច្ចការ</h1>
    <p>ចន្លោះ: <strong>${filters.dateFrom}</strong> — <strong>${filters.dateTo}</strong> &nbsp;|&nbsp; ថ្នាក់: <strong>${filters.classroom}</strong> &nbsp;|&nbsp; មុខវិជ្ជា: <strong>${subjectLabel}</strong></p>
  </div>
  ${body}
</body>
</html>`

    const win = window.open('', '_blank', 'width=960,height=720')
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 600)
  }

  /* ── Excel Export ── */
  function exportExcel() {
    const wb = XLSX.utils.book_new()

    if (mode === 'daily') {
      const ws1 = XLSX.utils.json_to_sheet(dailyAbsent.map((a, i) => ({
        'ល.រ': i + 1, 'ឈ្មោះ': a.students?.name || '', 'ថ្នាក់': a.students?.classroom || '',
        'មុខវិជ្ជា': a.subjects?.subject_name || '', 'ស្ថានភាព': a.status, 'ថ្ងៃ': a.date,
      })))
      ws1['!cols'] = [{ wch: 5 }, { wch: 22 }, { wch: 8 }, { wch: 16 }, { wch: 12 }, { wch: 12 }]
      XLSX.utils.book_append_sheet(wb, ws1, 'អវត្តមាន')

      const ws2 = XLSX.utils.json_to_sheet(dailyMissing.map((h, i) => ({
        'ល.រ': i + 1, 'ឈ្មោះ': h.students?.name || '', 'ថ្នាក់': h.students?.classroom || '',
        'មុខវិជ្ជា': h.subjects?.subject_name || '', 'កិច្ចការ': h.homework_title || '',
        'ស្ថានភាព': h.status, 'ថ្ងៃ': h.date,
      })))
      ws2['!cols'] = [{ wch: 5 }, { wch: 22 }, { wch: 8 }, { wch: 16 }, { wch: 24 }, { wch: 20 }, { wch: 12 }]
      XLSX.utils.book_append_sheet(wb, ws2, 'កិច្ចការ')
    } else {
      const ws1 = XLSX.utils.json_to_sheet(aggAtt().map((s, i) => ({
        'ល.រ': i + 1, 'ឈ្មោះ': s.name || '', 'ថ្នាក់': s.classroom || '',
        'វត្តមាន': s.present, 'ច្បាប់': s.excused, 'អត់ច្បាប់': s.absent,
      })))
      ws1['!cols'] = [{ wch: 5 }, { wch: 22 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 10 }]
      XLSX.utils.book_append_sheet(wb, ws1, 'សង្ខេបវត្តមាន')

      const ws2 = XLSX.utils.json_to_sheet(aggHw().map((s, i) => ({
        'ល.រ': i + 1, 'ឈ្មោះ': s.name || '', 'ថ្នាក់': s.classroom || '',
        'បានធ្វើ': s.done, 'ពាក់កណ្ដាល': s.half, 'មិនធ្វើ': s.notDone,
      })))
      ws2['!cols'] = [{ wch: 5 }, { wch: 22 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 10 }]
      XLSX.utils.book_append_sheet(wb, ws2, 'សង្ខេបកិច្ចការ')
    }

    XLSX.writeFile(wb, `report-${filters.dateFrom}-${filters.dateTo}.xlsx`)
  }

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

        {/* Presets */}
        <div className="flex flex-wrap gap-2 mb-3">
          {[['today','ថ្ងៃនេះ'],['week','សប្ដាហ៍'],['month','ខែ'],['semester','ឆមាស']].map(([k,l]) => (
            <button key={k} onClick={() => setPreset(k)}
              className="px-3 py-1 text-xs border rounded-full text-gray-600 hover:bg-gray-100">
              {l}
            </button>
          ))}
        </div>

        {/* Mode + actions */}
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div className="flex gap-2">
            {[['daily','ប្រចាំថ្ងៃ'],['summary','សង្ខេបតាមសិស្ស']].map(([k,l]) => (
              <button key={k} onClick={() => setMode(k)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  mode === k ? 'bg-blue-600 text-white' : 'border text-gray-600 hover:bg-gray-50'
                }`}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {hasRun && (attData.length > 0 || hwData.length > 0) && (
              <>
                <button onClick={exportExcel}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 font-medium flex items-center gap-1.5">
                  📊 Export Excel
                </button>
                <button onClick={exportPDF}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 font-medium flex items-center gap-1.5">
                  🖨️ Export PDF
                </button>
              </>
            )}
            <button onClick={runReport} disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 font-medium">
              {loading ? 'កំពុងស្វែង…' : 'ទាញរបាយការណ៍'}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {!hasRun && (
        <div className="text-center py-16 text-gray-400 text-sm">
          ជ្រើសតម្រង រួចចុច "ទាញរបាយការណ៍"
        </div>
      )}

      {hasRun && mode === 'daily' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ResultTable
            title={`សិស្សអវត្តមាន (${dailyAbsent.length})`}
            headerBg="bg-red-50 border-red-100" headerText="text-red-800"
            rows={dailyAbsent}
            cols={[
              { label: 'ឈ្មោះ',    render: r => <><div className="font-medium">{r.students?.name}</div><div className="text-xs text-gray-400">{r.students?.classroom}</div></> },
              { label: 'មុខវិជ្ជា', render: r => <span className="text-xs">{r.subjects?.subject_name}</span> },
              { label: 'ស្ថានភាព', render: r => <StatusBadge status={r.status} /> },
              { label: 'ថ្ងៃ',      render: r => <span className="text-xs text-gray-500">{r.date}</span> },
            ]}
          />
          <ResultTable
            title={`កិច្ចការមិនបានធ្វើ (${dailyMissing.length})`}
            headerBg="bg-orange-50 border-orange-100" headerText="text-orange-800"
            rows={dailyMissing}
            cols={[
              { label: 'ឈ្មោះ',    render: r => <><div className="font-medium">{r.students?.name}</div><div className="text-xs text-gray-400">{r.students?.classroom}</div></> },
              { label: 'កិច្ចការ',  render: r => <span className="text-xs">{r.homework_title}</span> },
              { label: 'ស្ថានភាព', render: r => <StatusBadge status={r.status} /> },
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
            {aggAtt().length === 0 ? <Empty /> : (
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
                      <td className="px-3 py-2"><div className="font-medium">{s.name}</div><div className="text-xs text-gray-400">{s.classroom}</div></td>
                      <td className="px-3 py-2 text-center font-semibold text-green-600">{s.present}</td>
                      <td className="px-3 py-2 text-center font-semibold text-yellow-600">{s.excused}</td>
                      <td className="px-3 py-2 text-center"><span className={`font-bold ${s.absent > 0 ? 'text-red-600' : 'text-gray-300'}`}>{s.absent}</span></td>
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
            {aggHw().length === 0 ? <Empty /> : (
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
                      <td className="px-3 py-2"><div className="font-medium">{s.name}</div><div className="text-xs text-gray-400">{s.classroom}</div></td>
                      <td className="px-3 py-2 text-center font-semibold text-green-600">{s.done}</td>
                      <td className="px-3 py-2 text-center font-semibold text-yellow-600">{s.half}</td>
                      <td className="px-3 py-2 text-center"><span className={`font-bold ${s.notDone > 0 ? 'text-red-600' : 'text-gray-300'}`}>{s.notDone}</span></td>
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
      {rows.length === 0 ? <Empty /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{cols.map(c => <th key={c.label} className="px-3 py-2 text-left text-gray-600 font-medium">{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b hover:bg-gray-50">
                  {cols.map(c => <td key={c.label} className="px-3 py-2">{c.render(r)}</td>)}
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
    'ច្បាប់':             'bg-yellow-100 text-yellow-700',
    'អត់ច្បាប់':          'bg-red-100 text-red-700',
    'ធ្វើបានពាក់កណ្តាល':  'bg-yellow-100 text-yellow-700',
    'មិនបានធ្វើ':         'bg-red-100 text-red-700',
  }
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>{status}</span>
}

function Empty() {
  return <div className="p-8 text-center text-gray-400 text-sm">គ្មានទិន្នន័យ</div>
}
