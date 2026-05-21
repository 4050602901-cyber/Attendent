import React, { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'

const PAGE_SIZE = 100

const DEFAULT_CLASSROOMS = [
  '10ក','10ខ','10គ','10ឃ',
  '11ក','11ខ','11គ','11ឃ',
  '12ក','12ខ','12គ','12ឃ',
]

const STATUS_META = {
  active:   { label: 'កំពុងរៀន', cls: 'bg-green-100 text-green-700' },
  quit:     { label: 'ឈប់រៀន',  cls: 'bg-red-100 text-red-600'     },
  transfer: { label: 'ដូរសាលា', cls: 'bg-orange-100 text-orange-600' },
}

const EMPTY_FORM = { student_code: '', name: '', gender: 'ប្រុស', dob: '', classroom: '10ក', status: 'active' }

export default function StudentManagement() {
  const [students,     setStudents]     = useState([])
  const [total,        setTotal]        = useState(0)
  const [page,         setPage]         = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [showModal,    setShowModal]    = useState(false)
  const [editId,       setEditId]       = useState(null)
  const [form,         setForm]         = useState(EMPTY_FORM)
  const [filterClass,  setFilterClass]  = useState('ទាំងអស់')
  const [filterStatus, setFilterStatus] = useState('ទាំងអស់')
  const [search,       setSearch]       = useState('')
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')

  // Import (add / update)
  const fileRef                          = useRef()
  const [importData,   setImportData]   = useState([])
  const [showImport,   setShowImport]   = useState(false)
  const [importing,    setImporting]    = useState(false)
  const [importLog,    setImportLog]    = useState('')

  // Delete via Excel
  const deleteFileRef                        = useRef()
  const [deletePreview, setDeletePreview]   = useState([])  // {code,name,classroom,status,found}
  const [showDelete,    setShowDelete]      = useState(false)
  const [deleting,      setDeleting]        = useState(false)
  const [deleteLog,     setDeleteLog]       = useState('')
  const [deleteConfirm, setDeleteConfirm]   = useState('')   // must type "DELETE"

  // Classrooms list (distinct)
  const [classrooms, setClassrooms] = useState(['ទាំងអស់'])

  // Reset to page 0 when filter / search changes
  useEffect(() => { setPage(0) }, [filterClass, filterStatus, search])
  useEffect(() => { fetchStudents() }, [page, filterClass, filterStatus, search]) // eslint-disable-line

  async function fetchStudents() {
    setLoading(true)
    let q = supabase
      .from('students').select('*', { count: 'exact' })
      .order('classroom').order('name')
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

    if (filterClass  !== 'ទាំងអស់') q = q.eq('classroom', filterClass)
    if (filterStatus !== 'ទាំងអស់') q = q.eq('status', filterStatus)
    if (search.trim())               q = q.or(`name.ilike.%${search.trim()}%,student_code.ilike.%${search.trim()}%`)

    const { data, count } = await q
    setStudents(data || [])
    setTotal(count || 0)
    setLoading(false)
  }

  useEffect(() => {
    // Fetch ALL classrooms in batches (bypasses 1000-row limit)
    ;(async () => {
      const BATCH = 500; let all = []; let from = 0; let hasMore = true
      while (hasMore) {
        const { data } = await supabase.from('students').select('classroom').range(from, from + BATCH - 1)
        const rows = data || []
        all = all.concat(rows)
        hasMore = rows.length === BATCH
        from += BATCH
      }
      setClassrooms(['ទាំងអស់', ...[...new Set(all.map(r => r.classroom))].sort()])
    })()
  }, [])

  /* ── Add / Edit ── */
  function openAdd()   { setForm(EMPTY_FORM); setEditId(null); setError(''); setShowModal(true) }
  function openEdit(s) {
    setForm({
      student_code: s.student_code, name: s.name, gender: s.gender,
      dob: s.dob || '', classroom: s.classroom, status: s.status || 'active',
    })
    setEditId(s.id); setError(''); setShowModal(true)
  }

  async function save() {
    if (!form.student_code.trim() || !form.name.trim() || !form.classroom.trim()) {
      setError('សូមបំពេញ អត្តលេខ, ឈ្មោះ និង ថ្នាក់រៀន'); return
    }
    setSaving(true); setError('')
    const payload = {
      student_code: form.student_code.trim(), name: form.name.trim(),
      gender: form.gender, dob: form.dob || null,
      classroom: form.classroom.trim(), status: form.status,
    }
    const res = editId
      ? await supabase.from('students').update(payload).eq('id', editId)
      : await supabase.from('students').insert(payload)
    if (res.error) setError(res.error.message.includes('unique') ? 'អត្តលេខនេះមានរួចហើយ' : res.error.message)
    else { setShowModal(false); fetchStudents() }
    setSaving(false)
  }

  async function remove(id, name) {
    if (!confirm(`លុប "${name}" មែនទេ?`)) return
    await supabase.from('students').delete().eq('id', id)
    fetchStudents()
  }

  /* ── Excel: Download Import Template ── */
  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['អត្តលេខ', 'ឈ្មោះ', 'ភេទ', 'ថ្ងៃខែឆ្នាំ', 'ថ្នាក់', 'ស្ថានភាព'],
      ['2024001', 'ហេង សុភា', 'ប្រុស', '2008-05-15', '10ក', 'active'],
      ['2024002', 'ស្រី ចន្ទី', 'ស្រី',  '2008-09-22', '10ក', 'active'],
    ])
    ws['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 8 }, { wch: 14 }, { wch: 8 }, { wch: 12 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'សិស្ស')
    XLSX.writeFile(wb, 'template-sisso.xlsx')
  }

  /* ── Excel: Download Delete Template ── */
  function downloadDeleteTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['អត្តលេខ'],
      ['2024001'],
      ['2024002'],
    ])
    ws['!cols'] = [{ wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'លុប')
    XLSX.writeFile(wb, 'template-lop-sisso.xlsx')
  }

  /* ── Excel: Parse Import file ── */
  function handleFile(e) {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const wb   = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' })
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: false, defval: '' })
      const parsed = rows.map(r => ({
        student_code: String(r['អត្តលេខ']     || '').trim(),
        name:         String(r['ឈ្មោះ']        || '').trim(),
        gender:       String(r['ភេទ']          || 'ប្រុស').trim(),
        dob:          String(r['ថ្ងៃខែឆ្នាំ']  || '').trim() || null,
        classroom:    String(r['ថ្នាក់']        || '').trim(),
        status:       ['active','quit','transfer'].includes(String(r['ស្ថានភាព'] || '').trim())
                        ? String(r['ស្ថានភាព']).trim() : 'active',
      })).filter(s => s.student_code && s.name && s.classroom)
      setImportData(parsed)
      setImportLog(parsed.length === 0 ? '⚠️ រកមិនឃើញទិន្នន័យ — ប្រើ template ដែលបានផ្ដល់' : '')
      setShowImport(true)
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  /* ── Excel: Batch upsert (200/chunk) ── */
  async function confirmImport() {
    setImporting(true); setImportLog('')
    const CHUNK = 200; let done = 0; let failed = 0
    for (let i = 0; i < importData.length; i += CHUNK) {
      const chunk = importData.slice(i, i + CHUNK)
      const { error } = await supabase
        .from('students').upsert(chunk, { onConflict: 'student_code' })
      if (error) failed += chunk.length
      else       done   += chunk.length
      setImportLog(`កំពុង import… ${done}/${importData.length} rows`)
    }
    setImporting(false)
    if (failed === 0) {
      setImportLog(`✅ Import ជោគជ័យ ${done} rows`)
      setTimeout(() => { setShowImport(false); setImportData([]); fetchStudents() }, 1500)
    } else {
      setImportLog(`⚠️ Import: ${done} ✅  ${failed} ❌ — ពិនិត្យ duplicate student_code`)
    }
  }

  /* ── Excel: Parse Delete file ── */
  function handleDeleteFile(e) {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      const wb   = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' })
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: false, defval: '' })
      const codes = [...new Set(
        rows.map(r => String(r['អត្តលេខ'] || '').trim()).filter(Boolean)
      )]
      if (codes.length === 0) {
        alert('⚠️ រកមិនឃើញ "អត្តលេខ" ក្នុង Excel — ប្រើ template ដែលបានផ្ដល់')
        e.target.value = ''; return
      }

      // Look up each code in DB (batch 200 per IN query)
      let found = []
      const BATCH = 200
      for (let i = 0; i < codes.length; i += BATCH) {
        const { data } = await supabase
          .from('students').select('student_code,name,classroom,status')
          .in('student_code', codes.slice(i, i + BATCH))
        if (data) found = found.concat(data)
      }

      const foundMap = Object.fromEntries(found.map(s => [s.student_code, s]))
      const preview = codes.map(code => ({
        code,
        name:      foundMap[code]?.name      ?? '—',
        classroom: foundMap[code]?.classroom ?? '—',
        status:    foundMap[code]?.status    ?? null,
        found:     !!foundMap[code],
      }))

      setDeletePreview(preview)
      setDeleteLog(''); setDeleteConfirm('')
      setShowDelete(true)
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  /* ── Bulk Delete: confirm ── */
  async function confirmBulkDelete() {
    const codes = deletePreview.filter(s => s.found).map(s => s.code)
    if (codes.length === 0) return
    setDeleting(true); setDeleteLog('')

    const CHUNK = 200; let done = 0; let failed = 0
    for (let i = 0; i < codes.length; i += CHUNK) {
      const batch = codes.slice(i, i + CHUNK)
      const { error } = await supabase.from('students').delete().in('student_code', batch)
      if (error) failed += batch.length
      else       done   += batch.length
      setDeleteLog(`កំពុងលុប… ${done}/${codes.length} នាក់`)
    }

    setDeleting(false)
    if (failed === 0) {
      setDeleteLog(`✅ លុបជោគជ័យ ${done} នាក់`)
      setTimeout(() => { setShowDelete(false); setDeletePreview([]); fetchStudents() }, 1500)
    } else {
      setDeleteLog(`⚠️ លុប: ${done} ✅  ${failed} ❌`)
    }
  }

  /* ── Excel: Export ALL rows in batches (no 1000-row cap) ── */
  async function exportStudents() {
    const BATCH = 500; let all = []; let from = 0; let hasMore = true
    while (hasMore) {
      let q = supabase.from('students').select('*').order('classroom').order('name').range(from, from + BATCH - 1)
      if (filterClass  !== 'ទាំងអស់') q = q.eq('classroom', filterClass)
      if (filterStatus !== 'ទាំងអស់') q = q.eq('status', filterStatus)
      if (search.trim())               q = q.or(`name.ilike.%${search.trim()}%,student_code.ilike.%${search.trim()}%`)
      const { data } = await q
      const rows = data || []
      all = all.concat(rows)
      hasMore = rows.length === BATCH
      from += BATCH
    }
    const exRows = all.map((s, i) => ({
      'ល.រ':        i + 1,
      'អត្តលេខ':   s.student_code,
      'ឈ្មោះ':     s.name,
      'ភេទ':        s.gender,
      'ថ្ងៃខែឆ្នាំ': s.dob || '',
      'ថ្នាក់':     s.classroom,
      'ស្ថានភាព':  STATUS_META[s.status || 'active']?.label ?? s.status,
    }))
    const ws = XLSX.utils.json_to_sheet(exRows)
    ws['!cols'] = [{ wch: 6 }, { wch: 12 }, { wch: 22 }, { wch: 8 }, { wch: 14 }, { wch: 8 }, { wch: 12 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'សិស្ស')
    XLSX.writeFile(wb, `sisso-${filterClass !== 'ទាំងអស់' ? filterClass : 'toangos'}-${all.length}rows.xlsx`)
  }

  const totalPages     = Math.ceil(total / PAGE_SIZE)
  const toDeleteCount  = deletePreview.filter(s => s.found).length
  const notFoundCount  = deletePreview.filter(s => !s.found).length

  return (
    <div>

      {/* ── Header ── */}
      <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
        <h2 className="text-xl font-bold text-gray-800">គ្រប់គ្រងព័ត៌មានសិស្ស</h2>
        <div className="flex flex-wrap gap-2">

          {/* Templates group */}
          <button onClick={downloadTemplate}
            className="px-3 py-2 border border-green-400 text-green-700 rounded-lg text-sm hover:bg-green-50">
            📥 Template បន្ថែម
          </button>
          <button onClick={downloadDeleteTemplate}
            className="px-3 py-2 border border-gray-400 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
            📥 Template លុប
          </button>

          {/* Import (add/update) */}
          <button onClick={() => fileRef.current.click()}
            className="px-3 py-2 border border-blue-400 text-blue-700 rounded-lg text-sm hover:bg-blue-50">
            📂 Import / Update
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />

          {/* Delete via Excel */}
          <button onClick={() => deleteFileRef.current.click()}
            className="px-3 py-2 border border-red-400 text-red-700 rounded-lg text-sm hover:bg-red-50">
            🗑️ លុបតាម Excel
          </button>
          <input ref={deleteFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleDeleteFile} />

          {/* Export */}
          <button onClick={exportStudents}
            className="px-3 py-2 border border-orange-400 text-orange-700 rounded-lg text-sm hover:bg-orange-50">
            📤 Export
          </button>

          {/* Add single */}
          <button onClick={openAdd}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 font-medium">
            + បន្ថែមសិស្ស
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-lg shadow p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">ថ្នាក់រៀន</label>
          <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
            {classrooms.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">ស្ថានភាព</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
            <option value="ទាំងអស់">ទាំងអស់</option>
            <option value="active">✅ កំពុងរៀន</option>
            <option value="quit">❌ ឈប់រៀន</option>
            <option value="transfer">🔄 ដូរសាលា</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">ស្វែងរក</label>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ឈ្មោះ ឬ អត្តលេខ…"
            className="border rounded-lg px-3 py-2 text-sm w-48 outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="ml-auto text-sm text-gray-500 self-center">
          សរុប: <strong className="text-gray-700">{total.toLocaleString()}</strong> នាក់
        </div>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">កំពុងផ្ទុក…</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">#</th>
                <th className="px-4 py-3 text-left font-medium">អត្តលេខ</th>
                <th className="px-4 py-3 text-left font-medium">ឈ្មោះ</th>
                <th className="px-4 py-3 text-left font-medium">ភេទ</th>
                <th className="px-4 py-3 text-left font-medium">ថ្ងៃខែឆ្នាំ</th>
                <th className="px-4 py-3 text-left font-medium">ថ្នាក់</th>
                <th className="px-4 py-3 text-left font-medium">ស្ថានភាព</th>
                <th className="px-4 py-3 text-center font-medium">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">គ្មានទិន្នន័យ</td></tr>
              ) : students.map((s, i) => {
                const st = STATUS_META[s.status || 'active'] ?? STATUS_META.active
                const inactive = s.status && s.status !== 'active'
                return (
                  <tr key={s.id} className={`border-b hover:bg-gray-50 ${inactive ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3 text-gray-400">{page * PAGE_SIZE + i + 1}</td>
                    <td className="px-4 py-3 font-mono text-blue-600 text-xs">{s.student_code}</td>
                    <td className={`px-4 py-3 font-medium ${inactive ? 'line-through text-gray-400' : ''}`}>{s.name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.gender === 'ប្រុស' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                        {s.gender}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{s.dob || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-medium">{s.classroom}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3 text-center space-x-2">
                      <button onClick={() => openEdit(s)} className="text-blue-600 text-xs px-2 py-1 border border-blue-200 rounded hover:bg-blue-50">កែ</button>
                      <button onClick={() => remove(s.id, s.name)} className="text-red-500 text-xs px-2 py-1 border border-red-200 rounded hover:bg-red-50">លុប</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between text-sm">
              <span className="text-gray-500">
                ទំព័រ {page + 1} / {totalPages} &nbsp;({total.toLocaleString()} នាក់)
              </span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="px-3 py-1 border rounded-lg hover:bg-gray-100 disabled:opacity-40">← មុន</button>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                  className="px-3 py-1 border rounded-lg hover:bg-gray-100 disabled:opacity-40">បន្ទាប់ →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-bold">{editId ? 'កែប្រែព័ត៌មានសិស្ស' : 'បន្ថែមសិស្សថ្មី'}</h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded">{error}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">អត្តលេខ *</label>
                  <input type="text" value={form.student_code} onChange={e => setForm({ ...form, student_code: e.target.value })}
                    placeholder="ឧ. 2024001"
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ថ្នាក់រៀន *</label>
                  <input type="text" list="cls-opts" value={form.classroom} onChange={e => setForm({ ...form, classroom: e.target.value })}
                    placeholder="ឧ. 10ក"
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  <datalist id="cls-opts">{DEFAULT_CLASSROOMS.map(c => <option key={c} value={c} />)}</datalist>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ឈ្មោះ *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="ឧ. ហេង សុភា"
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ភេទ</label>
                  <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                    <option>ប្រុស</option><option>ស្រី</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ថ្ងៃខែឆ្នាំ</label>
                  <input type="date" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ស្ថានភាព</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="active">✅ កំពុងរៀន</option>
                  <option value="quit">❌ ឈប់រៀន</option>
                  <option value="transfer">🔄 ដូរសាលា</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">បោះបង់</button>
              <button onClick={save} disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'កំពុងរក្សា…' : 'រក្សាទុក'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import / Update Modal ── */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">Preview — {importData.length.toLocaleString()} rows</h3>
                <p className="text-xs text-gray-500 mt-0.5">Student code ដែលមានរួចនឹង <strong>update ស្វ័យប្រវត្តិ</strong> · ថ្មីនឹងបន្ថែម</p>
              </div>
              <button onClick={() => setShowImport(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            {importLog && (
              <div className={`mx-6 mt-4 px-3 py-2 rounded text-sm ${importLog.startsWith('✅') ? 'bg-green-50 text-green-700' : importLog.startsWith('⚠️') ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                {importLog}
              </div>
            )}

            <div className="overflow-auto flex-1 px-6 py-4">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b sticky top-0">
                  <tr>
                    {['#','អត្តលេខ','ឈ្មោះ','ភេទ','ថ្ងៃខែឆ្នាំ','ថ្នាក់','ស្ថានភាព'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-gray-600 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {importData.slice(0, 200).map((s, i) => {
                    const st = STATUS_META[s.status] ?? STATUS_META.active
                    return (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2 font-mono text-blue-600 text-xs">{s.student_code}</td>
                        <td className="px-3 py-2 font-medium">{s.name}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${s.gender === 'ប្រុស' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                            {s.gender}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-500 text-xs">{s.dob || '—'}</td>
                        <td className="px-3 py-2">
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">{s.classroom}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span>
                        </td>
                      </tr>
                    )
                  })}
                  {importData.length > 200 && (
                    <tr><td colSpan={7} className="text-center py-3 text-gray-400 text-xs">… និង {importData.length - 200} rows ទៀត (preview 200 ដំបូង)</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-t flex justify-between items-center">
              <p className="text-xs text-gray-500">batch 200 · duplicate → update ស្វ័យប្រវត្តិ</p>
              <div className="flex gap-3">
                <button onClick={() => setShowImport(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">បោះបង់</button>
                <button onClick={confirmImport} disabled={importing || importData.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 font-medium">
                  {importing ? 'កំពុង Import…' : `✅ Import / Update ${importData.length.toLocaleString()} rows`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Delete Modal ── */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">

            {/* Header */}
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-red-700">🗑️ លុបសិស្សជាក្រុម</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {toDeleteCount > 0
                    ? <><span className="text-red-600 font-semibold">នឹងលុប {toDeleteCount} នាក់</span>{notFoundCount > 0 && <span className="text-gray-400 ml-2">· {notFoundCount} លេខរកមិនឃើញ</span>}</>
                    : <span className="text-gray-400">លេខទាំងអស់រកមិនឃើញក្នុងប្រព័ន្ធ</span>
                  }
                </p>
              </div>
              <button onClick={() => setShowDelete(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            {/* Log */}
            {deleteLog && (
              <div className={`mx-6 mt-4 px-3 py-2 rounded text-sm ${deleteLog.startsWith('✅') ? 'bg-green-50 text-green-700' : deleteLog.startsWith('⚠️') ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                {deleteLog}
              </div>
            )}

            {/* Preview list */}
            <div className="overflow-auto flex-1 px-6 py-4">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-gray-600 font-medium">#</th>
                    <th className="px-3 py-2 text-left text-gray-600 font-medium">អត្តលេខ</th>
                    <th className="px-3 py-2 text-left text-gray-600 font-medium">ឈ្មោះ</th>
                    <th className="px-3 py-2 text-left text-gray-600 font-medium">ថ្នាក់</th>
                    <th className="px-3 py-2 text-left text-gray-600 font-medium">ស្ថានភាព</th>
                  </tr>
                </thead>
                <tbody>
                  {deletePreview.map((s, i) => (
                    <tr key={i} className={`border-b ${s.found ? 'hover:bg-red-50' : 'opacity-40 bg-gray-50'}`}>
                      <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                      <td className="px-3 py-2 font-mono text-xs text-blue-600">{s.code}</td>
                      <td className="px-3 py-2 font-medium">{s.name}</td>
                      <td className="px-3 py-2">
                        {s.classroom !== '—'
                          ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">{s.classroom}</span>
                          : '—'
                        }
                      </td>
                      <td className="px-3 py-2">
                        {s.found
                          ? <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs font-medium">នឹងលុប</span>
                          : <span className="bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full text-xs">រកមិនឃើញ</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Confirm section */}
            {toDeleteCount > 0 ? (
              <div className="px-6 py-5 border-t bg-red-50 rounded-b-xl">
                <p className="text-sm text-red-700 font-semibold mb-1">
                  ⚠️ ការដំណើរការនេះ <strong>មិនអាចត្រឡប់វិញបានឡើយ!</strong>
                </p>
                <p className="text-xs text-red-600 mb-3">
                  សិស្ស {toDeleteCount} នាក់ និងប្រវត្តិ វត្តមាន / កិច្ចការ នឹងត្រូវ<strong>លុបចោលទាំងស្រុង</strong>។<br />
                  សូមវាយ <code className="bg-red-200 px-1 rounded font-bold">DELETE</code> ហើយចុចប៊ូតុងខាងក្រោម
                </p>
                <div className="flex flex-wrap gap-3 items-center">
                  <input
                    type="text"
                    value={deleteConfirm}
                    onChange={e => setDeleteConfirm(e.target.value)}
                    placeholder="DELETE"
                    className="border-2 border-red-300 rounded-lg px-3 py-2 text-sm w-32 outline-none focus:border-red-500 font-mono tracking-widest"
                  />
                  <button
                    onClick={confirmBulkDelete}
                    disabled={deleting || deleteConfirm !== 'DELETE'}
                    className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-40 font-semibold">
                    {deleting ? 'កំពុងលុប…' : `🗑️ លុប ${toDeleteCount} នាក់`}
                  </button>
                  <button onClick={() => setShowDelete(false)}
                    className="px-4 py-2 border rounded-lg text-sm hover:bg-white ml-auto">
                    បោះបង់
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-6 py-4 border-t flex justify-between items-center">
                <p className="text-sm text-gray-500">អត្តលេខ ដែលបានដាក់រកមិនឃើញ ក្នុងប្រព័ន្ធ</p>
                <button onClick={() => setShowDelete(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">បិទ</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
