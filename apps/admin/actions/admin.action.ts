"use server"

import { db } from "@repo/db"
import {
    user,
    account,
    adminAccess,
    adminInvitation,
    adminAuditLog,
} from "@repo/db/schema"
import { auth } from "@repo/auth"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { and, count, desc, eq, gte } from "@repo/db"
import bcrypt from "bcryptjs"

// Types
interface CreateInvitationInput {
    email: string
    name?: string
    adminRole: "SUPER_ADMIN" | "CONTENT_ADMIN" | "FINANCE_ADMIN" | "COMMUNITY_ADMIN" | "MODULE_MANAGER" | "VIEWER"
    permissions?: Record<string, string[]>
}

interface AdminResponse<T = unknown> {
    success: boolean
    data?: T
    error?: string
}

function generateAccessCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    let code = "ADMIN-"
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
}

async function getSession() {
    return auth.api.getSession({ headers: await headers() })
}

// Check if current user is admin
export async function checkAdminAccess(): Promise<AdminResponse<{ isAdmin: boolean; adminAccess: typeof adminAccess.$inferSelect }>> {
    try {
        const session = await getSession()

        if (!session?.user?.id) {
            return { success: false, error: "Not authenticated" }
        }

        const adminAccessRecord = await db.query.adminAccess.findFirst({
            where: (a, { eq }) => eq(a.userId, session.user.id),
        })

        if (!adminAccessRecord || adminAccessRecord.status !== "ACTIVE") {
            return { success: false, error: "Not authorized" }
        }

        return {
            success: true,
            data: { isAdmin: true, adminAccess: adminAccessRecord },
        }
    } catch (error) {
        console.error("Admin access check error:", error)
        return { success: false, error: "Failed to check admin access" }
    }
}

// Get current admin info
export async function getCurrentAdmin(): Promise<AdminResponse<any>> {
    try {
        const session = await getSession()

        if (!session?.user?.id) {
            return { success: false, error: "Not authenticated" }
        }

        const adminAccessRecord = await db.query.adminAccess.findFirst({
            where: (a, { eq }) => eq(a.userId, session.user.id),
        })

        if (!adminAccessRecord) {
            return { success: false, error: "Not an admin" }
        }

        const userRecord = await db.query.user.findFirst({
            where: (u, { eq }) => eq(u.id, session.user.id),
            columns: { id: true, name: true, email: true, image: true },
        })

        return {
            success: true,
            data: {
                ...adminAccessRecord,
                role: adminAccessRecord.adminRole,
                name: userRecord?.name ?? null,
                email: userRecord?.email ?? '',
                image: userRecord?.image ?? null,
                user: userRecord,
            },
        }
    } catch (error) {
        console.error("Get current admin error:", error)
        return { success: false, error: "Failed to get admin info" }
    }
}

// Get all admin users
export async function getAdminUsers(): Promise<AdminResponse<any[]>> {
    try {
        const { success, error } = await checkAdminAccess()
        if (!success) return { success: false, error }

        const admins = await db.query.adminAccess.findMany({
            with: {
                invitations: {
                    limit: 5,
                    orderBy: (inv, { desc }) => [desc(inv.createdAt)],
                },
            },
            orderBy: [desc(adminAccess.createdAt)],
        })

        const adminWithUsers = await Promise.all(
            admins.map(async (admin) => {
                const userRecord = await db.query.user.findFirst({
                    where: (u, { eq }) => eq(u.id, admin.userId),
                    columns: { id: true, name: true, email: true, image: true },
                })
                return {
                    ...admin,
                    role: admin.adminRole,
                    name: userRecord?.name ?? null,
                    email: userRecord?.email ?? '',
                    image: userRecord?.image ?? null,
                    user: userRecord,
                }
            }),
        )

        return { success: true, data: adminWithUsers }
    } catch (error) {
        console.error("Get admin users error:", error)
        return { success: false, error: "Failed to fetch admin users" }
    }
}

