"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { signIn, useSession } from "@repo/auth/client"
import { toast } from "@repo/ui/components/ui/sonner"
import {
    Shield, Loader2, Mail, Lock, KeyRound, Eye, EyeOff
} from "lucide-react"
import { motion } from "framer-motion"
import {
    Tabs, TabsList, TabsTrigger, TabsContent
} from "@repo/ui/components/ui/tabs"
import { Label } from "@repo/ui/components/ui/label"
import { Input } from "@repo/ui/components/ui/input"

export default function AdminSignInPage() {
    const router = useRouter()
    const { data: session, isPending } = useSession()
    const [isLoading, setIsLoading] = useState(false)
    const [authMode, setAuthMode] = useState<"credentials" | "accessCode">("credentials")
    const [showPassword, setShowPassword] = useState(false)

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [accessCode, setAccessCode] = useState("")

    // Redirect if already authenticated
    useEffect(() => {
        if (!isPending && session) {
            router.push("/dashboard")
        }
    }, [session, isPending, router])

    const handleCredentialsSignIn = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!email || !password) {
            toast.error("Missing credentials", {
                description: "Please enter your email and password"
            })
            return
        }

        setIsLoading(true)

        try {
            const result = await signIn.email({
                email,
                password,
                callbackURL: "/dashboard",
                fetchOptions: { throw: false },
            })

            if (result?.error) {
                toast.error("Sign in failed", {
                    description: "Invalid email or password"
                })
            } else {
                toast.success("Welcome back!", {
                    description: "Redirecting to dashboard..."
                })
                router.push("/dashboard")
            }
        } catch (error) {
            console.error("Error occurred while signing in:", error)
            toast.error("Sign in failed", {
                description: "An unexpected error occurred"
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleAccessCodeSignIn = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!email || !accessCode) {
            toast.error("Missing information", {
                description: "Please enter your email and access code"
            })
            return
        }

        setIsLoading(true)

        try {
            const response = await fetch("/api/auth/verifycode", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, accessCode })
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.message || "Invalid access code")
            }

            // Sign in with the access code as a temporary password
            const result = await signIn.email({
                email,
                password: accessCode,
                callbackURL: "/dashboard",
                fetchOptions: { throw: false },
            })

            if (result?.error) {
                toast.error("Sign in failed", {
                    description: "Invalid access code"
                })
            } else {
                toast.success("Welcome!", {
                    description: "Please set up your password on the next screen"
                })
                router.push("/dashboard")
            }
        } catch (error) {
            console.error("Error occurred during verification:", error)
            toast.error("Verification failed", {
                description: "Invalid or expired access code"
            })
        } finally {
            setIsLoading(false)
        }
    }

    if (isPending) {
        return (
            <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center p-4">
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:14px_24px]" />
                <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
            </div>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="relative z-10 w-full max-w-2xl"
            >
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 mb-4 shadow-lg">
                        <Shield className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Admin Panel</h1>
                    <p className="text-neutral-500 dark:text-neutral-400 mt-1 text-sm">Sign in to access the control center</p>
                </div>
                <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xl overflow-hidden">
                    <Tabs value={authMode} onValueChange={v => setAuthMode(v as "credentials" | "accessCode")} className="w-full">
                        <TabsList className="w-full grid grid-cols-2">
                            <TabsTrigger value="credentials">Password</TabsTrigger>
                            <TabsTrigger value="accessCode">Access Code</TabsTrigger>
                        </TabsList>
                        <TabsContent value="credentials">
                            <form onSubmit={handleCredentialsSignIn} className="p-8 space-y-6 w-full max-w-lg mx-auto">
                                <div>
                                    <Label htmlFor="email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                                        Email Address
                                    </Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                                        <Input
                                            id="email"
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="admin@example.com"
                                            className="w-full pl-11 pr-4 py-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label htmlFor="password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                                        Password
                                    </Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                                        <Input
                                            id="password"
                                            type={showPassword ? "text" : "password"}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Enter your password"
                                            className="w-full pl-11 pr-12 py-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                                        >
                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="cursor-pointer w-full py-3 px-4 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            <span>Signing in...</span>
                                        </>
                                    ) : (
                                        <span>Sign In</span>
                                    )}
                                </button>
                            </form>
                        </TabsContent>
                        <TabsContent value="accessCode">
                            <form onSubmit={handleAccessCodeSignIn} className="p-8 space-y-6 w-full max-w-lg mx-auto">
                                <div>
                                    <Label htmlFor="emailCode" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                                        Email Address
                                    </Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                                        <Input
                                            id="emailCode"
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="admin@example.com"
                                            className="w-full pl-11 pr-4 py-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label htmlFor="accessCode" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                                        Access Code
                                    </Label>
                                    <div className="relative">
                                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                                        <Input
                                            id="accessCode"
                                            type="text"
                                            value={accessCode}
                                            onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                                            placeholder="Enter access code (e.g., ADMIN-X7K2M9)"
                                            className="w-full pl-11 pr-4 py-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-mono tracking-wider"
                                        />
                                    </div>
                                    <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                                        Enter the access code sent to your email by the administrator
                                    </p>
                                </div>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-3 px-4 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            <span>Signing in...</span>
                                        </>
                                    ) : (
                                        <span>Sign In</span>
                                    )}
                                </button>
                            </form>
                        </TabsContent>
                    </Tabs>
                </div>
                <p className="text-center text-xs text-neutral-500 dark:text-neutral-400 mt-6">
                    Protected area. Unauthorized access is prohibited.
                </p>
            </motion.div>
        </div>
    )
}
