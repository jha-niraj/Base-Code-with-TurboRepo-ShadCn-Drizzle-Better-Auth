import {
    pgTable,
    text,
    timestamp,
    boolean,
    integer,
    json,
    index,
    pgEnum,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ─── Enums ────────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum('role', ['USER', 'ADMIN'])
export const adminRoleEnum = pgEnum('admin_role', [
    'SUPER_ADMIN',
    'CONTENT_ADMIN',
    'FINANCE_ADMIN',
    'COMMUNITY_ADMIN',
    'MODULE_MANAGER',
    'VIEWER',
])
export const adminStatusEnum = pgEnum('admin_status', ['ACTIVE', 'INACTIVE', 'SUSPENDED'])
export const adminInviteStatusEnum = pgEnum('admin_invite_status', [
    'PENDING',
    'USED',
    'EXPIRED',
    'REVOKED',
])

// ─── Better Auth Required Tables ──────────────────────────────────────────────

export const user = pgTable('user', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    role: roleEnum('role').notNull().default('USER'),
    address: text('address'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const session = pgTable('session', {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
        .notNull()
        .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
})

export const verification = pgTable('verification', {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
})

// ─── Admin Tables ─────────────────────────────────────────────────────────────

export const adminAccess = pgTable(
    'admin_access',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        userId: text('user_id')
            .notNull()
            .unique()
            .references(() => user.id, { onDelete: 'cascade' }),
        adminRole: adminRoleEnum('admin_role').notNull().default('MODULE_MANAGER'),
        status: adminStatusEnum('status').notNull().default('ACTIVE'),
        permissions: json('permissions').$type<Record<string, string[]>>().default({}).notNull(),
        lastLoginAt: timestamp('last_login_at'),
        loginCount: integer('login_count').notNull().default(0),
        invitedBy: text('invited_by'),
        inviteCode: text('invite_code'),
        hashedPassword: text('hashed_password'),
        accessCode: text('access_code'),
        accessCodeExpiry: timestamp('access_code_expiry'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (table) => [
        index('admin_access_role_idx').on(table.adminRole),
        index('admin_access_status_idx').on(table.status),
        index('admin_access_user_id_idx').on(table.userId),
    ],
)

export const adminInvitation = pgTable(
    'admin_invitation',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        code: text('code')
            .notNull()
            .unique()
            .$defaultFn(() => crypto.randomUUID()),
        email: text('email').notNull(),
        name: text('name'),
        adminRole: adminRoleEnum('admin_role').notNull(),
        permissions: json('permissions').$type<Record<string, string[]>>().default({}).notNull(),
        status: adminInviteStatusEnum('status').notNull().default('PENDING'),
        usedBy: text('used_by'),
        usedAt: timestamp('used_at'),
        expiresAt: timestamp('expires_at').notNull(),
        createdById: text('created_by_id')
            .notNull()
            .references(() => adminAccess.id, { onDelete: 'cascade' }),
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (table) => [
        index('admin_invitation_code_idx').on(table.code),
        index('admin_invitation_email_idx').on(table.email),
        index('admin_invitation_status_idx').on(table.status),
        index('admin_invitation_expires_at_idx').on(table.expiresAt),
        index('admin_invitation_created_by_id_idx').on(table.createdById),
    ],
)

export const adminAuditLog = pgTable(
    'admin_audit_log',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        adminId: text('admin_id')
            .notNull()
            .references(() => adminAccess.id, { onDelete: 'cascade' }),
        action: text('action').notNull(),
        module: text('module').notNull(),
        resourceType: text('resource_type'),
        resourceId: text('resource_id'),
        description: text('description'),
        changes: json('changes'),
        metadata: json('metadata'),
        ipAddress: text('ip_address'),
        userAgent: text('user_agent'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (table) => [
        index('admin_audit_log_admin_id_idx').on(table.adminId),
        index('admin_audit_log_module_idx').on(table.module),
        index('admin_audit_log_action_idx').on(table.action),
        index('admin_audit_log_created_at_idx').on(table.createdAt),
        index('admin_audit_log_resource_idx').on(table.resourceType, table.resourceId),
    ],
)

export const adminDashboardStats = pgTable(
    'admin_dashboard_stats',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        statType: text('stat_type').notNull().unique(),
        data: json('data').notNull(),
        lastUpdatedAt: timestamp('last_updated_at').notNull().defaultNow(),
    },
    (table) => [
        index('admin_dashboard_stats_stat_type_idx').on(table.statType),
        index('admin_dashboard_stats_last_updated_at_idx').on(table.lastUpdatedAt),
    ],
)

export const adminNotification = pgTable(
    'admin_notification',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        adminId: text('admin_id'),
        title: text('title').notNull(),
        message: text('message').notNull(),
        type: text('type').notNull().default('info'),
        actionUrl: text('action_url'),
        actionLabel: text('action_label'),
        isRead: boolean('is_read').notNull().default(false),
        readAt: timestamp('read_at'),
        metadata: json('metadata'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (table) => [
        index('admin_notification_admin_id_idx').on(table.adminId),
        index('admin_notification_is_read_idx').on(table.isRead),
        index('admin_notification_created_at_idx').on(table.createdAt),
    ],
)

export const adminSystemSettings = pgTable(
    'admin_system_settings',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        key: text('key').notNull().unique(),
        value: json('value').notNull(),
        description: text('description'),
        lastModifiedBy: text('last_modified_by'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (table) => [index('admin_system_settings_key_idx').on(table.key)],
)

// ─── Relations ────────────────────────────────────────────────────────────────

export const userRelations = relations(user, ({ one }) => ({
    adminAccess: one(adminAccess, {
        fields: [user.id],
        references: [adminAccess.userId],
    }),
}))

export const adminAccessRelations = relations(adminAccess, ({ one, many }) => ({
    user: one(user, {
        fields: [adminAccess.userId],
        references: [user.id],
    }),
    invitations: many(adminInvitation),
    auditLogs: many(adminAuditLog),
}))

export const adminInvitationRelations = relations(adminInvitation, ({ one }) => ({
    createdBy: one(adminAccess, {
        fields: [adminInvitation.createdById],
        references: [adminAccess.id],
    }),
}))

export const adminAuditLogRelations = relations(adminAuditLog, ({ one }) => ({
    admin: one(adminAccess, {
        fields: [adminAuditLog.adminId],
        references: [adminAccess.id],
    }),
}))
