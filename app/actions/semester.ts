"use server";

import { calculateSGPA, gradeScale } from "@/lib/gpa-calculations";
import { db } from "@/src/db";
import { assessmentsTable, coursesTable, semestersTable } from "@/src/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { unstable_cache, revalidateTag } from "next/cache";

export const addSemester = async (userId: string, name: string, status: "ongoing" | "completed") => {
  if(status === "ongoing"){
    const ongoingSemester = await db.select().from(semestersTable).where(and(eq(semestersTable.user_id, userId), eq(semestersTable.status, "ongoing"), eq(semestersTable.active, true))).execute();
    if(ongoingSemester.length > 0){
      throw new Error("You already have an ongoing semester. Please complete it first.");
    }
  }
  const result = await db.insert(semestersTable).values({
    user_id: userId,
    name,
    total_credits: 0,
    gpa: 0,
    status,
  });
  revalidateTag(`semesters:${userId}`)
  revalidateTag(`dashboard:${userId}`)
  return result
};

export const fetchSemesters = async (userId: string) => {
  const getCached = unstable_cache(
    async () => db
      .select()
      .from(semestersTable)
      .where(and(eq(semestersTable.user_id, userId), eq(semestersTable.active, true), eq(semestersTable.status, "completed")))
      .orderBy(asc(semestersTable.created_at))
      .execute(),
    [`semesters`, userId],
    { tags: [`semesters:${userId}`], revalidate: 3600 }
  )
  return getCached()
}

export const fetchSemestersWithCourses = async (userId: string) => {
  const getCached = unstable_cache(
    async () => {
      const results = await db
        .select()
        .from(semestersTable)
        .leftJoin(coursesTable, and(eq(semestersTable.id, coursesTable.semester_id), eq(coursesTable.active, true)))
        .where(and(eq(semestersTable.user_id, userId), eq(semestersTable.active, true)))
        .orderBy(asc(semestersTable.created_at))
        .execute()

      const semestersMap = new Map<string, any>()
      for (const row of results) {
        const semesterId = row.semesters.id
        if (!semestersMap.has(semesterId)) {
          semestersMap.set(semesterId, { ...row.semesters, courses: [] })
        }
        if (row.courses) {
          semestersMap.get(semesterId).courses.push({ ...row.courses, gpa: Number(row.courses.gpa) })
        }
      }

      const semesters = Array.from(semestersMap.values())
      for (const semester of semesters) {
        semester.courses.sort((a: any, b: any) => b.gpa - a.gpa)
      }
      return semesters
    },
    [`semesters-with-courses`, userId],
    { tags: [`semesters:${userId}`], revalidate: 3600 }
  )
  return getCached()
};

export const fetchSemesterById = async (semesterId: string, userId: string) => {
  const getCached = unstable_cache(
    async () => {
      const results = await db
        .select()
        .from(semestersTable)
        .where(and(eq(semestersTable.id, semesterId), eq(semestersTable.user_id, userId), eq(semestersTable.active, true)))
        .leftJoin(coursesTable, and(eq(semestersTable.id, coursesTable.semester_id), eq(coursesTable.active, true)))
        .leftJoin(assessmentsTable, and(eq(coursesTable.id, assessmentsTable.course_id), eq(assessmentsTable.active, true)))
        .orderBy(desc(coursesTable.gpa), desc(coursesTable.credit_hours))
        .execute()

      const semestersMap = new Map<string, any>()
      const coursesMap = new Map<string, any>()

      for (const row of results) {
        const sid = row.semesters.id
        if (!semestersMap.has(sid)) {
          semestersMap.set(sid, { ...row.semesters, courses: [] })
        }
        if (row.courses) {
          const courseId = row.courses.id
          if (!coursesMap.has(courseId)) {
            const course = { ...row.courses, gpa: Number(row.courses.gpa), assessments: [] }
            coursesMap.set(courseId, course)
            semestersMap.get(sid).courses.push(course)
          }
          if (row.assessments) {
            coursesMap.get(courseId).assessments.push(row.assessments)
          }
        }
      }

      return Array.from(semestersMap.values())[0]
    },
    [`semester`, semesterId, userId],
    { tags: [`semesters:${userId}`], revalidate: 3600 }
  )
  return getCached()
};