// Create admin invitation
export async function createAdminInvitation(input: CreateInvitationInput): Promise<AdminResponse<any>> {
    try {
        const accessCheck = await checkAdminAccess()
        if (!accessCheck.success) return { success: false, error: accessCheck.error }

        const adminAccessRecord = accessCheck.data?.adminAccess

        if (adminAccessRecord?.adminRole !== "SUPER_ADMIN") {
            return { success: false, error: "Only super admins can create invitations" }
        }

        // Check if email already has admin access
        const existingUser = await db.query.user.findFirst({
            where: (u, { eq }) => eq(u.email, input.email),
        })

        if (existingUser) {
            const existingAdmin = await db.query.adminAccess.findFirst({
                where: (a, { eq }) => eq(a.userId, existingUser.id),
            })
            if (existingAdmin) {
                return { success: false, error: "User already has admin access" }
            }
        }

        // Check for existing pending invitation
        const existingInvite = await db.query.adminInvitation.findFirst({
            where: (inv, { and, eq }) =>
                and(eq(inv.email, input.email), eq(inv.status, "PENDING")),
        })

        if (existingInvite) {
            return { success: false, error: "Pending invitation already exists for this email" }
        }

        const [invitation] = await db
            .insert(adminInvitation)
            .values({
                email: input.email,
                name: input.name,
                code: generateAccessCode(),
                adminRole: input.adminRole,
                permissions: input.permissions ?? {},
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                createdById: adminAccessRecord!.id,
                createdAt: new Date(),
            })
            .returning()

        await db.insert(adminAuditLog).values({
            adminId: adminAccessRecord!.id,
            action: "CREATE",
            module: "admin_management",
            resourceType: "AdminInvitation",
            resourceId: invitation!.id,
            description: `Created invitation for ${input.email} with role ${input.adminRole}`,
            createdAt: new Date(),
        })

        revalidatePath("/admins")
        revalidatePath("/admins/invitations")

        return { success: true, data: invitation }
    } catch (error) {
        console.error("Create invitation error:", error)
        return { success: false, error: "Failed to create invitation" }
    }
}

// Verify access code and create admin
export async function verifyAccessCode(email: string, accessCode: string): Promise<AdminResponse<any>> {
    try {
        const normalizedEmail = email.toLowerCase()
        const normalizedCode = accessCode.toUpperCase()

        const invitation = await db.query.adminInvitation.findFirst({
            where: (inv, { and, eq }) =>
                and(
                    eq(inv.email, normalizedEmail),
                    eq(inv.code, normalizedCode),
                    eq(inv.status, "PENDING"),
                ),
        })

        if (!invitation) {
            return { success: false, error: "Invalid access code" }
        }

        if (new Date() > invitation.expiresAt) {
            await db
                .update(adminInvitation)
                .set({ status: "EXPIRED" })
                .where(eq(adminInvitation.id, invitation.id))
            return { success: false, error: "Access code has expired" }
        }

        const hashedPassword = await bcrypt.hash(normalizedCode, 10)

        let existingUser = await db.query.user.findFirst({
            where: (u, { eq }) => eq(u.email, normalizedEmail),
        })

        if (!existingUser) {
            const [newUser] = await db
                .insert(user)
                .values({
                    id: crypto.randomUUID(),
                    email: normalizedEmail,
                    name: invitation.name || normalizedEmail.split("@")[0]!,
                    emailVerified: true,
                    role: "ADMIN",
                    createdAt: new Date(),
                    updatedAt: new Date(),
                })
                .returning()

            existingUser = newUser!

            await db.insert(account).values({
                id: crypto.randomUUID(),
                accountId: existingUser.id,
                providerId: "credential",
                userId: existingUser.id,
                password: hashedPassword,
                createdAt: new Date(),
                updatedAt: new Date(),
            })
        }

        let adminAccessRecord = await db.query.adminAccess.findFirst({
            where: (a, { eq }) => eq(a.userId, existingUser!.id),
        })

        if (!adminAccessRecord) {
            const [newAccess] = await db
                .insert(adminAccess)
                .values({
                    userId: existingUser.id,
                    adminRole: invitation.adminRole,
                    permissions: invitation.permissions ?? {},
                    status: "ACTIVE",
                    inviteCode: normalizedCode,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                })
                .returning()

            adminAccessRecord = newAccess!
        }

        await db
            .update(adminInvitation)
            .set({ status: "USED", usedBy: existingUser.id, usedAt: new Date() })
            .where(eq(adminInvitation.id, invitation.id))

        await db.insert(adminAuditLog).values({
            adminId: adminAccessRecord.id,
            action: "LOGIN",
            module: "admin_management",
            resourceType: "AdminAccess",
            resourceId: adminAccessRecord.id,
            description: `New admin ${email} activated via access code`,
            createdAt: new Date(),
        })

        return {
            success: true,
            data: { user: existingUser, adminAccess: adminAccessRecord, needsPasswordSetup: true },
        }
    } catch (error) {
        console.error("Verify access code error:", error)
        return { success: false, error: "Failed to verify access code" }
    }
}

