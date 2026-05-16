"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MoreHorizontal, BookOpen, Trash2, TrendingUp, Pencil, SquarePen } from "lucide-react"
import { AddAssessmentDialog } from "@/components/add-assessment-dialog"
import { EditAssessmentDialog } from "@/components/edit-assessment-dialog"
import { EditCourseDialog } from "@/components/edit-course-dialog"
import { toast } from "sonner"
import { deleteCourse } from "@/app/actions/course"
import { deleteAssessment } from "@/app/actions/assessment"
import { gradeScale } from "@/lib/gpa-calculations"

interface OngoingCourseCardProps {
  course: any
  isOngoing: boolean
}

export function OngoingCourseCard({ course, isOngoing }: OngoingCourseCardProps) {
  const [loading, setLoading] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const router = useRouter()
  const [editingAssessment, setEditingAssessment] = useState<any>(null)

  const calculateCurrentGrade = () => {
    if (course.assessments.length === 0) return { percentage: 0, weightageUsed: 0 }

    const totalWeightedScore = course.assessments.reduce((sum: number, assessment: any) => {
      const percentage = (assessment.marks_obtained / assessment.total_marks) * 100
      return sum + (percentage * assessment.weightage) / 100
    }, 0)

    const totalWeightage = course.assessments.reduce((sum: number, assessment: any) => sum + assessment.weightage, 0)

    return {
      percentage: totalWeightage > 0 ? totalWeightedScore : 0,
      weightageUsed: totalWeightage,
    }
  }
  const calculateGPAFromPercentage = (percentage: number) => {
    const roundedPercentage = Math.round(percentage)
    for (const grade of gradeScale) {
      const range = grade.range.split(" - ")
      if (range.length === 1) {
        // Handle special cases like "90+" or "< 50"
        if (range[0].endsWith("+") && roundedPercentage >= parseInt(range[0])) {
          return grade.gpa
        }
        if (range[0].startsWith("<") && roundedPercentage < parseInt(range[0].split("<")[1])) {
          return grade.gpa
        }
      } else {
        const min = parseFloat(range[0])
        const max = parseFloat(range[1])
        if (roundedPercentage >= min && roundedPercentage <= max) {
          return grade.gpa
        }
      }
    }
    return 0
  }

  const { percentage, weightageUsed } = calculateCurrentGrade()
  const gpa = weightageUsed === 100 && isOngoing ? calculateGPAFromPercentage(percentage) : null

  const handleDeleteCourse = async () => {
    if (!confirm("Are you sure you want to delete this course? This will also delete all assessments.")) {
      return
    }

    setLoading(true)
    try {
      await deleteCourse(course.id)
      toast.success("Course deleted successfully!")
      router.refresh()
    } catch (error) {
      toast.error("Failed to delete course")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAssessment = async (assessmentId: string) => {
    if (!confirm("Are you sure you want to delete this assessment?")) {
      return
    }

    try {
      await deleteAssessment(assessmentId, course.user_id)
      toast.success("Assessment deleted successfully!")
      router.refresh()
    } catch (error) {
      toast.error("Failed to delete assessment")
      console.error(error)
    }
  }
  const handleEditAssessment = (assessment: any) => {
    setEditingAssessment(assessment)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex-1">
          <CardTitle className="text-lg truncate">{course.name}</CardTitle>
          <CardDescription className="flex items-center gap-2">
            <span>{course.credit_hours} credit hours</span>
            <Badge variant="outline" className="text-xs">
              {course.course_type}
            </Badge>
          </CardDescription>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
              <SquarePen className="h-4 w-4 mr-2" />
              Edit Course
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDeleteCourse} disabled={loading}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Course
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Grade Display */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center">
              <TrendingUp className="h-4 w-4 mr-1" />
              Current Grade
            </span>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{percentage.toFixed(2)}%</span>
              {!isOngoing ? (
                <Badge variant="secondary" className="font-medium">
                  GPA: {course.gpa.toFixed(2)}
                </Badge>
              ) : gpa !== null && (
                <Badge variant="secondary" className="font-medium">
                  GPA: {gpa.toFixed(2)}
                </Badge>
              )}
            </div>
          </div>
          <Progress value={percentage} className="h-2" />
          <div className="text-xs text-muted-foreground">
            Weightage used: {weightageUsed.toFixed(2)}% / 100%
          </div>
        </div>

        {/* Assessments List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Assessments</span>
            <AddAssessmentDialog courseId={course.id} courseName={course.name} semesterId={course.semester_id} userId={course.user_id} />
          </div>

          {course.assessments.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No assessments added yet</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {course.assessments.map((assessment: any) => (
                <div key={assessment.id} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                  <div className="flex-1">
                    <div className="font-medium">{assessment.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {assessment.marks_obtained}/{assessment.total_marks} ({assessment.weightage}%)
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-xs">
                      {((assessment.marks_obtained / assessment.total_marks) * 100).toFixed(2)}%
                    </Badge>
                    {isOngoing && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleEditAssessment(assessment)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleDeleteAssessment(assessment.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Remaining Weightage Warning */}
        {weightageUsed > 100 && (
          <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950 p-2 rounded">
            ⚠️ Total weightage exceeds 100%. Please review your assessments.
          </div>
        )}
      </CardContent>
      {editingAssessment && isOngoing && (
        <EditAssessmentDialog
          assessment={editingAssessment}
          courseId={course.id}
          semesterId={course.semester_id}
          userId={course.user_id}
          open={!!editingAssessment}
          onOpenChange={(open) => !open && setEditingAssessment(null)}
        />
      )}
      <EditCourseDialog 
        courseId={course.id}
        semesterId={course.semester_id}
        name={course.name}
        creditHours={course.credit_hours}
        gpa={course.gpa}
        courseType={course.course_type}
        isOngoing={isOngoing}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </Card>
  )
}