export const deleteSemester = async (semesterId: string, userId: string) => {
  const result = await Promise.all([
    db.update(semestersTable).set({ active: false }).where(and(eq(semestersTable.id, semesterId), eq(semestersTable.user_id, userId))).execute(),
    db.update(coursesTable).set({ active: false }).where(and(eq(coursesTable.semester_id, semesterId), eq(coursesTable.user_id, userId))).execute()
  ])
  revalidateTag(`semesters:${userId}`)
  revalidateTag(`dashboard:${userId}`)
  return result
};

export const updateSemester = async (semesterId: string, userId: string, name: string) => {
  const result = await db.update(semestersTable).set({ name }).where(and(eq(semestersTable.id, semesterId), eq(semestersTable.user_id, userId))).execute()
  revalidateTag(`semesters:${userId}`)
  return result
};

export const marksAsCompleted = async (semesterId: string, userId: string) => {
  const semester = await db.select().from(semestersTable).where(and(eq(semestersTable.id, semesterId), eq(semestersTable.user_id, userId))).execute();
  if(semester.length === 0){
    throw new Error("Semester not found");
  }

  const courses = await db.select().from(coursesTable)
    .leftJoin(assessmentsTable, and(eq(coursesTable.id, assessmentsTable.course_id), eq(assessmentsTable.active, true)))
    .where(and(eq(coursesTable.semester_id, semesterId), eq(coursesTable.user_id, userId), eq(coursesTable.active, true)))
    .execute();

  const coursesMap = new Map();
  for (const row of courses) {
    if (!coursesMap.has(row.courses.id)) {
      coursesMap.set(row.courses.id, { ...row.courses, assessments: [], totalWeightage: 0 })
    }
    if (row.assessments) {
      coursesMap.get(row.courses.id).assessments.push(row.assessments)
      coursesMap.get(row.courses.id).totalWeightage += row.assessments.weightage
    }
  }

  const coursesWithGPA = [];
  let totalCredits = 0;

  for (const course of coursesMap.values()) {
    totalCredits += course.credit_hours;

    if (course.totalWeightage !== 100) {
      throw new Error(`Course "${course.name}" does not have 100% total weightage (current: ${course.totalWeightage}%)`)
    }

    const totalWeightedScore = course.assessments.reduce((sum: number, assessment: any) => {
      const percentage = (assessment.marks_obtained / assessment.total_marks) * 100;
      return sum + (percentage * assessment.weightage) / 100;
    }, 0);

    const roundedPercentage = Math.round(totalWeightedScore);
    let courseGPA = 0;
    for (const grade of gradeScale) {
      const range = grade.range.split(" - ");
      if (range.length === 1) {
        if (range[0].endsWith("+") && roundedPercentage >= parseInt(range[0])) { courseGPA = grade.gpa; break; }
        if (range[0].startsWith("<") && roundedPercentage < parseInt(range[0].split("<")[1])) { courseGPA = grade.gpa; break; }
      } else {
        const min = parseFloat(range[0]);
        const max = parseFloat(range[1]);
        if (roundedPercentage >= min && roundedPercentage <= max) { courseGPA = grade.gpa; break; }
      }
    }

    await db.update(coursesTable).set({ gpa: courseGPA }).where(eq(coursesTable.id, course.id)).execute();
    coursesWithGPA.push({ ...course, gpa: courseGPA })
  }

  const sgpa = calculateSGPA(coursesWithGPA);
  const result = await db.update(semestersTable)
    .set({ status: "completed", gpa: sgpa, total_credits: totalCredits })
    .where(and(eq(semestersTable.id, semesterId), eq(semestersTable.user_id, userId)))
    .execute()

  revalidateTag(`semesters:${userId}`)
  revalidateTag(`dashboard:${userId}`)
  return result
};
