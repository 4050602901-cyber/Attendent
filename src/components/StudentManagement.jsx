import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const DEFAULT_CLASSROOMS = [
  '10ក','10ខ','10គ','10ឃ',
  '11ក','11ខ','11គ','11ឃ',
  '12ក','12ខ','12គ','12ឃ',
]

const EMPTY_FORM = { student_code: '', name: '', gender: 'ប្រុស', dob: '', classroom: '10ក' }

export default function StudentManagement() {
  const [students, setStudents]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [showModal, setShowModal]     = useState(false)
  const [editId, setEditId]           = useState(null)
  const [form, setForm]               = useState(EMPTY_FORM)
  const [filterClass, setFilterClass] = useState('ទាំងអស់')
  const [search, setSearch]           = useState('')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  useEffect(() => { fetchStudents() }, [])

  async function fetchStudents() {
    setLoading(true)
    const { data } = await supabase
      .from('students').select('*').order('classroom').order('name')
    setStudents(data || [])
    setLoading(false)
  }

  function openAdd() {
    setForm(EMPTY_FORM)
    setEditId(null)
    setError('')
    setShowModal(true)
  }

  function openEdit(s) {
    setForm({ student_code: s.student_code, name: s.name, gender: s.gender, dob: s.dob || '', classroom: s.classroom })
    setEditId(s.id)
    setError('')
    setShowModal(true)
  }

  async function save() {
    if (!form.student_code.trim() || !form.name.trim() || !form.classroom.trim()) {
      setError('សូមបំពេញ អត្តលេខ, ឈ្មោះ និង ថ្នាក់រៀន')
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      student_code: form.student_code.trim(),
      name: form.name.trim(),
      gender: form.gender,
      dob: form.dob || null,
      classroom: form.classroom.trim(),
    }
    const res = editId
      ? await supabase.from('students').update(payload).eq('id', editId)
      : await supabase.from('students').insert(payload)

    if (res.error) {
      setError(res.error.message.includes('unique') ? 'អត្តលេខនេះមានរួចហើយ' : res.error.message)
    } else {
      setShowModal(false)
      fetchStudents()
    }
    setSaving(false)
  }

  async function remove(id, name) {
    if (!confirm(`លុប "${name}" មែនទេ?`)) return
    await supabase.from('students').delete().eq('id', id)
    fetchStudents()
  }

  const classrooms = ['ទាំងអស់', ...new Set(students.map(s => s.classroom))]
  const filtered = students.filter(s => {
    const cls  = filterClass === 'ទាំងអស់' || s.classroom === filterClass
    const term = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.student_code.includes(search)
    return cls && term
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">គ្រប់គ្រងព័ត៌មានសិស្ស</h2>
        <button onClick={openAdd} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
          + បន្ថែមសិស្ស
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">ថ្នាក់រៀន</label>
          <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
            {classrooms.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">ស្វែងរក</label>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ឈ្មោះ ឬ អត្តលេខ…"
            className="border rounded-lg px-3 py-2 text-sm w-48 outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="ml-auto text-sm text-gray-500 self-center">
          សរុប: <strong className="text-gray-700">{filtered.length}</strong> នាក់
        </div>
      </div>

      {/* Table */}
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
                <th className="px-4 py-3 text-center font-medium">សកម្មភាព</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">គ្មានទិន្នន័យ</td></tr>
              ) : filtered.map((s, i) => (
                <tr key={s.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3 font-mono text-blue-600 text-xs">{s.student_code}</td>
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.gender === 'ប្រុស' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                      {s.gender}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{s.dob || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-medium">{s.classroom}</span>
                  </td>
                  <td className="px-4 py-3 text-center space-x-2">
                    <button onClick={() => openEdit(s)} className="text-blue-600 text-xs px-2 py-1 border border-blue-200 rounded hover:bg-blue-50">
                      កែ
                    </button>
                    <button onClick={() => remove(s.id, s.name)} className="text-red-500 text-xs px-2 py-1 border border-red-200 rounded hover:bg-red-50">
                      លុប
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
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
                  <input type="text" value={form.student_code}
                    onChange={e => setForm({ ...form, student_code: e.target.value })}
                    placeholder="ឧ. 2024001"
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ថ្នាក់រៀន *</label>
                  <input type="text" list="classroom-opts" value={form.classroom}
                    onChange={e => setForm({ ...form, classroom: e.target.value })}
                    placeholder="ឧ. 10ក"
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  <datalist id="classroom-opts">
                    {DEFAULT_CLASSROOMS.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ឈ្មោះ *</label>
                <input type="text" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="ឧ. ហេង សុភា"
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ភេទ</label>
                  <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                    <option>ប្រុស</option>
                    <option>ស្រី</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ថ្ងៃខែឆ្នាំកំណើត</label>
                  <input type="date" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
                បោះបង់
              </button>
              <button onClick={save} disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'កំពុងរក្សា…' : 'រក្សាទុក'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
