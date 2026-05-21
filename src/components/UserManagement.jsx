import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const ROLE_META = {
  admin:   { label: '👑 Admin',   cls: 'bg-purple-100 text-purple-700' },
  teacher: { label: '👨‍🏫 Teacher', cls: 'bg-blue-100 text-blue-700'    },
}

const EMPTY = { email: '', password: '', full_name: '', role: 'teacher' }

export default function UserManagement({ profile }) {
  const [users,    setUsers]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [view,     setView]     = useState('list')   // 'list' | 'create'
  const [form,     setForm]     = useState(EMPTY)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('created_at')
    setUsers(data || [])
    setLoading(false)
  }

  /* ── Change role ── */
  async function changeRole(userId, newRole) {
    if (userId === profile?.id) return   // prevent locking yourself out
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    if (!error) setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
  }

  /* ── Create account ── */
  async function createAccount() {
    if (!form.email.trim() || !form.password || !form.full_name.trim()) {
      setError('សូមបំពេញ ឈ្មោះ, Email និង ពាក្យសម្ងាត់'); return
    }
    if (form.password.length < 6) { setError('ពាក្យសម្ងាត់ត្រូវ ≥ 6 អក្សរ'); return }
    setSaving(true); setError(''); setSuccess('')

    // Save admin's session so we can restore it if signUp replaces it
    const { data: { session: adminSess } } = await supabase.auth.getSession()

    const { data, error: signUpErr } = await supabase.auth.signUp({
      email:    form.email.trim(),
      password: form.password,
      options:  { data: { full_name: form.full_name.trim(), role: form.role } },
    })

    if (signUpErr) { setError(signUpErr.message); setSaving(false); return }

    // If signUp returned a session, the admin was signed out → restore admin session
    if (data.session && adminSess) {
      try {
        await supabase.auth.setSession({
          access_token:  adminSess.access_token,
          refresh_token: adminSess.refresh_token,
        })
      } catch {
        // Token expired — let onAuthStateChange handle the logout + login screen
        setSaving(false); return
      }
    }

    // Insert profile manually in case trigger hasn't run yet
    if (data.user) {
      await supabase.from('profiles').upsert({
        id:        data.user.id,
        full_name: form.full_name.trim(),
        email:     form.email.trim(),
        role:      form.role,
      }, { onConflict: 'id' })
    }

    const note = data.session ? '' : ' (Email confirmation sent)'
    setSuccess(`✅ Account created${note}: ${form.email}`)
    setForm(EMPTY)
    setTimeout(loadUsers, 800)
    setSaving(false)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
        <h2 className="text-xl font-bold text-gray-800">គ្រប់គ្រង Account</h2>
        <div className="flex gap-2">
          {[['list','👥 Account ទាំងអស់'],['create','+ បង្កើត Account']].map(([k,l]) => (
            <button key={k} onClick={() => { setView(k); setError(''); setSuccess('') }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                view === k ? 'bg-blue-600 text-white' : 'border text-gray-600 hover:bg-gray-50'
              }`}>
              {l}
            </button>
          ))}
        </div>
      </div>

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
                    <th className="px-4 py-3 text-left font-medium">បង្កើតនៅ</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0
                    ? <tr><td colSpan={5} className="text-center py-10 text-gray-400">គ្មានអ្នកប្រើ</td></tr>
                    : users.map((u, i) => {
                        const rm    = ROLE_META[u.role] ?? ROLE_META.teacher
                        const isSelf = u.id === profile?.id
                        return (
                          <tr key={u.id} className={`border-b hover:bg-gray-50 ${isSelf ? 'bg-blue-50/40' : ''}`}>
                            <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                            <td className="px-4 py-3 font-medium">
                              {u.full_name || '—'}
                              {isSelf && (
                                <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">
                                  អ្នក
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 font-mono">{u.email}</td>
                            <td className="px-4 py-3">
                              {isSelf ? (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rm.cls}`}>
                                  {rm.label}
                                </span>
                              ) : (
                                <select
                                  value={u.role}
                                  onChange={e => changeRole(u.id, e.target.value)}
                                  className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer outline-none ${rm.cls}`}
                                >
                                  <option value="teacher">👨‍🏫 Teacher</option>
                                  <option value="admin">👑 Admin</option>
                                </select>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400">
                              {u.created_at?.slice(0, 10)}
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

      {/* ── Create Account ── */}
      {view === 'create' && (
        <div className="max-w-lg">
          <div className="bg-white rounded-xl shadow p-6 space-y-4">

            <div className="bg-blue-50 border border-blue-100 text-blue-700 text-xs px-3 py-2.5 rounded-lg">
              💡 <strong>ចំណាំ:</strong> ប្រសិន Email Confirmation ត្រូវបិទ (Supabase → Auth → Email → Disable) Account នឹង Active ភ្លាម
              · ប្រសិន Enable, Teacher នឹងទទួល Email ដើម្បី Confirm ។
            </div>

            {error   && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
            {success && <div className="bg-green-50 text-green-700 text-sm px-3 py-2 rounded-lg">{success}</div>}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ឈ្មោះ *</label>
              <input
                type="text" value={form.full_name}
                onChange={e => setForm({ ...form, full_name: e.target.value })}
                placeholder="ឧ. គ្រូ សុខ ចន្ទី"
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                type="email" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="teacher@school.edu.kh"
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ពាក្យសម្ងាត់ * <span className="text-gray-400 font-normal">(≥ 6 អក្សរ)</span></label>
              <input
                type="password" value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">តួនាទី</label>
              <select
                value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="teacher">👨‍🏫 Teacher — វត្តមាន / កិច្ចការ / របាយការណ៍ / Dashboard</option>
                <option value="admin">👑 Admin — ចូលប្រើ / គ្រប់គ្រងបានគ្រប់ Tab</option>
              </select>
            </div>

            <button
              onClick={createAccount} disabled={saving}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'កំពុងបង្កើត…' : '+ បង្កើត Account'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
