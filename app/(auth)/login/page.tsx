"use client"

import { useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Zap, Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react"

type Flow = "login" | "signup"

export default function LoginPage() {
  const [flow, setFlow] = useState<Flow>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signedUp, setSignedUp] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (flow === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      setLoading(false)
      if (error) {
        setError(error.message === "Invalid login credentials"
          ? "Email o contraseña incorrectos"
          : error.message)
      } else {
        window.location.href = "/dashboard"
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/callback` },
      })
      setLoading(false)
      if (error) setError(error.message)
      else setSignedUp(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0F172A] via-[#1e3a5f] to-[#0369A1]">
      <div className="w-full max-w-sm">
        <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl shadow-black/20 p-8 border border-white/60">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-400/30">
              <Zap size={18} className="text-white" fill="white" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-lg leading-none">OpenScout AI</p>
              <p className="text-xs text-slate-400 mt-0.5">AI Recruitment Platform</p>
            </div>
          </div>

          {signedUp ? (
            <div className="text-center space-y-3 py-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto">
                <Mail size={24} className="text-emerald-600" />
              </div>
              <p className="font-semibold text-slate-900">¡Cuenta creada!</p>
              <p className="text-sm text-slate-500">
                Revisa <span className="font-mono text-slate-700">{email}</span> y confirma tu cuenta para activarla.
              </p>
              <button
                onClick={() => { setSignedUp(false); setFlow("login") }}
                className="text-xs text-blue-600 hover:underline cursor-pointer"
              >
                Volver al inicio de sesión
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Flow toggle */}
              <div className="flex rounded-xl bg-slate-100 p-1 gap-1 mb-2">
                {(["login", "signup"] as Flow[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => { setFlow(f); setError(null) }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      flow === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {f === "login" ? "Iniciar sesión" : "Crear cuenta"}
                  </button>
                ))}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-slate-600">Email</Label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="pl-9 h-10 text-sm"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold text-slate-600">Contraseña</Label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="password"
                    type={showPw ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete={flow === "login" ? "current-password" : "new-password"}
                    className="pl-9 pr-9 h-10 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}

              <Button type="submit" disabled={loading} className="w-full h-10 text-sm font-semibold rounded-xl cursor-pointer">
                {loading && <Loader2 size={16} className="animate-spin mr-2" />}
                {flow === "login" ? "Iniciar sesión" : "Crear cuenta"}
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-blue-200/50 mt-6">
          OpenScout AI · Powered by Gemini 2.5 Pro
        </p>
      </div>
    </div>
  )
}
