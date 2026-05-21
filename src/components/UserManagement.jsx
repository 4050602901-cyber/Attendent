import React, { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase, adminDb, qdb } from '../lib/supabase'

// Use adminDb if available (bypasses rate limits), fall back to supabase
const authClient = adminDb || supabase

const ROLE_META = {
  admin:    { label: '👑 Admin',        cls: 'bg-purple-100 text-purple-700' },
  teacher:  { label: '👨‍🏫 Teacher',     cls: 'bg-blue-100   text-blue-700'   },
  mstudent: { label: '🎓 ប្រធានថ្នាក់', cls: 'bg-green-100  text-green-700'  },
}

const EMPTY = { email: '', password: '', full_name: '', role: 'teacher', classroom: '' }

// ── helpers ────────────────────────────────────────────────────────────────
function normaliseRole(raw = '') {
  const v = String(raw).trim().toLowerCase()
  if (v === 'admin') return 'admin'
  // Accept both 'mstudent' and Khmer 'ប្រធានថ្នាក់'
  if (v === 'mstudent' || raw.trim() === 'ប្រធានថ្នាក់') return 'mstudent'
  return 'teacher'
}

// Extract classroom from email if not provided
// e.g. grade12A@gmail.com → "12A", class10b@school.kh → "10B"
function extractClassroom(email = '') {
  const user = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '')
  const match = user.match(/(\d{1,2}[A-Za-z]?)$/i)
  return match ? match[1].toUpperCase() : ''
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

