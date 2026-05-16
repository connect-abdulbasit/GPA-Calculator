'use client'

import { useUserDataContext } from '@/contexts/user-data-context'
import { useSession } from '@/lib/auth-client'

export const useUserData = () => {
  return useUserDataContext()
}

export const useUserRole = () => {
  const { userData, loading } = useUserDataContext()
  return { userRole: userData?.role ?? 'student', loading }
}

export function useProfileCompletion() {
  const { userData, loading } = useUserDataContext()
  const { data: session, isPending } = useSession()

  const userLoggedIn = !!session?.user?.id
  const profileComplete = !!(userData?.university_name && userData?.department)

  return { profileComplete, loading: loading || isPending, userLoggedIn }
}
