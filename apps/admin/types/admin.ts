export type AdminRole =
    | "SUPER_ADMIN"
    | "CONTENT_ADMIN"
    | "FINANCE_ADMIN"
    | "COMMUNITY_ADMIN"
    | "MODULE_MANAGER"
    | "VIEWER"

export type AdminStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED"

/** Flat admin user object as returned by getAdminUsers / getCurrentAdmin */
export interface AdminUser {
    id: string
    userId: string
    /** Alias for adminRole — the role name as stored in the DB */
    role: AdminRole
    adminRole: AdminRole
    status: AdminStatus
    permissions: Record<string, string[]>
    name: string | null
    email: string
    image: string | null
    lastLoginAt: Date | null
    loginCount: number
    createdAt: Date
    updatedAt: Date
    user: {
        id: string
        name: string
        email: string
        image: string | null
    } | null
}
