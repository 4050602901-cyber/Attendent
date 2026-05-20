import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function SubjectManagement() {
  const [subjects, setSubjects] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [newName,  setNewName]  = useState('')
  const [editId,   setEditId]   = useState(null)
  const [editName, setEditName] = useState('')
  const [error,    setError]    = useState('')

  useEffect(() => { loadSubjects() }, [])

  async function loadSubjects() {
    setLoading(true)
    const { data } = await supabase.from('subjects').select('*').order('subject_name')
    setSubjects(data || [])
    setLoading(false)
  }

  async function add() {
    if (!newName.trim()) return
    setError('')
    const { error } = await supabase.from('subjects').insert({ subject_name: newName.trim() })
    if (error) setError('មុខវិជ្ជានេះមានរួចហើយ')
    else { setNewName(''); loadSubjects() }
  }

  async function update(id) {
    if (!editName.trim()) return
    await supabase.from('subjects').update({ subject_name: editName.trim() }).eq('id', id)
    setEditId(null)
    loadSubjects()
  }

  async function remove(id, name) {
    if (!confirm(`លុប "${name}" មែនទេ?\n⚠️ ទិន្នន័យវត្តមាន/កិច្ចការដែលភ្ជាប់នឹងត្រូវបានលុបផងដែរ`)) return
    await supabase.from('subjects').delete().eq('id', id)
    loadSubjects()
  }

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-bold text-gray-800 mb-6">គ្រប់គ្រងមុខវិជ្ជា</h2>

      {/* Add form */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">បន្ថែមមុខវិជ្ជាថ្មី</label>
        {error && <p className="text-red-600 text-xs mb-2">{error}</p>}
        <div className="flex gap-2">
          <input type="text" value={newName}
            onChange={e => { setNewName(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="ឧ. ជំនាញបច្ចេកវិទ្យា"
            className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={add} disabled={!newName.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-40 font-medium">
            + បន្ថែម
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-10 text-gray-400 text-sm">កំពុងផ្ទុក…</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 text-sm font-medium text-gray-600">
            មុខវិជ្ជាសរុប: <strong>{subjects.length}</strong>
          </div>
          {subjects.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">គ្មានទិន្នន័យ</div>
          ) : (
            <ul className="divide-y">
              {subjects.map((s, i) => (
                <li key={s.id} className="px-4 py-3 flex items-center gap-3">
                  <span className="text-gray-300 text-xs w-5">{i + 1}</span>
                  {editId === s.id ? (
                    <div className="flex gap-2 flex-1">
                      <input type="text" value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') update(s.id); if (e.key === 'Escape') setEditId(null) }}
                        autoFocus
                        className="flex-1 border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                      <button onClick={() => update(s.id)}
                        className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
                      <button onClick={() => setEditId(null)}
                        className="text-xs px-3 py-1.5 border rounded-lg hover:bg-gray-50">Cancel</button>
                    </div>
                  ) : (
                    <>
                      <span className="flex-1 font-medium text-sm">{s.subject_name}</span>
                      <button onClick={() => { setEditId(s.id); setEditName(s.subject_name) }}
                        className="text-blue-600 text-xs px-2 py-1 border border-blue-200 rounded hover:bg-blue-50">កែ</button>
                      <button onClick={() => remove(s.id, s.subject_name)}
                        className="text-red-500 text-xs px-2 py-1 border border-red-200 rounded hover:bg-red-50">លុប</button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
