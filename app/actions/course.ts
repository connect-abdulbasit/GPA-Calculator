"use server";
import { calculateSGPA, calculateTotalCredits } from "@/lib/gpa-calculations";
import { db } from "@/src/db";
import { coursesTable, semestersTable } from "@/src/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";

export const addCourse = async (
  semesterId: string,
  userId: string,
  name: string,
  creditHours: number,
  gpa: number,
  type: string
) => {
  try {
    const course = await db.insert(coursesTable).values({
      semester_id: semesterId,
      user_id: userId,
      name,
      credit_hours: creditHours,
      gpa: gpa,
      type: type,
    }).returning().execute()
    await syncSemesterData(userId, semesterId)
    revalidateTag(`semesters:${userId}`)
    revalidateTag(`dashboard:${userId}`)
    return course[0].id
  } catch(error) {
    console.error('Error adding course:', error);
    throw new Error('Failed to add course');
  }
};

export const deleteCourse = async (courseId: string) => {
  try {
    const course = await db.update(coursesTable).set({ active: false })
      .where(and(eq(coursesTable.id, courseId), eq(coursesTable.active, true)))
      .returning().execute()
    await syncSemesterData(course[0].user_id, course[0].semester_id)
    revalidateTag(`semesters:${course[0].user_id}`)
    revalidateTag(`dashboard:${course[0].user_id}`)
  } catch(error) {
    console.error('Error deleting course:', error);
    throw new Error('Failed to delete course');
  }
};

export const updateCourse = async (
  courseId: string,
  userId: string,
  name: string,
  creditHours: number,
  gpa: number,
  type: string
) => {
  try {
    const course = await db
      .update(coursesTable)
      .set({ name, credit_hours: creditHours, gpa: gpa, type: type })
      .where(and(eq(coursesTable.id, courseId), eq(coursesTable.user_id, userId)))
      .returning().execute()
    await syncSemesterData(userId, course[0].semester_id)
    revalidateTag(`semesters:${userId}`)
    revalidateTag(`dashboard:${userId}`)
    return course[0].id
  } catch(error) {
    console.error('Error updating course:', error);
    throw new Error('Failed to update course');
  }
};

const syncSemesterData = async (userId: string, semesterId: string) => {
  try {
    const allActiveCourses = await db
      .select()
      .from(coursesTable)
      .where(and(eq(coursesTable.semester_id, semesterId), eq(coursesTable.active, true)))
      .execute();

    const nonCreditCourses = allActiveCourses.filter(course => course.type !== "non-credit");
    const sgpa = calculateSGPA(nonCreditCourses);
    const totalCredits = calculateTotalCredits(allActiveCourses);

    await db
      .update(semestersTable)
      .set({ gpa: sgpa, total_credits: totalCredits })
      .where(and(eq(semestersTable.id, semesterId), eq(semestersTable.user_id, userId), eq(semestersTable.active, true)))
      .execute();
  } catch (error) {
    console.error('Error syncing semester data:', error);
    throw new Error('Failed to sync semester data');
  }
};
