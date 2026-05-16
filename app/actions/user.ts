"use server"
import { db } from "@/src/db"
import { user } from "@/auth-schema"
import { eq } from "drizzle-orm"
import { unstable_cache, revalidateTag } from "next/cache"

export async function getUser(userId: string) {
  const getCached = unstable_cache(
    async () => {
      const userData = await db.select().from(user).where(eq(user.id, userId)).execute()
      return userData[0]
    },
    [`user`, userId],
    { tags: [`user:${userId}`], revalidate: 3600 }
  )
  return getCached()
}

export async function updateLastLogin(userId: string) {
  const userUpdated = await db.update(user).set({ last_login: new Date() }).where(eq(user.id, userId)).returning().execute()
  revalidateTag(`user:${userId}`)
  return userUpdated[0]
}

export const isProfileComplete = async (userId: string) => {
  try {
    const u = await updateLastLogin(userId)
    return !!u && !!u.university_name && !!u.department
  } catch (error) {
    console.error('Error checking profile completion:', error)
    return false
  }
}

export async function updateUserProfile(userId: string, data: any) {
  await db.update(user).set({ ...data, last_login: new Date() }).where(eq(user.id, userId)).execute()
  revalidateTag(`user:${userId}`)
}