export default function UserManagement({ profile }) {
  const [users,      setUsers]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [view,       setView]       = useState('list')   // 'list' | 'create' | 'import'
  const [form,       setForm]       = useState(EMPTY)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  const [success,    setSuccess]    = useState('')

  // edit / delete state
  const [editingId,  setEditingId]  = useState(null)
  const [editForm,   setEditForm]   = useState({})
  const [editSaving, setEditSaving] = useState(false)
  const [deleteId,   setDeleteId]   = useState(null)   // confirm modal
  const [deleting,   setDeleting]   = useState(false)

  // import state
  const [importRows,    setImportRows]    = useState([])
  const [importRunning, setImportRunning] = useState(false)
  const [importDone,    setImportDone]    = useState(false)
  const fileRef = useRef()

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    setLoading(true)
    const { data } = await (qdb || supabase).from('profiles').select('*').order('created_at')
    setUsers(data || [])
    setLoading(false)
  }

  // ── Change role ──────────────────────────────────────────────────────────
  async function changeRole(userId, newRole) {
    if (userId === profile?.id) return
    const { error } = await (qdb || supabase).from('profiles').update({ role: newRole }).eq('id', userId)
    if (!error) setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
  }

  // ── Start editing ────────────────────────────────────────────────────────
  function startEdit(u) {
    setEditingId(u.id)
    setEditForm({ full_name: u.full_name || '', role: u.role, classroom: u.classroom || '', password: '' })
  }

  // ── Save edit ────────────────────────────────────────────────────────────
  async function saveEdit() {
    setEditSaving(true)
    const updates = {
      full_name: editForm.full_name.trim(),
      role:      editForm.role,
      classroom: editForm.role === 'mstudent' ? editForm.classroom.trim() : '',
    }
    await (qdb || supabase).from('profiles').update(updates).eq('id', editingId)

    // Update password if provided (requires adminDb)
    if (editForm.password && editForm.password.length >= 6 && adminDb) {
      await adminDb.auth.admin.updateUserById(editingId, { password: editForm.password })
    }

    setUsers(prev => prev.map(u => u.id === editingId ? { ...u, ...updates } : u))
    setEditingId(null)
    setEditSaving(false)
  }

  // ── Delete account ───────────────────────────────────────────────────────
  async function confirmDelete() {
    setDeleting(true)
    // Delete from auth.users (requires service role key)
    if (adminDb) {
      await adminDb.auth.admin.deleteUser(deleteId)
    } else {
      // Fallback: delete profile only
      await (qdb || supabase).from('profiles').delete().eq('id', deleteId)
    }
    setUsers(prev => prev.filter(u => u.id !== deleteId))
    setDeleteId(null)
    setDeleting(false)
  }

  // ── Create one account ───────────────────────────────────────────────────
  async function signUpOne(full_name, email, password, role, classroom = '') {
    // Method 1: adminDb (service role key) — no rate limit, auto-confirm
    if (adminDb) {
      const { data, error: err } = await adminDb.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, role },
      })
      if (err) return { ok: false, msg: err.message }
      if (data?.user) {
        const profileData = { id: data.user.id, full_name, email, role,
          classroom: role === 'mstudent' ? classroom : '' }
        await adminDb.from('profiles').upsert(profileData, { onConflict: 'id' })
      }
      return { ok: true, msg: 'Active' }
    }

    // Method 2: RPC bulk_create_user (fallback if no service key)
    const { data, error } = await (qdb || supabase).rpc('bulk_create_user', {
      p_email:     email,
      p_password:  password,
      p_full_name: full_name,
      p_role:      role,
      p_classroom: role === 'mstudent' ? classroom : '',
    })
    if (error) return { ok: false, msg: error.message }
    if (!data?.ok) return { ok: false, msg: data?.msg || 'error' }
    return { ok: true, msg: 'Active' }
  }

  // ── Single form create ───────────────────────────────────────────────────
  async function createAccount() {
    if (!form.email.trim() || !form.password || !form.full_name.trim()) {
      setError('សូមបំពេញ ឈ្មោះ, Email និង ពាក្យសម្ងាត់'); return
    }
    if (form.password.length < 6) { setError('ពាក្យសម្ងាត់ត្រូវ ≥ 6 អក្សរ'); return }
    if (form.role === 'mstudent' && !form.classroom.trim()) {
      setError('សូមបំពេញ ថ្នាក់រៀន សម្រាប់ ប្រធានថ្នាក់'); return
    }
    setSaving(true); setError(''); setSuccess('')
    const { ok, msg } = await signUpOne(
      form.full_name.trim(), form.email.trim(), form.password, form.role,
      form.role === 'mstudent' ? form.classroom.trim() : ''
    )
    if (!ok) { setError(msg) } else { setSuccess(`✅ បង្កើតរួច: ${form.email} (${msg})`); setForm(EMPTY); setTimeout(loadUsers, 800) }
    setSaving(false)
  }

  // ── Download Excel template ──────────────────────────────────────────────
  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['ឈ្មោះ', 'Email', 'ពាក្យសម្ងាត់', 'តួនាទី', 'ថ្នាក់រៀន'],
      ['គ្រូ សុខ ចន្ទី',   'sokchandi@school.edu.kh', 'pass123', 'teacher',  ''],
      ['គ្រូ លី វណ្ណ',    'livann@school.edu.kh',    'pass123', 'teacher',  ''],
      ['ប្រ. ហ៊ុន ចន្ទ', 'hunchan@school.edu.kh',   'pass123', 'mstudent', '10A'],
      ['ប្រ. សុខ ដារា',  'sokdara@school.edu.kh',   'pass123', 'mstudent', '11B'],
    ])
    ws['!cols'] = [{ wch: 24 }, { wch: 30 }, { wch: 14 }, { wch: 10 }, { wch: 12 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Accounts')
    XLSX.writeFile(wb, 'account_template.xlsx')
  }

  // ── Parse uploaded Excel ─────────────────────────────────────────────────
  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const wb = XLSX.read(ev.target.result, { type: 'array' })
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
      const parsed = rows.map(r => {
        const full_name = String(r['ឈ្មោះ']      || r['full_name'] || r['name']     || '').trim()
        const email     = String(r['Email']       || r['email']    || '').trim().toLowerCase()
        const password  = String(r['ពាក្យសម្ងាត់'] || r['password'] || '').trim()
        const role      = normaliseRole(r['តួនាទី'] || r['role']    || 'teacher')
        // Classroom: from column, or auto-extract from email for mstudent
        let classroom = String(r['ថ្នាក់រៀន'] || r['classroom'] || '').trim()
        if (!classroom && role === 'mstudent') classroom = extractClassroom(email)
        let warn = ''
        if (!full_name) warn = 'គ្មានឈ្មោះ'
        else if (!email || !email.includes('@')) warn = 'Email មិនត្រឹមត្រូវ'
        else if (password.length < 6) warn = 'ពាក្យសម្ងាត់ < 6 អក្សរ'
        else if (role === 'mstudent' && !classroom) warn = 'mstudent ត្រូវការ ថ្នាក់រៀន'
        return { full_name, email, password, role, classroom, _status: warn ? 'error' : 'ready', _msg: warn }
      }).filter(r => r.email || r.full_name)   // skip blank rows
      setImportRows(parsed)
      setImportDone(false)
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  // ── Run bulk import ──────────────────────────────────────────────────────
  async function runImport() {
    const valid = importRows.filter(r => r._status === 'ready')
    if (!valid.length) return
    setImportRunning(true)

    for (let i = 0; i < importRows.length; i++) {
      const row = importRows[i]
      if (row._status !== 'ready') continue

      setImportRows(prev => prev.map((r, idx) => idx === i ? { ...r, _status: 'loading' } : r))

      const { ok, msg } = await signUpOne(row.full_name, row.email, row.password, row.role, row.classroom || '')

      setImportRows(prev => prev.map((r, idx) =>
        idx === i ? { ...r, _status: ok ? 'done' : 'error', _msg: msg } : r
      ))

      // Small delay to respect Supabase rate limits
      if (i < importRows.length - 1) await sleep(400)
    }

    setImportRunning(false)
    setImportDone(true)
    setTimeout(loadUsers, 1000)
  }

  const importValid   = importRows.filter(r => r._status === 'ready').length
  const importErrors  = importRows.filter(r => r._status === 'error').length
  const importSuccess = importRows.filter(r => r._status === 'done').length

  const STATUS_ICON = { ready: '⏳', loading: '🔄', done: '✅', error: '❌' }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
        <h2 className="text-xl font-bold text-gray-800">គ្រប់គ្រង Account</h2>
        <div className="flex gap-2 flex-wrap">
          {[
            ['list',   '👥 Account ទាំងអស់'],
            ['create', '+ បង្កើត Account'],
            ['import', '📥 Import Excel'],
          ].map(([k, l]) => (
            <button key={k} onClick={() => { setView(k); setError(''); setSuccess('') }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                view === k ? 'bg-blue-600 text-white' : 'border text-gray-600 hover:bg-gray-50'
              }`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* ── Delete Confirm Modal ── */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <div className="text-3xl text-center mb-3">🗑️</div>
            <h3 className="text-lg font-bold text-gray-800 text-center mb-1">លុប Account?</h3>
            <p className="text-sm text-gray-500 text-center mb-5">
              {users.find(u => u.id === deleteId)?.full_name || users.find(u => u.id === deleteId)?.email}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} disabled={deleting}
                className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                បោះបង់
              </button>
              <button onClick={confirmDelete} disabled={deleting}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'កំពុងលុប…' : 'លុបចោល'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Users List ── */}
      {view === 'list' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading
            ? <div className="py-12 text-center text-gray-400">កំពុងផ្ទុក…</div>
            : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">#</th>
                    <th className="px-4 py-3 text-left font-medium">ឈ្មោះ</th>
                    <th className="px-4 py-3 text-left font-medium">Email</th>
                    <th className="px-4 py-3 text-left font-medium">តួនាទី</th>
                    <th className="px-4 py-3 text-left font-medium">ថ្នាក់រៀន</th>
                    <th className="px-4 py-3 text-left font-medium">បង្កើតនៅ</th>
                    <th className="px-4 py-3 text-center font-medium">សកម្មភាព</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0
                    ? <tr><td colSpan={7} className="text-center py-10 text-gray-400">គ្មានអ្នកប្រើ</td></tr>
                    : users.map((u, i) => {
                        const rm     = ROLE_META[u.role] ?? ROLE_META.teacher
                        const isSelf = u.id === profile?.id
                        const isEditing = editingId === u.id

                        // ── Edit row ──
                        if (isEditing) return (
                          <tr key={u.id} className="border-b bg-blue-50/30">
                            <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                            <td className="px-4 py-2">
                              <input value={editForm.full_name}
                                onChange={e => setEditForm(p => ({ ...p, full_name: e.target.value }))}
                                className="w-full border rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-400"
                                placeholder="ឈ្មោះ" />
                            </td>
                            <td className="px-4 py-2 text-xs text-gray-400 font-mono">{u.email}</td>
                            <td className="px-4 py-2">
                              <select value={editForm.role}
                                onChange={e => setEditForm(p => ({ ...p, role: e.target.value, classroom: '' }))}
                                className="text-xs border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400">
                                <option value="teacher">👨‍🏫 Teacher</option>
                                <option value="admin">👑 Admin</option>
                                <option value="mstudent">🎓 ប្រធានថ្នាក់</option>
                              </select>
                            </td>
                            <td className="px-4 py-2">
                              {editForm.role === 'mstudent'
                                ? <input value={editForm.classroom}
                                    onChange={e => setEditForm(p => ({ ...p, classroom: e.target.value }))}
                                    className="w-20 border rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-400"
                                    placeholder="10A" />
                                : <span className="text-gray-300 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-2">
                              <input value={editForm.password}
                                onChange={e => setEditForm(p => ({ ...p, password: e.target.value }))}
                                type="password" placeholder="Password ថ្មី (ទុកទទេ=មិនប្តូរ)"
                                className="w-full border rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-400" />
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex gap-1 justify-center">
                                <button onClick={saveEdit} disabled={editSaving}
                                  className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50">
                                  {editSaving ? '…' : '💾 រក្សា'}
                                </button>
                                <button onClick={() => setEditingId(null)}
                                  className="px-3 py-1 border rounded text-xs text-gray-500 hover:bg-gray-50">
                                  បោះបង់
                                </button>
                              </div>
                            </td>
                          </tr>
                        )

                        // ── Normal row ──
                        return (
                          <tr key={u.id} className={`border-b hover:bg-gray-50 ${isSelf ? 'bg-blue-50/40' : ''}`}>
                            <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                            <td className="px-4 py-3 font-medium">
                              {u.full_name || '—'}
                              {isSelf && <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">អ្នក</span>}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 font-mono">{u.email}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rm.cls}`}>{rm.label}</span>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {u.role === 'mstudent' && u.classroom
                                ? <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">{u.classroom}</span>
                                : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400">{u.created_at?.slice(0, 10)}</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1 justify-center">
                                <button onClick={() => startEdit(u)} title="កែប្រែ"
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                  ✏️
                                </button>
                                {!isSelf && (
                                  <button onClick={() => setDeleteId(u.id)} title="លុប"
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                    🗑️
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })
                  }
                </tbody>
              </table>
            )
          }
        </div>
      )}

      {/* ── Create Single Account ── */}
      {view === 'create' && (
        <div className="max-w-lg">
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <div className="bg-blue-50 border border-blue-100 text-blue-700 text-xs px-3 py-2.5 rounded-lg">
              💡 <strong>ចំណាំ:</strong> ប្រសិន Email Confirmation ត្រូវបិទ (Supabase → Auth → Email → Disable)
              Account នឹង Active ភ្លាម · ប្រសិន Enable, Teacher នឹងទទួល Email ដើម្បី Confirm ។
            </div>

            {error   && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
            {success && <div className="bg-green-50 text-green-700 text-sm px-3 py-2 rounded-lg">{success}</div>}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ឈ្មោះ *</label>
              <input type="text" value={form.full_name}
                onChange={e => setForm({ ...form, full_name: e.target.value })}
                placeholder="ឧ. គ្រូ សុខ ចន្ទី"
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input type="email" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="teacher@school.edu.kh"
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ពាក្យសម្ងាត់ * <span className="text-gray-400 font-normal">(≥ 6 អក្សរ)</span>
              </label>
              <input type="password" value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">តួនាទី</label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value, classroom: '' })}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                <option value="teacher">👨‍🏫 Teacher — វត្តមាន / កិច្ចការ / របាយការណ៍ / Dashboard</option>
                <option value="admin">👑 Admin — ចូលប្រើ / គ្រប់គ្រងបានគ្រប់ Tab</option>
                <option value="mstudent">🎓 ប្រធានថ្នាក់ — វត្តមានសិស្ស / វត្តមានគ្រូ</option>
              </select>
            </div>

            {form.role === 'mstudent' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ថ្នាក់រៀន *</label>
                <input
                  type="text"
                  value={form.classroom}
                  onChange={e => setForm({ ...form, classroom: e.target.value })}
                  placeholder="ឧ. 12A, 11B, 10C"
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">ប្រធានថ្នាក់នឹងអាចមើលតែថ្នាក់នេះប៉ុណ្ណោះ</p>
              </div>
            )}

            <button onClick={createAccount} disabled={saving}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? 'កំពុងបង្កើត…' : '+ បង្កើត Account'}
            </button>
          </div>
        </div>
      )}

      {/* ── Import from Excel ── */}
      {view === 'import' && (
        <div className="space-y-4 max-w-3xl">

          {/* Instructions */}
          <div className="bg-white rounded-xl shadow p-5">
            <h3 className="font-semibold text-gray-800 mb-3">📥 Import Account ពី Excel</h3>
            <div className="text-sm text-gray-600 space-y-1 mb-4">
              <p>Excel ត្រូវមាន column: <strong>ឈ្មោះ, Email, ពាក្យសម្ងាត់, តួនាទី, ថ្នាក់រៀន</strong></p>
              <p className="text-gray-400 text-xs">* តួនាទី: <code className="bg-gray-100 px-1 rounded">teacher</code> / <code className="bg-gray-100 px-1 rounded">admin</code> / <code className="bg-gray-100 px-1 rounded">mstudent</code></p>
              <p className="text-gray-400 text-xs">* ប្រធានថ្នាក់ (mstudent) ត្រូវបំពេញ ថ្នាក់រៀន ឧ. 10A, 11B · Teacher/Admin ទុកទទេ</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <button onClick={downloadTemplate}
                className="flex items-center gap-2 px-4 py-2 border border-green-300 text-green-700 bg-green-50 rounded-lg text-sm hover:bg-green-100 transition-colors">
                📄 ទាញ Template
              </button>
              <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm cursor-pointer hover:bg-blue-700 transition-colors">
                📂 ជ្រើស Excel File
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
              </label>
            </div>
          </div>

          {/* Preview table */}
          {importRows.length > 0 && (
            <div className="bg-white rounded-xl shadow overflow-hidden">
              <div className="px-4 py-3 border-b flex justify-between items-center flex-wrap gap-2">
                <div className="text-sm font-medium text-gray-700">
                  ទិន្នន័យ: <span className="text-blue-600">{importRows.length} rows</span>
                  {importValid > 0    && <span className="ml-2 text-green-600">✓ {importValid} ត្រៀម</span>}
                  {importErrors > 0   && <span className="ml-2 text-red-500">✗ {importErrors} ខុស</span>}
                  {importSuccess > 0  && <span className="ml-2 text-green-700 font-semibold">✅ {importSuccess} រួច</span>}
                </div>
                {!importDone && importValid > 0 && !importRunning && (
                  <button onClick={runImport}
                    className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                    ▶ បង្កើត {importValid} Account
                  </button>
                )}
                {importRunning && (
                  <span className="text-sm text-blue-500 animate-pulse">🔄 កំពុងបង្កើត…</span>
                )}
                {importDone && (
                  <button onClick={() => { setImportRows([]); setImportDone(false); }}
                    className="px-4 py-1.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                    ✖ Clear
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-500">#</th>
                      <th className="px-3 py-2 text-left text-gray-500">ឈ្មោះ</th>
                      <th className="px-3 py-2 text-left text-gray-500">Email</th>
                      <th className="px-3 py-2 text-left text-gray-500">ពាក្យសម្ងាត់</th>
                      <th className="px-3 py-2 text-left text-gray-500">តួនាទី</th>
                      <th className="px-3 py-2 text-left text-gray-500">ថ្នាក់រៀន</th>
                      <th className="px-3 py-2 text-left text-gray-500">ស្ថានភាព</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.map((r, i) => (
                      <tr key={i} className={`border-b ${
                        r._status === 'done'    ? 'bg-green-50' :
                        r._status === 'error'   ? 'bg-red-50'   :
                        r._status === 'loading' ? 'bg-blue-50'  : ''
                      }`}>
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2 font-medium">{r.full_name || <span className="text-red-400">—</span>}</td>
                        <td className="px-3 py-2 font-mono">{r.email}</td>
                        <td className="px-3 py-2 text-gray-400">{'•'.repeat(Math.min(r.password.length, 8))}</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            r.role === 'admin'    ? 'bg-purple-100 text-purple-700' :
                            r.role === 'mstudent' ? 'bg-green-100  text-green-700'  :
                                                    'bg-blue-100   text-blue-700'
                          }`}>
                            {r.role === 'admin' ? '👑 Admin' : r.role === 'mstudent' ? '🎓 ប្រធានថ្នាក់' : '👨‍🏫 Teacher'}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-700">
                          {r.role === 'mstudent'
                            ? (r.classroom
                                ? <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">{r.classroom}</span>
                                : <span className="text-red-400">គ្មាន!</span>)
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`font-medium ${
                            r._status === 'done'    ? 'text-green-600' :
                            r._status === 'error'   ? 'text-red-500'   :
                            r._status === 'loading' ? 'text-blue-500'  : 'text-gray-400'
                          }`}>
                            {STATUS_ICON[r._status]} {r._msg || (r._status === 'ready' ? 'ត្រៀម' : '')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
