import { supabase } from './supabase'

/**
 * Fetch every row from a query in batches, bypassing the Supabase / PostgREST
 * default 1 000-row cap.
 *
 * @param {() => import('@supabase/supabase-js').PostgrestFilterBuilder} buildQuery
 *   A factory that returns a fresh query builder each iteration (without .range()).
 * @param {number} batchSize  Rows per request (default 500, well under the 1 000 cap).
 * @returns {Promise<any[]>}  All rows concatenated.
 */
export async function fetchAllBatch(buildQuery, batchSize = 500) {
  let all = []; let from = 0; let hasMore = true
  while (hasMore) {
    const { data } = await buildQuery().range(from, from + batchSize - 1)
    const rows = data || []
    all = all.concat(rows)
    hasMore = rows.length === batchSize
    from += batchSize
  }
  return all
}

/**
 * Return every distinct classroom name, sorted.
 * Safe for schools with > 1 000 students.
 */
export async function fetchAllClassrooms() {
  const rows = await fetchAllBatch(() => supabase.from('students').select('classroom'))
  return [...new Set(rows.map(r => r.classroom))].sort()
}