// Get pending invitations
export async function getPendingInvitations(): Promise<AdminResponse<any[]>> {
    try {
        const { success, error } = await checkAdminAccess()
        if (!success) return { success: false, error }

        const invitations = await db.query.adminInvitation.findMany({
            where: (inv, { eq }) => eq(inv.status, "PENDING"),
            orderBy: [desc(adminInvitation.createdAt)],
        })

        return { success: true, data: invitations }
    } catch (error) {
        console.error("Get invitations error:", error)
        return { success: false, error: "Failed to fetch invitations" }
    }
}

// Revoke invitation
export async function revokeInvitation(invitationId: string): Promise<AdminResponse> {
    try {
        const accessCheck = await checkAdminAccess()
        if (!accessCheck.success) return { success: false, error: accessCheck.error }

        const adminAccessRecord = accessCheck.data?.adminAccess

        if (adminAccessRecord?.adminRole !== "SUPER_ADMIN") {
            return { success: false, error: "Only super admins can revoke invitations" }
        }

        await db
            .update(adminInvitation)
            .set({ status: "REVOKED" })
            .where(eq(adminInvitation.id, invitationId))

        await db.insert(adminAuditLog).values({
            adminId: adminAccessRecord.id,
            action: "DELETE",
            module: "admin_management",
            resourceType: "AdminInvitation",
            resourceId: invitationId,
            description: "Revoked admin invitation",
            createdAt: new Date(),
        })

        revalidatePath("/admins/invitations")

        return { success: true }
    } catch (error) {
        console.error("Revoke invitation error:", error)
        return { success: false, error: "Failed to revoke invitation" }
    }
}

// Update admin status
export async function updateAdminStatus(
    adminId: string,
    status: "ACTIVE" | "INACTIVE" | "SUSPENDED",
): Promise<AdminResponse> {
    try {
        const accessCheck = await checkAdminAccess()
        if (!accessCheck.success) return { success: false, error: accessCheck.error }

        const adminAccessRecord = accessCheck.data?.adminAccess

        if (adminAccessRecord?.adminRole !== "SUPER_ADMIN") {
            return { success: false, error: "Only super admins can update admin status" }
        }

        await db
            .update(adminAccess)
            .set({ status, updatedAt: new Date() })
            .where(eq(adminAccess.id, adminId))

        await db.insert(adminAuditLog).values({
            adminId: adminAccessRecord.id,
            action: "UPDATE",
            module: "admin_management",
            resourceType: "AdminAccess",
            resourceId: adminId,
            description: `Updated admin status to ${status}`,
            createdAt: new Date(),
        })

        revalidatePath("/admins")

        return { success: true }
    } catch (error) {
        console.error("Update admin status error:", error)
        return { success: false, error: "Failed to update admin status" }
    }
}

// Update admin permissions
export async function updateAdminPermissions(
    adminId: string,
    permissions: Record<string, string[]>,
): Promise<AdminResponse> {
    try {
        const accessCheck = await checkAdminAccess()
        if (!accessCheck.success) return { success: false, error: accessCheck.error }

        const adminAccessRecord = accessCheck.data?.adminAccess

        if (adminAccessRecord?.adminRole !== "SUPER_ADMIN") {
            return { success: false, error: "Only super admins can update permissions" }
        }

        const previousAdmin = await db.query.adminAccess.findFirst({
            where: (a, { eq }) => eq(a.id, adminId),
        })

        await db
            .update(adminAccess)
            .set({ permissions, updatedAt: new Date() })
            .where(eq(adminAccess.id, adminId))

        await db.insert(adminAuditLog).values({
            adminId: adminAccessRecord.id,
            action: "UPDATE",
            module: "admin_management",
            resourceType: "AdminAccess",
            resourceId: adminId,
            description: "Updated admin permissions",
            changes: { before: previousAdmin?.permissions, after: permissions },
            createdAt: new Date(),
        })

        revalidatePath("/admins")

        return { success: true }
    } catch (error) {
        console.error("Update admin permissions error:", error)
        return { success: false, error: "Failed to update permissions" }
    }
}

