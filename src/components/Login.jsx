import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [mode,     setMode]     = useState('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [msg,      setMsg]      = useState('')

  const [installPrompt, setInstallPrompt] = useState(null)
  const [installed,     setInstalled]     = useState(false)

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    if (window.matchMedia('(display-mode: standalone)').matches) setInstalled(true)
    window.addEventListener('appinstalled', () => { setInstalled(true); setInstallPrompt(null) })
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') { setInstalled(true); setInstallPrompt(null) }
  }

  async function submit(e) {
    e.preventDefault()
    setLoading(true); setError(''); setMsg('')

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message === 'Invalid login credentials'
        ? 'Email ឬ Password មិនត្រឹមត្រូវ'
        : error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setMsg('ពិនិត្យ Email ដើម្បី confirm account របស់អ្នក')
    }
    setLoading(false)
  }

  function switchMode(m) { setMode(m); setError(''); setMsg('') }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-700 to-blue-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
        <div className="text-center mb-7">
          <div className="text-5xl mb-3">🏫</div>
          <h1 className="text-xl font-bold text-gray-800">ប្រព័ន្ធគ្រប់គ្រងសិស្ស</h1>
          <p className="text-gray-400 text-xs mt-1">Student Management System</p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg mb-4">{error}</div>}
        {msg   && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-3 py-2 rounded-lg mb-4">{msg}</div>}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus
              placeholder="គ្រូ@school.kh"
              className="w-full border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
              placeholder="••••••••"
              className="w-full border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {loading ? 'Loading…' : mode === 'login' ? '🔑 Login ចូល' : '✨ បង្កើត Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-5">
          {mode === 'login'
            ? <><span>គ្មាន account? </span><button onClick={() => switchMode('signup')} className="text-blue-600 hover:underline font-medium">Sign Up</button></>
            : <><span>មាន account? </span><button onClick={() => switchMode('login')} className="text-blue-600 hover:underline font-medium">Login</button></>}
        </p>

        {/* PWA Install Banner */}
        {installPrompt && !installed && (
          <div className="mt-5 border border-green-200 bg-green-50 rounded-xl p-3 flex items-center gap-3">
            <div className="text-2xl">📲</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-green-800">ដំឡើង App នៅលើទូរសព្ទ</p>
              <p className="text-xs text-green-600">ចូលប្រើបានលឿន ដូច App ពិតប្រាកដ</p>
            </div>
            <button onClick={handleInstall}
              className="shrink-0 bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-green-700 transition-colors">
              ដំឡើង
            </button>
          </div>
        )}

        {installed && (
          <p className="text-center text-xs text-green-600 mt-4">✅ App ត្រូវបានដំឡើងស្រេចហើយ</p>
        )}
      </div>
    </div>
  )
}
