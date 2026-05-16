'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useSession } from '@/lib/auth-client'
import { getUser } from '@/app/actions/user'

interface UserDataContextType {
  userData: any
  loading: boolean
}

const UserDataContext = createContext<UserDataContextType>({
  userData: null,
  loading: true,
})

export function UserDataProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession()
  const [userData, setUserData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUserData = async () => {
      if (session?.user?.id) {
        try {
          const data = await getUser(session.user.id)
          setUserData(data)
        } catch (error) {
          console.error('Error fetching user data:', error)
        } finally {
          setLoading(false)
        }
      } else if (!isPending) {
        setLoading(false)
        setUserData(null)
      }
    }

    fetchUserData()
  }, [session?.user?.id, isPending])

  return (
    <UserDataContext.Provider value={{ userData, loading }}>
      {children}
    </UserDataContext.Provider>
  )
}

export function useUserDataContext() {
  return useContext(UserDataContext)
}
