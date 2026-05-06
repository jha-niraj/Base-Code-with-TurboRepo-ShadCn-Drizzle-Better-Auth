import { NextRequest, NextResponse } from "next/server"
import { db } from "@repo/db"
import {
    user,
    account,
    adminAccess,
    adminInvitation,
    adminAuditLog,
} from "@repo/db/schema"
import { and, eq } from "@repo/db"
import bcrypt from "bcryptjs"

export async function POST(request: NextRequest) {
    try {
        const { email, accessCode } = await request.json()

        if (!email || !accessCode) {
            return NextResponse.json(
                { success: false, message: "Email and access code are required" },
                { status: 400 },
            )
        }

        const normalizedEmail = email.toLowerCase()
        const normalizedCode = accessCode.toUpperCase()

        // Find the invitation
        const invitation = await db.query.adminInvitation.findFirst({
            where: (inv, { and, eq }) =>
                and(
                    eq(inv.email, normalizedEmail),
                    eq(inv.code, normalizedCode),
                    eq(inv.status, "PENDING"),
                ),
        })

        if (!invitation) {
            return NextResponse.json(
                { success: false, message: "Invalid access code or email" },
                { status: 401 },
            )
        }

        // Check if expired
        if (new Date() > invitation.expiresAt) {
            await db
                .update(adminInvitation)
                .set({ status: "EXPIRED" })
                .where(eq(adminInvitation.id, invitation.id))

            return NextResponse.json(
                { success: false, message: "Access code has expired" },
                { status: 401 },
            )
        }

        const hashedPassword = await bcrypt.hash(normalizedCode, 12)

        // Find or create user
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

            // Create credential account so the user can sign in via email/password
            await db.insert(account).values({
                id: crypto.randomUUID(),
                accountId: existingUser.id,
                providerId: "credential",
                userId: existingUser.id,
                password: hashedPassword,
                createdAt: new Date(),
                updatedAt: new Date(),
            })
        } else {
            // Update the credential password for this login
            await db
                .update(account)
                .set({ password: hashedPassword, updatedAt: new Date() })
                .where(
                    and(
                        eq(account.userId, existingUser.id),
                        eq(account.providerId, "credential"),
                    ),
                )

            await db
                .update(user)
                .set({ role: "ADMIN", updatedAt: new Date() })
                .where(eq(user.id, existingUser.id))
        }

        // Find or create admin access
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

        // Mark invitation as used
        await db
            .update(adminInvitation)
            .set({
                status: "USED",
                usedBy: existingUser.id,
                usedAt: new Date(),
            })
            .where(eq(adminInvitation.id, invitation.id))

        // Audit log
        await db.insert(adminAuditLog).values({
            adminId: adminAccessRecord.id,
            action: "LOGIN",
            module: "admin_management",
            resourceType: "AdminAccess",
            resourceId: adminAccessRecord.id,
            description: `Admin ${email} logged in via access code`,
            createdAt: new Date(),
        })

        return NextResponse.json({
            success: true,
            message: "Access code verified successfully",
            needsPasswordSetup: true,
        })
    } catch (error) {
        console.error("Verify access code error:", error)
        return NextResponse.json(
            { success: false, message: "An error occurred" },
            { status: 500 },
        )
    }
}
