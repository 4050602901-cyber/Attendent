import { qdb as supabase } from './supabase'

/**
 * Fetch every row from a Supabase query in 500-row batches.
 * Pass a factory that returns a fresh query builder (without .range()).
 */
export async function fetchAllBatch(buildQuery, batchSize = 500) {
  let all = []; let from = 0; let hasMore = true
  const MAX = 100   // safety cap: 100 × 500 = 50 000 rows max
  let page = 0
  while (hasMore && page < MAX) {
    const { data, error } = await buildQuery().range(from, from + batchSize - 1)
    if (error) break          // stop on error instead of looping forever
    const rows = data || []
    all = all.concat(rows)
    hasMore = rows.length === batchSize
    from += batchSize
    page++
  }
  return all
}

/**
 * Natural sort for classroom names — numeric grade first, then suffix.
 * "10A" < "10B" < "11A"  ·  "10ក" < "10ខ" < "11ក"  etc.
 */
export function classroomSort(a, b) {
  const na = parseInt(a, 10) || 0
  const nb = parseInt(b, 10) || 0
  if (na !== nb) return na - nb
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })
}

/**
 * Return every distinct classroom name, naturally sorted.
 * Safe for schools with > 1 000 students.
 */
export async function fetchAllClassrooms() {
  const rows = await fetchAllBatch(() => supabase.from('students').select('classroom'))
  return [...new Set(rows.map(r => r.classroom))].sort(classroomSort)
}
