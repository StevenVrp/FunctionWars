import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Live, Setup } from '../combat/live'
export const project = 'https://xsikgagwivfhmzlymdyd.supabase.co'
export const publicKey = 'sb_publishable_EhRqKYsln6ZblHyQkn2M3A_UNUAGtsr'
let instance: SupabaseClient | undefined
export function cloud() {
  return (instance ??= createClient(project, publicKey, {
    auth: { detectSessionInUrl: true },
  }))
}
export interface Room {
  code: string
  seat: number
  state: Live | null
  version: number
  now: number
  setup?: Setup
}
export async function roomRequest(body: object): Promise<Room> {
  const { data, error } = await cloud().auth.getSession()
  if (error || !data.session) throw Error('Sign in first.')
  const res = await fetch(project + '/functions/v1/fw-duel', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: publicKey,
      Authorization: 'Bearer ' + data.session.access_token,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  })
  const json = await res.json()
  if (!res.ok || json.error)
    throw Error(
      json.error ||
        json.message ||
        'Deploy the fw-duel Edge Function to enable rooms.',
    )
  return json
}
export const gameUrl = 'https://stevenvrp.github.io/FunctionWars/'
