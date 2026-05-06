"use client"

import {
    SidebarProvider, useSidebar
} from "@/components/navigation/sidebarprovider"
import { AdminSidebar } from "@/components/navigation/sidebar"
import { cn } from "@repo/ui/lib/utils"
import { useSession } from "@repo/auth/client"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Loader2 } from "lucide-react"

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
    const { isCollapsed } = useSidebar()
    const { data: session, isPending } = useSession()
    const router = useRouter()

    // Redirect to signin if not authenticated
    useEffect(() => {
        if (!isPending && !session) {
            router.push("/")
        }
    }, [isPending, session, router])

    if (isPending) {
        return (
            <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
            </div>
        )
    }

    if (!session) {
        return null
    }

    return (
        <div className="h-screen overflow-hidden bg-neutral-100 dark:bg-neutral-900">
            <AdminSidebar />
            <main
                className={cn(
                    "h-screen transition-all duration-300",
                    "lg:ml-64 p-3",
                    isCollapsed && "lg:ml-[90px]"
                )}
            >
                <div className="h-screen bg-white dark:bg-neutral-950 lg:rounded-l-3xl lg:border-l border-neutral-200 dark:border-neutral-800 shadow-xl overflow-hidden">
                    <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-300 dark:scrollbar-thumb-neutral-700 scrollbar-track-transparent">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    )
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <SidebarProvider>
            <AdminLayoutContent>{children}</AdminLayoutContent>
        </SidebarProvider>
    )
}