// Get dashboard stats
export async function getDashboardStats(): Promise<AdminResponse<any>> {
    try {
        const { success, error } = await checkAdminAccess()
        if (!success) return { success: false, error }

        const now = new Date()
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        const today = new Date(now)
        today.setHours(0, 0, 0, 0)

        const [[totalUsersResult], [newUsersResult], [totalAdminsResult], [activeTodayResult]] =
            await Promise.all([
                db.select({ count: count() }).from(user),
                db.select({ count: count() }).from(user).where(gte(user.createdAt, thirtyDaysAgo)),
                db.select({ count: count() }).from(adminAccess).where(eq(adminAccess.status, "ACTIVE")),
                db.select({ count: count() }).from(user).where(gte(user.createdAt, today)),
            ])

        return {
            success: true,
            data: {
                totalUsers: totalUsersResult?.count ?? 0,
                newUsersThisMonth: newUsersResult?.count ?? 0,
                activeToday: activeTodayResult?.count ?? 0,
                totalAdmins: totalAdminsResult?.count ?? 0,
                totalCredits: 0,
                growthRate:
                    (totalUsersResult?.count ?? 0) > 0
                        ? Math.round(((newUsersResult?.count ?? 0) / (totalUsersResult?.count ?? 1)) * 100)
                        : 0,
            },
        }
    } catch (error) {
        console.error("Get dashboard stats error:", error)
        return { success: false, error: "Failed to fetch dashboard stats" }
    }
}

// Get audit logs
export async function getAuditLogs(page = 1, limit = 20): Promise<AdminResponse<any>> {
    try {
        const { success, error } = await checkAdminAccess()
        if (!success) return { success: false, error }

        const [logs, [totalResult]] = await Promise.all([
            db.query.adminAuditLog.findMany({
                limit,
                offset: (page - 1) * limit,
                orderBy: [desc(adminAuditLog.createdAt)],
                with: { admin: { columns: { userId: true } } },
            }),
            db.select({ count: count() }).from(adminAuditLog),
        ])

        const total = totalResult?.count ?? 0

        const logsWithUser = await Promise.all(
            logs.map(async (log) => {
                const userRecord = await db.query.user.findFirst({
                    where: (u, { eq }) => eq(u.id, log.admin.userId),
                    columns: { name: true, email: true, image: true },
                })
                return { ...log, adminUser: userRecord }
            }),
        )

        return {
            success: true,
            data: {
                logs: logsWithUser,
                total,
                pages: Math.ceil(total / limit),
                currentPage: page,
            },
        }
    } catch (error) {
        console.error("Get audit logs error:", error)
        return { success: false, error: "Failed to fetch audit logs" }
    }
}

// Set admin password (after initial access code login)
export async function setAdminPassword(newPassword: string): Promise<AdminResponse> {
    try {
        const session = await getSession()

        if (!session?.user?.id) {
            return { success: false, error: "Not authenticated" }
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12)

        // Update in the Better Auth account table
        await db
            .update(account)
            .set({ password: hashedPassword, updatedAt: new Date() })
            .where(
                and(eq(account.userId, session.user.id), eq(account.providerId, "credential")),
            )

        // Clear the temporary access code from adminAccess
        await db
            .update(adminAccess)
            .set({ accessCode: null, accessCodeExpiry: null, hashedPassword, updatedAt: new Date() })
            .where(eq(adminAccess.userId, session.user.id))

        return { success: true }
    } catch (error) {
        console.error("Set admin password error:", error)
        return { success: false, error: "Failed to set password" }
    }
}

// Change password with current password verification
export async function changeAdminPassword(
    currentPassword: string,
    newPassword: string,
): Promise<AdminResponse> {
    try {
        const session = await getSession()
        if (!session?.user?.id) {
            return { success: false, error: "Not authenticated" }
        }

        const credentialAccount = await db.query.account.findFirst({
            where: (a, { and, eq }) =>
                and(eq(a.userId, session.user.id), eq(a.providerId, "credential")),
        })

        if (!credentialAccount?.password) {
            return { success: false, error: "No password set for this account" }
        }

        const valid = await bcrypt.compare(currentPassword, credentialAccount.password)
        if (!valid) {
            return { success: false, error: "Current password is incorrect" }
        }

        const hashedNew = await bcrypt.hash(newPassword, 12)

        await db
            .update(account)
            .set({ password: hashedNew, updatedAt: new Date() })
            .where(eq(account.id, credentialAccount.id))

        const adminAccessRecord = await db.query.adminAccess.findFirst({
            where: (a, { eq }) => eq(a.userId, session.user.id),
        })

        if (adminAccessRecord) {
            await db.insert(adminAuditLog).values({
                adminId: adminAccessRecord.id,
                action: "UPDATE",
                module: "admin_management",
                resourceType: "User",
                resourceId: session.user.id,
                description: "Changed password",
                createdAt: new Date(),
            })
        }

        return { success: true }
    } catch (error) {
        console.error("Change password error:", error)
        return { success: false, error: "Failed to change password" }
    }
}
