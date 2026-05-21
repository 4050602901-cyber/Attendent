import React from 'react'

// Tabs visible to admin
const ADMIN_TABS = [
  { id: 'dashboard',  label: 'Dashboard',        icon: '🏠' },
  { id: 'attendance', label: 'វត្តមាន',           icon: '📋' },
  { id: 'homework',   label: 'កិច្ចការ',           icon: '📝' },
  { id: 'reports',    label: 'របាយការណ៍',         icon: '📊' },
  { id: 'students',   label: 'គ្រប់គ្រងសិស្ស',    icon: '👨‍🎓' },
  { id: 'subjects',   label: 'មុខវិជ្ជា',          icon: '📚' },
  { id: 'users',      label: 'Account',            icon: '👥' },
]

// Tabs visible to teacher
const TEACHER_TABS = [
  { id: 'dashboard',  label: 'Dashboard',        icon: '🏠' },
  { id: 'attendance', label: 'វត្តមាន',           icon: '📋' },
  { id: 'homework',   label: 'កិច្ចការ',           icon: '📝' },
  { id: 'reports',    label: 'របាយការណ៍',         icon: '📊' },
]

// Tabs visible to mstudent (ប្រធានថ្នាក់)
const MSTUDENT_TABS = [
  { id: 'dashboard',   label: 'Dashboard',       icon: '🏠' },
  { id: 'attendance',  label: 'វត្តមានសិស្ស',    icon: '📋' },
  { id: 'teacher-att', label: 'វត្តមានគ្រូ',     icon: '👨‍🏫' },
]

export default function Navigation({ activeTab, setActiveTab, isAdmin = false, isMStudent = false }) {
  let tabs
  if (isAdmin)    tabs = ADMIN_TABS
  else if (isMStudent) tabs = MSTUDENT_TABS
  else            tabs = TEACHER_TABS

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm no-print">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  )
}
