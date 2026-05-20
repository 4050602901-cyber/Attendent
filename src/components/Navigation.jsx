import React from 'react'

const TABS = [
  { id: 'students',   label: 'គ្រប់គ្រងសិស្ស',  icon: '👨‍🎓' },
  { id: 'attendance', label: 'កត់ត្រាវត្តមាន',   icon: '📋' },
  { id: 'homework',   label: 'កិច្ចការផ្ទះ',     icon: '📝' },
  { id: 'reports',    label: 'របាយការណ៍',        icon: '📊' },
]

export default function Navigation({ activeTab, setActiveTab }) {
  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
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
