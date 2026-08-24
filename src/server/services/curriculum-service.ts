import { db } from "@/server/db/client";

export class CurriculumService {
  listUnits(studentId: string) {
    return db.unit.findMany({
      where: { course: { enrollments: { some: { studentId } }, active: true } },
      orderBy: { order: "asc" }, include: { course: { include: { subject: true } }, topics: { include: { objectives: { orderBy: { order: "asc" } } } } },
    });
  }

  getUnitForStudent(unitId: string, studentId: string) {
    return db.unit.findFirstOrThrow({
      where: { id: unitId, course: { enrollments: { some: { studentId } } } },
      include: { topics: { orderBy: { order: "asc" }, include: { objectives: { where: { active: true }, orderBy: { order: "asc" } } } } },
    });
  }
}
