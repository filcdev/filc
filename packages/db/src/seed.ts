import { fakerHU as faker } from '@faker-js/faker'

import config, { databaseConfig } from '@filc/config'

import { Day, WeekType } from '../generated/client'
import { prisma } from './client'

export const seed = async () => {
  if (!config.isDevelopment || !databaseConfig.enableSeeding) {
    console.log('🚧 Skipping seeding in production environment')
    return
  }

  const counts = await Promise.all([
    prisma.lesson.count(),
    prisma.class.count(),
    prisma.room.count(),
    prisma.subject.count(),
    prisma.teacher.count(),
    prisma.substitution.count()
  ])

  if (counts.some((count) => count > 0)) {
    console.log('🚧 Skipping seeding, database is not empty')
    return
  }

  console.log('🚀 Seeded database...')

  await prisma.class.createMany({
    data: Array.from({ length: 10 }, () => {
      const gradeNumber = faker.number.int({ min: 9, max: 13 })
      const classSuffix = faker.helpers.arrayElement([
        'A',
        'B',
        'C',
        'D',
        'E',
        'KNY'
      ])
      return {
        name: `${gradeNumber}. ${classSuffix}`,
        createdAt: faker.date.past(),
        updatedAt: faker.date.past()
      }
    })
  })

  console.log('🚀 Seeded classes...')

  await prisma.subject.createMany({
    data: Array.from({ length: 10 }, () => {
      return {
        name: faker.word.noun({ length: { min: 9, max: 20 } }),
        short: faker.word.noun({ length: { min: 2, max: 5 } }),
        createdAt: faker.date.past(),
        updatedAt: faker.date.past()
      }
    })
  })

  console.log('🚀 Seeded subjects...')

  await prisma.teacher.createMany({
    data: Array.from({ length: 10 }, () => {
      const firstName = faker.person.firstName()
      return {
        email: faker.internet.email(),
        name: faker.person.fullName({ firstName }),
        short: firstName,
        createdAt: faker.date.past(),
        updatedAt: faker.date.past()
      }
    })
  })

  console.log('🚀 Seeded teachers...')

  await prisma.room.createMany({
    data: Array.from({ length: 10 }, () => {
      const roomBuilding = faker.helpers.arrayElement(['A', 'B', 'C', 'D'])
      const roomNumber = faker.number.int({ min: 100, max: 300 })
      return {
        name: `${roomBuilding}${roomNumber}`,
        short: faker.string.alphanumeric(3),
        createdAt: faker.date.past(),
        updatedAt: faker.date.past()
      }
    })
  })

  console.log('🚀 Seeded rooms...')

  const classes = await prisma.class.findMany()
  const subjects = await prisma.subject.findMany()
  const teachers = await prisma.teacher.findMany()
  const rooms = await prisma.room.findMany()

  await prisma.lesson.createMany({
    data: Array.from({ length: 100 }, () => {
      const groupNumber = faker.number.int({ min: 1, max: 10 })
      const groupSuffix = faker.helpers.arrayElement(['A', 'B', 'C', 'D', 'E'])
      return {
        day: faker.helpers.arrayElement(Object.values(Day)) as Day,
        weekType: faker.helpers.arrayElement(
          Object.values(WeekType)
        ) as WeekType,
        lesson: faker.number.int({ min: 1, max: 10 }),
        group:
          faker.number.int({ min: 1, max: 10 }) > 5
            ? `${groupNumber}${groupSuffix}`
            : null,
        classId: faker.helpers.arrayElement(classes).id,
        subjectId: faker.helpers.arrayElement(subjects).id,
        teacherId: faker.helpers.arrayElement(teachers).id,
        roomId: faker.helpers.arrayElement(rooms).id
      }
    })
  })

  console.log('🚀 Seeded lessons...')

  const lessons = await prisma.lesson.findMany()

  await prisma.substitution.createMany({
    data: Array.from({ length: 100 }, () => {
      const todayMidnight = new Date()
      todayMidnight.setHours(0, 0, 0, 0)
      return {
        date:
          faker.number.int({ min: 0, max: 10 }) > 5
            ? faker.date.soon({ days: 5 })
            : todayMidnight,
        consolidated: faker.number.int({ min: 0, max: 10 }) > 5,
        missingTeacherId: faker.helpers.arrayElement(teachers).id,
        teacherId: faker.helpers.arrayElement(teachers).id,
        lessonId: faker.helpers.arrayElement(lessons).id,
        subjectId: faker.helpers.arrayElement(subjects).id,
        roomId: faker.helpers.arrayElement(rooms).id,
        classId: faker.helpers.arrayElement(classes).id,
        createdAt: faker.date.past(),
        updatedAt: faker.date.past()
      }
    })
  })

  console.log('🚀 Seeded substitutions...')

  console.log('✅ Database seeded successfully')
}
