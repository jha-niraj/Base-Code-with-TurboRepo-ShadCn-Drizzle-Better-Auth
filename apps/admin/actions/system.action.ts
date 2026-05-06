"use server"

import { db } from "@repo/db"
import {
    adminAccess,
    adminAuditLog,
    adminNotification,
    adminSystemSettings,
} from "@repo/db/schema"
import { auth } from "@repo/auth"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { and, count, desc, eq, sql } from "@repo/db"
import {
    hasPermission,
    type AdminPermissions,
    type AdminPermission,
    type PermissionLevel,
} from "@/lib/navigation"

interface Response<T = unknown> {
    success: boolean
    data?: T
    error?: string
}

async function checkAdminAccess(requiredModule: AdminPermission, requiredLevel: PermissionLevel) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
        return { authorized: false, error: "Not authenticated" }
    }

    const adminAccessRecord = await db.query.adminAccess.findFirst({
        where: (a, { eq }) => eq(a.userId, session.user.id),
        with: { user: true },
    })

    if (
        !adminAccessRecord ||
        !hasPermission(
            adminAccessRecord.permissions as AdminPermissions,
            requiredModule,
            requiredLevel,
        )
    ) {
        return { authorized: false, error: "Not authorized" }
    }

    return { authorized: true, adminAccess: adminAccessRecord }
}

// Get all system settings
export async function getSystemSettings(): Promise<Response> {
    try {
        const check = await checkAdminAccess("system", "read")
        if (!check.authorized) {
            return { success: false, error: check.error }
        }

        const settings = await db.query.adminSystemSettings.findMany({
            orderBy: [desc(adminSystemSettings.updatedAt)],
        })

        return { success: true, data: settings }
    } catch (error) {
        console.error("Get system settings error:", error)
        return { success: false, error: "Failed to fetch system settings" }
    }
}

// Get system setting by key
export async function getSystemSetting(key: string): Promise<Response> {
    try {
        const check = await checkAdminAccess("system", "read")
        if (!check.authorized) {
            return { success: false, error: check.error }
        }

        const setting = await db.query.adminSystemSettings.findFirst({
            where: (s, { eq }) => eq(s.key, key),
        })

        if (!setting) {
            return { success: false, error: "Setting not found" }
        }

        return { success: true, data: setting }
    } catch (error) {
        console.error("Get system setting error:", error)
        return { success: false, error: "Failed to fetch system setting" }
    }
}

// Update system setting
export async function updateSystemSetting(
    key: string,
    data: { value: unknown; description?: string },
): Promise<Response> {
    try {
        const check = await checkAdminAccess("system", "write")
        if (!check.authorized) {
            return { success: false, error: check.error }
        }

        const [setting] = await db
            .insert(adminSystemSettings)
            .values({
                key,
                value: data.value,
                description: data.description,
                createdAt: new Date(),
                updatedAt: new Date(),
            })
            .onConflictDoUpdate({
                target: adminSystemSettings.key,
                set: {
                    value: data.value,
                    description: data.description,
                    updatedAt: new Date(),
                },
            })
            .returning()

        await db.insert(adminAuditLog).values({
            adminId: check.adminAccess!.id,
            action: "UPDATE",
            module: "system",
            resourceType: "SystemSettings",
            resourceId: key,
            description: `Updated system setting: ${key}`,
            createdAt: new Date(),
        })

        revalidatePath("/system")

        return { success: true, data: setting }
    } catch (error) {
        console.error("Update system setting error:", error)
        return { success: false, error: "Failed to update system setting" }
    }
}

