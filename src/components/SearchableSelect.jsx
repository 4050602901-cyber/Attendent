import React, { useState, useRef, useEffect } from 'react'

/**
 * Searchable combobox (classroom / subject dropdowns).
 *
 * Props
 *   value       – currently selected string
 *   onChange    – (newValue: string) => void
 *   options     – string[] already sorted
 *   placeholder – shown when nothing is selected
 *   label       – optional <label> text rendered above the input
 *   className   – extra Tailwind classes on the wrapper div
 */
export default function SearchableSelect({
  value, onChange, options = [],
  placeholder = 'ជ្រើស…', label = '', className = '',
}) {
  const [query, setQuery] = useState('')
  const [open,  setOpen]  = useState(false)
  const rootRef           = useRef()

  // When closed show the current value; when open show the live search query
  const inputValue = open ? query : (value ?? '')

  const filtered = query.trim()
    ? options.filter(o => o.toString().toLowerCase().includes(query.toLowerCase()))
    : options

  function pick(opt) { onChange(opt); setOpen(false); setQuery('') }

  function onFocus()  { setOpen(true); setQuery('') }
  function onInput(e) { setQuery(e.target.value); setOpen(true) }

  // Close when clicking outside
  useEffect(() => {
    function handler(e) {
      if (!rootRef.current?.contains(e.target)) { setOpen(false); setQuery('') }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      )}

      {/* Input */}
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onFocus={onFocus}
          onChange={onInput}
          placeholder={open ? 'វាយដើម្បីស្វែង…' : placeholder}
          className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 pr-7 bg-white"
        />
        <span
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ fontSize: 10 }}
        >▾</span>
      </div>

      {/* Dropdown */}
      {open && (
        <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {filtered.length > 0
            ? filtered.map(opt => (
                <li
                  key={opt}
                  onMouseDown={() => pick(opt)}
                  className={`px-3 py-2 cursor-pointer text-sm select-none ${
                    opt === value
                      ? 'bg-blue-100 text-blue-700 font-semibold'
                      : 'text-gray-700 hover:bg-blue-50'
                  }`}
                >
                  {opt}
                </li>
              ))
            : (
                <li className="px-3 py-3 text-sm text-gray-400 text-center">
                  {query ? `រកមិនឃើញ "${query}"` : 'គ្មានជម្រើស'}
                </li>
              )
          }
        </ul>
      )}
    </div>
  )
}
