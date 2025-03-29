import { prisma } from '@filc/db'

import { DefaultRoles, Permission } from './permissions'

export async function seedRolesAndPermissions(): Promise<void> {
  console.log('🔄 Checking database for roles and permissions...')

  // Create permissions that don't exist yet (won't overwrite existing ones)
  const permissionEntries = Object.entries(Permission)
  const existingPermissions = await prisma.permission.findMany({
    select: { name: true }
  })
  const existingPermissionNames = existingPermissions.map((p) => p.name)

  const permissionsToCreate = permissionEntries.filter(
    ([, name]) => !existingPermissionNames.includes(name)
  )

  if (permissionsToCreate.length > 0) {
    console.log(
      `🔑 Creating ${permissionsToCreate.length} missing permissions...`
    )

    await Promise.all(
      permissionsToCreate.map(([key, value]) =>
        prisma.permission.create({
          data: {
            name: value,
            description: `Permission to ${key.toLowerCase().replace(/_/g, ' ')}`
          }
        })
      )
    )
  }

  // Check for default roles
  const existingRoles = await prisma.role.findMany({
    include: { permissions: true }
  })

  const existingRoleNames = existingRoles.map((r) => r.name)

  // Create default roles that don't exist yet
  const rolesToCreate = DefaultRoles.filter(
    (role) => !existingRoleNames.includes(role.name)
  )

  if (rolesToCreate.length > 0) {
    console.log(`👥 Creating ${rolesToCreate.length} missing roles...`)

    // Create each missing role with its permissions
    for (const role of rolesToCreate) {
      const permissionObjects = await prisma.permission.findMany({
        where: { name: { in: role.permissions } }
      })

      await prisma.role.create({
        data: {
          name: role.name,
          description: role.description,
          color: role.color,
          permissions: {
            connect: permissionObjects.map((p) => ({ id: p.id }))
          }
        }
      })
    }
  }

  // For existing roles, add any missing permissions defined in DefaultRoles but don't remove any
  for (const defaultRole of DefaultRoles) {
    const existingRole = existingRoles.find((r) => r.name === defaultRole.name)
    if (existingRole) {
      const existingPermissionNames = existingRole.permissions.map(
        (p) => p.name
      )
      const missingPermissions = defaultRole.permissions.filter(
        (p) => !existingPermissionNames.includes(p)
      )

      if (missingPermissions.length > 0) {
        console.log(
          `🔄 Adding missing permissions to role ${defaultRole.name}...`
        )
        const permissionsToConnect = await prisma.permission.findMany({
          where: { name: { in: missingPermissions } }
        })

        await prisma.role.update({
          where: { id: existingRole.id },
          data: {
            permissions: {
              connect: permissionsToConnect.map((p) => ({ id: p.id }))
            }
          }
        })
      }
    }
  }

  console.log('✅ Roles and permissions check completed')
}