// Get system health
export async function getSystemHealth(): Promise<Response> {
    try {
        const check = await checkAdminAccess("system", "read")
        if (!check.authorized) {
            return { success: false, error: check.error }
        }

        // Check database connection
        await db.execute(sql`SELECT 1`)

        // Recent errors from audit log
        const [errorResult] = await db
            .select({ count: count() })
            .from(adminAuditLog)
            .where(eq(adminAuditLog.action, "ERROR"))

        return {
            success: true,
            data: {
                databaseStatus: "healthy",
                recentErrors: errorResult?.count ?? 0,
                timestamp: new Date(),
            },
        }
    } catch (error) {
        console.error("Get system health error:", error)
        return {
            success: false,
            data: {
                databaseStatus: "unhealthy",
                error: "Failed to check system health",
            },
        }
    }
}

// Clear cache
export async function clearCache(cacheKeys?: string[]): Promise<Response> {
    try {
        const check = await checkAdminAccess("system", "write")
        if (!check.authorized) {
            return { success: false, error: check.error }
        }

        if (cacheKeys && cacheKeys.length > 0) {
            cacheKeys.forEach((key) => revalidatePath(key))
        } else {
            revalidatePath("/")
            revalidatePath("/dashboard")
            revalidatePath("/users")
            revalidatePath("/projects")
            revalidatePath("/communities")
            revalidatePath("/feedback")
            revalidatePath("/analytics")
        }

        await db.insert(adminAuditLog).values({
            adminId: check.adminAccess!.id,
            action: "UPDATE",
            module: "system",
            resourceType: "Cache",
            resourceId: "cache",
            description: `Cleared cache: ${cacheKeys?.join(", ") || "all"}`,
            createdAt: new Date(),
        })

        return { success: true, data: { cleared: cacheKeys || ["all"] } }
    } catch (error) {
        console.error("Clear cache error:", error)
        return { success: false, error: "Failed to clear cache" }
    }
}

// Get admin notifications
export async function getAdminNotifications(params?: {
    page?: number
    limit?: number
    unreadOnly?: boolean
}): Promise<Response> {
    try {
        const check = await checkAdminAccess("system", "read")
        if (!check.authorized) {
            return { success: false, error: check.error }
        }

        const page = params?.page ?? 1
        const limit = params?.limit ?? 20
        const offset = (page - 1) * limit
        const adminId = check.adminAccess!.id

        const whereClause = params?.unreadOnly
            ? and(eq(adminNotification.adminId, adminId), eq(adminNotification.isRead, false))
            : eq(adminNotification.adminId, adminId)

        const [notifications, [totalResult]] = await Promise.all([
            db.query.adminNotification.findMany({
                where: () => whereClause,
                limit,
                offset,
                orderBy: [desc(adminNotification.createdAt)],
            }),
            db.select({ count: count() }).from(adminNotification).where(whereClause),
        ])

        const total = totalResult?.count ?? 0

        return {
            success: true,
            data: {
                notifications,
                pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
            },
        }
    } catch (error) {
        console.error("Get admin notifications error:", error)
        return { success: false, error: "Failed to fetch notifications" }
    }
}

// Mark notification as read
export async function markNotificationAsRead(id: string): Promise<Response> {
    try {
        const check = await checkAdminAccess("system", "write")
        if (!check.authorized) {
            return { success: false, error: check.error }
        }

        await db
            .update(adminNotification)
            .set({ isRead: true })
            .where(eq(adminNotification.id, id))

        return { success: true, data: null }
    } catch (error) {
        console.error("Mark notification as read error:", error)
        return { success: false, error: "Failed to mark notification as read" }
    }
}

// Mark all notifications as read
export async function markAllNotificationsAsRead(): Promise<Response> {
    try {
        const check = await checkAdminAccess("system", "write")
        if (!check.authorized) {
            return { success: false, error: check.error }
        }

        await db
            .update(adminNotification)
            .set({ isRead: true })
            .where(
                and(
                    eq(adminNotification.adminId, check.adminAccess!.id),
                    eq(adminNotification.isRead, false),
                ),
            )

        return { success: true, data: null }
    } catch (error) {
        console.error("Mark all notifications as read error:", error)
        return { success: false, error: "Failed to mark all notifications as read" }
    }
}
