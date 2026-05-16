'use client'

import { UserDataProvider } from '@/contexts/user-data-context'

export function DashboardProviders({ children }: { children: React.ReactNode }) {
  return <UserDataProvider>{children}</UserDataProvider>
}
