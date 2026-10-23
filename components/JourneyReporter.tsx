'use client'
import { useEffect } from 'react'
import { trackJourney } from '@/lib/journey-client'
export function JourneyReporter() {
  useEffect(() => {
    trackJourney('visit')
  }, [])
  return null
}
