import React, { useState } from 'react'
import { isConfigured } from './lib/supabase'
import Navigation from './components/Navigation'
import StudentManagement from './components/StudentManagement'
import AttendanceTracking from './components/AttendanceTracking'
import HomeworkTracking from './components/HomeworkTracking'
import Reports from './components/Reports'

export default function App() {
  const [activeTab, setActiveTab] = useState('students')

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-lg w-full p-8">
          <div className="text-4xl mb-4 text-center">⚙️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2 text-center">
            តំឡើង Supabase
          </h2>
          <p className="text-gray-500 text-sm text-center mb-6">
            Setup required before using the app
          </p>
          <ol className="space-y-3 text-sm text-gray-700">
            <li className="flex gap-3">
              <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-xs font-bold">1</span>
              <span>បង្កើត project នៅ <strong>supabase.com</strong></span>
            </li>
            <li className="flex gap-3">
              <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-xs font-bold">2</span>
              <span>ដំណើរការ SQL ក្នុង <strong>sql/schema.sql</strong> នៅ SQL Editor</span>
            </li>
            <li className="flex gap-3">
              <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-xs font-bold">3</span>
              <span>ចំលង <code className="bg-gray-100 px-1 rounded">.env.example</code> ទៅជា <code className="bg-gray-100 px-1 rounded">.env</code></span>
            </li>
            <li className="flex gap-3">
              <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-xs font-bold">4</span>
              <span>បំពេញ <code className="bg-gray-100 px-1 rounded">VITE_SUPABASE_URL</code> និង <code className="bg-gray-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> ពី Project Settings → API</span>
            </li>
            <li className="flex gap-3">
              <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-xs font-bold">5</span>
              <span>Restart server: <code className="bg-gray-100 px-1 rounded">npm run dev</code></span>
            </li>
          </ol>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold leading-tight">
            ប្រព័ន្ធគ្រប់គ្រងវត្តមាន និងកិច្ចការសិស្ស
          </h1>
          <p className="text-blue-200 text-sm mt-0.5">
            Student Attendance &amp; Homework Tracker
          </p>
        </div>
      </header>

      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'students'    && <StudentManagement />}
        {activeTab === 'attendance'  && <AttendanceTracking />}
        {activeTab === 'homework'    && <HomeworkTracking />}
        {activeTab === 'reports'     && <Reports />}
      </main>
    </div>
  )
}
