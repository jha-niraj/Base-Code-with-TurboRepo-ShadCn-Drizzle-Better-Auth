"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useSession, signOut } from "@repo/auth/client"
import { cn } from "@repo/ui/lib/utils"
import {
    User, LogOut, ChevronLeft, ChevronRight, ChevronDown, Shield
} from "lucide-react"
import {
    Tooltip, TooltipTrigger, TooltipContent, TooltipProvider
} from "@repo/ui/components/ui/tooltip"
import { useSidebar } from "./sidebarprovider"
import { toast } from "@repo/ui/components/ui/sonner"
import Image from "next/image"
import {
    adminNavigation, type NavigationItem
} from "@/lib/navigation"
import {
    Sheet, SheetContent
} from "@repo/ui/components/ui/sheet"
import { motion, AnimatePresence } from "framer-motion"
import { ThemeToggle } from "@repo/ui/components/themetoggle"

export function AdminSidebar() {
    const { isCollapsed, setIsCollapsed } = useSidebar()
    const [isMobileOpen, setIsMobileOpen] = useState(false)
    const [expandedItems, setExpandedItems] = useState<string[]>([])
    const pathname = usePathname()
    const router = useRouter()
    const { data: session, isPending } = useSession()
    const profileTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)

    useEffect(() => {
        setIsMobileOpen(false)
    }, [pathname])

    // Auto-expand active parent item
    useEffect(() => {
        const allItems = [...adminNavigation.primary, ...adminNavigation.secondary]
        for (const item of allItems) {
            if (item.children) {
                for (const child of item.children) {
                    if (pathname.startsWith(`/${child.path}`)) {
                        setExpandedItems(prev => prev.includes(item.path) ? prev : [...prev, item.path])
                        break
                    }
                }
            }
        }
    }, [pathname])

    const handleProfileMouseEnter = () => {
        if (profileTimeoutRef.current) {
            clearTimeout(profileTimeoutRef.current)
        }
        setProfileDropdownOpen(true)
    }

    const handleProfileMouseLeave = () => {
        if (profileTimeoutRef.current) {
            clearTimeout(profileTimeoutRef.current)
        }
        profileTimeoutRef.current = setTimeout(() => {
            setProfileDropdownOpen(false)
        }, 150)
    }

    const handleSignOut = async () => {
        await signOut()
        setProfileDropdownOpen(false)
        toast.success("Logged out", {
            description: "You have been signed out of the admin panel"
        })
    }

    const toggleItemExpanded = (path: string) => {
        setExpandedItems(prev => {
            if (prev.includes(path)) {
                return prev.filter(p => p !== path)
            }
            return [path]
        })
    }

    // Get navigation items (in real implementation, filter based on permissions)
    const navItems = adminNavigation.primary
    const secondaryItems = adminNavigation.secondary

    const renderNavItem = (item: NavigationItem, depth: number = 0) => {
        const isActive = pathname === `/${item.path}` || pathname.startsWith(`/${item.path}/`)
        const hasChildren = item.children && item.children.length > 0
        const isExpanded = expandedItems.includes(item.path)
        const Icon = item.icon

        if (hasChildren) {
            return (
                <div key={item.path} className="space-y-1">
                    <button
                        onClick={() => toggleItemExpanded(item.path)}
                        className={cn(
                            "flex items-center w-full gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all group",
                            isActive
                                ? "bg-neutral-900 dark:bg-white text-white dark:text-black"
                                : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800/50",
                            isCollapsed && "justify-center px-3"
                        )}
                    >
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        {
                            !isCollapsed && (
                                <>
                                    <span className="flex-1 text-left whitespace-nowrap overflow-hidden">{item.name}</span>
                                    <ChevronDown className={cn(
                                        "h-4 w-4 transition-transform",
                                        isExpanded && "rotate-180"
                                    )} />
                                </>
                            )
                        }
                    </button>
                    <AnimatePresence>
                        {
                            isExpanded && !isCollapsed && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden pl-4 space-y-1"
                                >
                                    {
                                        item.children?.map((child) => renderNavItem(child, depth + 1))
                                    }
                                </motion.div>
                            )
                        }
                    </AnimatePresence>
                </div>
            )
        }

        const linkContent = (
            <Link
                key={item.path}
                href={`/${item.path}`}
                className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    depth > 0 && "text-xs",
                    isActive
                        ? "bg-neutral-900 dark:bg-white text-white dark:text-black"
                        : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800/50",
                    isCollapsed && "justify-center px-3"
                )}
            >
                <Icon className={cn("flex-shrink-0", depth > 0 ? "h-4 w-4" : "h-5 w-5")} />
                {
                    !isCollapsed && (
                        <span className="whitespace-nowrap overflow-hidden">{item.name}</span>
                    )
                }
            </Link>
        )

        return isCollapsed ? (
            <Tooltip key={item.path}>
                <TooltipTrigger asChild>
                    {linkContent}
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-neutral-900 dark:bg-white text-white dark:text-black border-neutral-800 dark:border-neutral-200">
                    {item.name}
                </TooltipContent>
            </Tooltip>
        ) : linkContent
    }

    const SidebarContent = () => (
        <>
            <div className={cn("p-6 flex items-center relative border-b border-neutral-200 dark:border-neutral-800", isCollapsed ? "justify-center" : "gap-3")}>
                <Link href="/dashboard" className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                        <Shield className="w-5 h-5 text-white" />
                    </div>
                    {
                        !isCollapsed && (
                            <div className="flex-1 text-left min-w-0 hidden lg:block">
                                <h1 className="font-bold text-neutral-900 dark:text-white truncate tracking-tight">Admin Panel</h1>
                                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate uppercase tracking-widest font-mono">
                                    Control Center
                                </p>
                            </div>
                        )
                    }
                </Link>
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="hidden lg:block absolute top-6 -right-3 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-full p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors z-50 shadow-lg"
                >
                    {isCollapsed ? <ChevronRight className="w-4 h-4 text-neutral-900 dark:text-white" /> : <ChevronLeft className="w-4 h-4 text-neutral-900 dark:text-white" />}
                </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-300 dark:scrollbar-thumb-neutral-700 scrollbar-track-transparent">
                {navItems?.map((item) => renderNavItem(item))}
                {
                    secondaryItems && secondaryItems.length > 0 && (
                        <>
                            <div className="pt-4 pb-2">
                                {
                                    !isCollapsed && (
                                        <p className="text-[10px] font-mono font-bold uppercase text-neutral-500 dark:text-neutral-400 px-2 tracking-widest">Administration</p>
                                    )
                                }
                            </div>
                            {secondaryItems.map((item) => renderNavItem(item))}
                        </>
                    )
                }
            </nav>
            <div className="mt-auto border-t border-neutral-200 dark:border-neutral-800">
                <ThemeToggle />
                {
                    !isPending && session ? (
                        <div
                            className="relative px-3 py-2"
                            onMouseEnter={handleProfileMouseEnter}
                            onMouseLeave={handleProfileMouseLeave}
                        >
                            <button className={cn("flex cursor-pointer items-center gap-3 w-full rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 p-2 transition-colors", isCollapsed && "justify-center")}>
                                <div className="flex flex-1 gap-2">
                                    {
                                        session?.user?.image ? (
                                            <Image
                                                className="h-10 w-10 rounded-full border border-neutral-200 dark:border-neutral-800"
                                                src={session.user.image}
                                                alt={`Profile picture of ${session.user.name || 'admin'}`}
                                                width={40}
                                                height={40}
                                            />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center flex-shrink-0 border border-neutral-200 dark:border-neutral-800">
                                                <span className="text-white text-sm font-bold">
                                                    {session?.user?.name?.[0] || 'A'}
                                                </span>
                                            </div>
                                        )
                                    }
                                    {
                                        !isCollapsed && (
                                            <div className="flex-1 text-left hidden lg:block min-w-0">
                                                <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">{session?.user?.name || 'Admin'}</p>
                                                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate font-mono">{session?.user?.email || 'admin@example.com'}</p>
                                            </div>
                                        )
                                    }
                                </div>
                                {
                                    !isCollapsed && (
                                        <div className="flex-shrink-0">
                                            <ChevronRight className="w-4 h-4 text-neutral-900 dark:text-white" />
                                        </div>
                                    )
                                }
                            </button>
                            {
                                profileDropdownOpen && (
                                    <div
                                        className="absolute left-full ml-2 bottom-0 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-2xl z-50 w-64 overflow-hidden"
                                        onMouseEnter={handleProfileMouseEnter}
                                        onMouseLeave={handleProfileMouseLeave}
                                    >
                                        <div className="p-4 border-b border-neutral-100 dark:border-neutral-800">
                                            <div className="flex items-center gap-3">
                                                {
                                                    session?.user?.image ? (
                                                        <Image
                                                            className="h-12 w-12 rounded-full border border-neutral-200 dark:border-neutral-800"
                                                            src={session.user.image}
                                                            alt={`Profile picture of ${session.user.name || 'admin'}`}
                                                            width={48}
                                                            height={48}
                                                        />
                                                    ) : (
                                                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center border border-neutral-200 dark:border-neutral-800">
                                                            <span className="text-white text-lg font-bold">
                                                                {session?.user?.name?.[0] || 'A'}
                                                            </span>
                                                        </div>
                                                    )
                                                }
                                                <div className="flex-1">
                                                    <h3 className="font-bold text-sm text-neutral-900 dark:text-white">
                                                        {session?.user?.name || 'Admin'}
                                                    </h3>
                                                    <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                                                        {session?.user?.email || 'admin@example.com'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <button
                                                onClick={() => router.push('/profile')}
                                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                                            >
                                                <div className="w-8 h-8 bg-blue-500/10 dark:bg-blue-500/20 rounded-lg flex items-center justify-center">
                                                    <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                                </div>
                                                <span className="font-medium text-sm text-neutral-900 dark:text-white">Profile Settings</span>
                                            </button>
                                        </div>
                                        <div className="border-t border-neutral-100 dark:border-neutral-800">
                                            <button
                                                onClick={handleSignOut}
                                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400"
                                            >
                                                <div className="w-8 h-8 bg-red-500/10 dark:bg-red-500/20 rounded-lg flex items-center justify-center">
                                                    <LogOut className="w-4 h-4 text-red-600 dark:text-red-400" />
                                                </div>
                                                <span className="font-medium text-sm">Sign Out</span>
                                            </button>
                                        </div>
                                    </div>
                                )
                            }
                        </div>
                    ) : (
                        <div className="px-3 py-2">
                            <button
                                onClick={() => router.push('/')}
                                className={cn(
                                    "flex items-center w-full rounded-lg p-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all hover:bg-neutral-100 dark:hover:bg-neutral-800 group",
                                    isCollapsed && "justify-center"
                                )}
                                title="Sign In"
                            >
                                <User className="h-5 w-5" />
                                {!isCollapsed && <span className="ml-3">Sign In</span>}
                            </button>
                        </div>
                    )
                }
            </div>
        </>
    )

    return (
        <TooltipProvider>
            <button
                onClick={() => setIsMobileOpen(!isMobileOpen)}
                className="fixed top-6 left-6 z-50 lg:hidden bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all shadow-lg"
                aria-label="Toggle sidebar"
            >
                {
                    !isMobileOpen && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    )
                }
            </button>
            {
                isMobileOpen && (
                    <div
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
                        onClick={() => setIsMobileOpen(false)}
                    />
                )
            }
            <aside
                className={cn(
                    "fixed top-0 left-0 h-screen bg-neutral-100 dark:bg-neutral-900 flex flex-col z-40 transition-all duration-300",
                    "hidden lg:flex",
                    isCollapsed ? "lg:w-[90px]" : "lg:w-64",
                    "lg:translate-x-0"
                )}
            >
                <SidebarContent />
            </aside>
            <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
                <SheetContent side="left" className="p-0 w-64 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
                    <div className="flex flex-col h-full">
                        <SidebarContent />
                    </div>
                </SheetContent>
            </Sheet>
        </TooltipProvider>
    )
}