"use server"
import { assessmentsTable, db } from "@/src/db"
import { and, eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";

interface Assessment {
    course_id: string;
    user_id: string;
    semester_id: string;
    name: string;
    weightage: number;
    total_marks: number;
    marks_obtained: number;
}

export const addAssessment = async (assesmentData: Assessment) => {
  const existingAssessment = await db.select({ weightage: assessmentsTable.weightage })
    .from(assessmentsTable)
    .where(and(
      eq(assessmentsTable.course_id, assesmentData.course_id),
      eq(assessmentsTable.user_id, assesmentData.user_id),
      eq(assessmentsTable.semester_id, assesmentData.semester_id),
      eq(assessmentsTable.active, true)
    )).execute();
  const totalWeightage = existingAssessment.reduce((sum: number, assessment: any) => sum + assessment.weightage, 0);
  if (totalWeightage + assesmentData.weightage > 100) {
    throw new Error("Total weightage cannot be greater than 100%");
  }
  const result = await db.insert(assessmentsTable).values(assesmentData).returning();
  revalidateTag(`semesters:${assesmentData.user_id}`)
  return result
}

export const fetchAssessments = async (courseId: string, userId: string, semesterId: string) => {
    return await db.select().from(assessmentsTable).where(and(
      eq(assessmentsTable.course_id, courseId),
      eq(assessmentsTable.user_id, userId),
      eq(assessmentsTable.semester_id, semesterId),
      eq(assessmentsTable.active, true)
    )).execute();
}

export const updateAssessment = async (assessmentId: string, assessmentData: Assessment) => {
    const result = await db.update(assessmentsTable).set(assessmentData).where(eq(assessmentsTable.id, assessmentId)).returning();
    revalidateTag(`semesters:${assessmentData.user_id}`)
    return result
}

export const deleteAssessment = async (assessmentId: string, userId: string) => {
    const result = await db.update(assessmentsTable).set({ active: false }).where(eq(assessmentsTable.id, assessmentId)).returning();
    revalidateTag(`semesters:${userId}`)
    return result
}
