"use client"

import { useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Zap, Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react"

type Mode = "password" | "magic"
type PasswordFlow = "login" | "signup"

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("password")
  const [flow, setFlow] = useState<PasswordFlow>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [signedUp, setSignedUp] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleGoogle() {
    setGoogleLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/callback` },
    })
    if (error) { setError(error.message); setGoogleLoading(false) }
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (flow === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      setLoading(false)
      if (error) setError(error.message === "Invalid login credentials" ? "Email o contraseña incorrectos" : error.message)
      else window.location.href = "/dashboard"
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

  async function handleMagic(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/callback` },
    })
    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0F172A] via-[#1e3a5f] to-[#0369A1]">
      <div className="w-full max-w-sm">
        {/* Card */}
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

          {sent ? (
            <div className="text-center space-y-3 py-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto">
                <Mail size={24} className="text-blue-600" />
              </div>
              <p className="font-semibold text-slate-900">Revisa tu email</p>
              <p className="text-sm text-slate-500">Enviamos un magic link a <span className="font-mono text-slate-700">{email}</span></p>
              <button onClick={() => setSent(false)} className="text-xs text-blue-600 hover:underline cursor-pointer mt-2">
                Intentar de nuevo
              </button>
            </div>
          ) : signedUp ? (
            <div className="text-center space-y-3 py-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto">
                <Mail size={24} className="text-emerald-600" />
              </div>
              <p className="font-semibold text-slate-900">¡Cuenta creada!</p>
              <p className="text-sm text-slate-500">Confirma tu email en <span className="font-mono text-slate-700">{email}</span> para activar tu cuenta</p>
              <button onClick={() => { setSignedUp(false); setFlow("login") }} className="text-xs text-blue-600 hover:underline cursor-pointer">
                Volver al inicio de sesión
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Google */}
              <button
                onClick={handleGoogle}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-3 rounded-xl border-2 border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-all duration-200 cursor-pointer disabled:opacity-60 shadow-sm"
              >
                {googleLoading ? <Loader2 size={18} className="animate-spin" /> : <GoogleIcon />}
                Continuar con Google
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400 font-medium">o</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Mode tabs */}
              <div className="flex rounded-xl bg-slate-100 p-1 gap-1">
                {([["password", "Contraseña"], ["magic", "Magic link"]] as [Mode, string][]).map(([m, label]) => (
                  <button key={m} type="button" onClick={() => { setMode(m); setError(null) }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Password form */}
              {mode === "password" && (
                <form onSubmit={handlePassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-semibold text-slate-600">Email</Label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input id="email" type="email" placeholder="tu@empresa.com" value={email}
                        onChange={(e) => setEmail(e.target.value)} required autoComplete="email"
                        className="pl-9 h-10 text-sm" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-xs font-semibold text-slate-600">Contraseña</Label>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input id="password" type={showPw ? "text" : "password"} placeholder="••••••••" value={password}
                        onChange={(e) => setPassword(e.target.value)} required autoComplete={flow === "login" ? "current-password" : "new-password"}
                        className="pl-9 pr-9 h-10 text-sm" />
                      <button type="button" onClick={() => setShowPw(!showPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                        {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

                  <Button type="submit" disabled={loading} className="w-full h-10 text-sm font-semibold rounded-xl cursor-pointer">
                    {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                    {flow === "login" ? "Iniciar sesión" : "Crear cuenta"}
                  </Button>

                  <p className="text-center text-xs text-slate-500">
                    {flow === "login" ? (
                      <>¿Sin cuenta? <button type="button" onClick={() => { setFlow("signup"); setError(null) }}
                        className="text-blue-600 font-semibold hover:underline cursor-pointer">Regístrate</button></>
                    ) : (
                      <>¿Ya tienes cuenta? <button type="button" onClick={() => { setFlow("login"); setError(null) }}
                        className="text-blue-600 font-semibold hover:underline cursor-pointer">Inicia sesión</button></>
                    )}
                  </p>
                </form>
              )}

              {/* Magic link form */}
              {mode === "magic" && (
                <form onSubmit={handleMagic} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email-magic" className="text-xs font-semibold text-slate-600">Email</Label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input id="email-magic" type="email" placeholder="tu@empresa.com" value={email}
                        onChange={(e) => setEmail(e.target.value)} required autoComplete="email"
                        className="pl-9 h-10 text-sm" />
                    </div>
                  </div>
                  {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                  <Button type="submit" disabled={loading} className="w-full h-10 text-sm font-semibold rounded-xl cursor-pointer">
                    {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                    Enviar magic link
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-blue-200/50 mt-6">
          OpenScout AI · Powered by Gemini 2.5 Pro
        </p>
      </div>
    </div>
  )
}
