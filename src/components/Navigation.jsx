import React from 'react'

const TABS = [
  { id: 'dashboard',  label: 'Dashboard',        icon: '🏠' },
  { id: 'students',   label: 'គ្រប់គ្រងសិស្ស', icon: '👨‍🎓' },
  { id: 'attendance', label: 'វត្តមាន',          icon: '📋' },
  { id: 'homework',   label: 'កិច្ចការ',          icon: '📝' },
  { id: 'reports',    label: 'របាយការណ៍',        icon: '📊' },
  { id: 'subjects',   label: 'មុខវិជ្ជា',        icon: '📚' },
]

export default function Navigation({ activeTab, setActiveTab }) {
  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm no-print">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex overflow-x-auto">
          {TABS.map(tab => (
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
