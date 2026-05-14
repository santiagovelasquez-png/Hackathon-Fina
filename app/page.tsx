"use client"

import Link from "next/link"
import { Zap, FileText, BarChart3, MessageSquare, Users, CheckCircle, ArrowRight, Star, Upload, Mic, ClipboardList } from "lucide-react"
import { motion } from "framer-motion"
import { Reveal, StaggerReveal, Float, HoverCard, fadeUp, scaleIn, slideLeft, slideRight } from "@/components/ui/motion"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0F172A] text-white overflow-x-hidden">

      {/* ── Navbar ── */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-50 bg-[#0F172A]/80 backdrop-blur-md border-b border-white/10"
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-900/40">
              <Zap size={15} className="text-white" fill="white" />
            </div>
            <span className="font-bold text-white text-base tracking-tight">OpenScout AI</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-slate-300 hover:text-white transition-colors px-4 py-2 cursor-pointer">
              Iniciar sesión
            </Link>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link href="/login"
                className="text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl transition-all shadow-lg shadow-blue-900/30 cursor-pointer">
                Comenzar gratis
              </Link>
            </motion.div>
          </div>
        </div>
      </motion.nav>

      {/* ── Hero ── */}
      <section className="animated-gradient-bg pt-32 pb-24 px-6 relative overflow-hidden">
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-blue-400/15 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-white/10 border border-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 text-xs font-medium text-blue-200 mb-8"
          >
            <Zap size={12} fill="currentColor" />
            Powered by Gemini 2.0 Flash · Hackathon 2025
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-5xl md:text-6xl font-bold tracking-tight leading-tight mb-6"
          >
            Encuentra el talento correcto,
            <br />
            <span className="landing-gradient-text">más rápido con IA</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="text-lg text-blue-100/80 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            OpenScout analiza CVs, rankea candidatos objetivamente y coordina entrevistas automáticas.
            Sin sesgos. Sin cajas negras. Resultados en minutos.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.35 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Link href="/login"
                className="inline-flex items-center gap-2 bg-white text-slate-900 font-bold px-8 py-4 rounded-2xl hover:bg-blue-50 transition-all shadow-2xl shadow-black/30 cursor-pointer text-base">
                Empieza gratis
                <ArrowRight size={18} />
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <a href="#como-funciona"
                className="inline-flex items-center gap-2 border border-white/20 text-white font-semibold px-8 py-4 rounded-2xl hover:bg-white/10 transition-all cursor-pointer text-base">
                Ver cómo funciona
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="bg-[#0F172A] border-y border-white/10 py-12 px-6">
        <StaggerReveal className="max-w-4xl mx-auto grid grid-cols-3 gap-8 text-center" staggerDelay={0.15}>
          {[
            { value: "10×", label: "más rápido que revisión manual" },
            { value: "0", label: "sesgos subjetivos en el scoring" },
            { value: "5", label: "dimensiones de evaluación IA" },
          ].map((s) => (
            <motion.div key={s.label} variants={fadeUp}>
              <p className="text-4xl font-bold text-white mb-2">{s.value}</p>
              <p className="text-sm text-slate-400 leading-snug">{s.label}</p>
            </motion.div>
          ))}
        </StaggerReveal>
      </section>

      {/* ── Cómo funciona ── */}
      <section id="como-funciona" className="bg-[#111827] py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-16">
            <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3">Proceso</p>
            <h2 className="text-4xl font-bold text-white mb-4">Tres pasos para contratar mejor</h2>
            <p className="text-slate-400 max-w-xl mx-auto">Sin curva de aprendizaje. Sin integraciones complejas. Funciona desde el primer día.</p>
          </Reveal>

          <StaggerReveal className="grid md:grid-cols-3 gap-8" staggerDelay={0.14}>
            {[
              {
                step: "01",
                Icon: ClipboardList,
                title: "Crea el perfil del cargo",
                desc: "Describe el puesto por formulario, sube la descripción del cargo en PDF, o simplemente habla: la IA lo estructura automáticamente.",
                detail: ["Formulario guiado", "Subir documento", "Modo voz"],
              },
              {
                step: "02",
                Icon: Upload,
                title: "Sube los CVs",
                desc: "Arrastra y suelta los PDFs. OpenScout los normaliza en un perfil estándar (UTL) y los evalúa en segundos.",
                detail: ["PDF, Word, imagen", "Normalización automática", "Score instantáneo"],
              },
              {
                step: "03",
                Icon: MessageSquare,
                title: "Entrevistas automáticas",
                desc: "Los mejores candidatos reciben un link. La IA selecciona las 6 preguntas más relevantes y ellos responden a su ritmo.",
                detail: ["Sin agendar reuniones", "Respuestas asíncronas", "Análisis IA incluido"],
              },
            ].map(({ step, Icon, title, desc, detail }) => (
              <motion.div
                key={step}
                variants={fadeUp}
                whileHover={{ y: -6, borderColor: "rgba(59,130,246,0.5)" }}
                transition={{ duration: 0.25 }}
                className="relative bg-[#1E293B] rounded-2xl p-7 border border-white/10 cursor-default group"
              >
                <div className="flex items-start gap-4 mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shrink-0 shadow-lg shadow-blue-900/40 group-hover:shadow-blue-500/30 transition-all">
                    <Icon size={20} className="text-white" />
                  </div>
                  <span className="text-5xl font-black text-white/10 leading-none mt-1">{step}</span>
                </div>
                <h3 className="font-bold text-white text-lg mb-3">{title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-5">{desc}</p>
                <ul className="space-y-2">
                  {detail.map((d) => (
                    <li key={d} className="flex items-center gap-2 text-xs text-slate-300">
                      <CheckCircle size={13} className="text-blue-400 shrink-0" />
                      {d}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </StaggerReveal>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="bg-[#0F172A] py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-16">
            <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3">Tecnología</p>
            <h2 className="text-4xl font-bold text-white mb-4">Reclutamiento sin cajas negras</h2>
            <p className="text-slate-400 max-w-xl mx-auto">Cada decisión tiene una razón. Cada score, una explicación.</p>
          </Reveal>

          <StaggerReveal className="grid md:grid-cols-3 gap-6" staggerDelay={0.12}>
            {[
              {
                Icon: FileText,
                color: "from-violet-600 to-violet-800",
                glow: "shadow-violet-900/40",
                hover: "group-hover:shadow-violet-500/30",
                title: "Normalización UTL",
                desc: "Todo CV — PDF, imagen, texto — se convierte en un Universal Talent Language profile. Datos consistentes y comparables.",
              },
              {
                Icon: BarChart3,
                color: "from-blue-600 to-blue-800",
                glow: "shadow-blue-900/40",
                hover: "group-hover:shadow-blue-500/30",
                title: "Score Explicable",
                desc: "5 dimensiones: skills, experiencia, competencias, educación, completitud. Cada punto tiene una razón visible.",
              },
              {
                Icon: Mic,
                color: "from-emerald-600 to-emerald-800",
                glow: "shadow-emerald-900/40",
                hover: "group-hover:shadow-emerald-500/30",
                title: "Entrevistas IA por Telegram",
                desc: "Candidatos reciben un link y responden 6 preguntas por Telegram. La IA analiza y re-scorea automáticamente.",
              },
            ].map(({ Icon, color, glow, hover, title, desc }) => (
              <motion.div
                key={title}
                variants={scaleIn}
                whileHover={{ y: -5, borderColor: "rgba(99,102,241,0.4)" }}
                transition={{ duration: 0.22 }}
                className="bg-[#1E293B] rounded-2xl p-7 border border-white/10 group cursor-default"
              >
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center mb-5 shadow-lg ${glow} ${hover} transition-all`}>
                  <Icon size={20} className="text-white" />
                </div>
                <h3 className="font-bold text-white text-lg mb-3">{title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </StaggerReveal>
        </div>
      </section>

      {/* ── Pool de Talento ── */}
      <section className="bg-[#111827] py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <Reveal variants={slideLeft}>
              <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3">Pool de Talento</p>
              <h2 className="text-4xl font-bold text-white mb-6 leading-tight">
                Candidatos ya procesados,<br />
                <span className="text-blue-400">listos para ti</span>
              </h2>
              <p className="text-slate-400 leading-relaxed mb-8">
                Accede a nuestra base de perfiles normalizados. La IA los compara contra tu cargo
                y te recomienda los más afines — antes de que tengas que buscar.
              </p>
              <StaggerReveal className="space-y-4" staggerDelay={0.1}>
                {[
                  "Perfiles pre-evaluados con score IA",
                  "Recomendaciones automáticas por cargo",
                  "Filtros por skills, experiencia y ubicación",
                  "Invita directamente desde el ranking",
                ].map((item) => (
                  <motion.li key={item} variants={fadeUp} className="flex items-start gap-3 list-none">
                    <CheckCircle size={18} className="text-blue-400 shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-300">{item}</span>
                  </motion.li>
                ))}
              </StaggerReveal>
            </Reveal>

            <Reveal variants={slideRight}>
              <Float>
                <div className="bg-[#1E293B] rounded-2xl p-6 border border-white/10 shadow-2xl shadow-black/40">
                  <div className="flex items-center justify-between mb-5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Ranking · Backend Engineer</p>
                    <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full font-semibold border border-emerald-500/30">Activo</span>
                  </div>
                  {[
                    { name: "Ana García", score: 9.4, skills: ["Python", "FastAPI"], exp: "5 años", rank: 1 },
                    { name: "Carlos López", score: 8.1, skills: ["Node.js", "AWS"], exp: "4 años", rank: 2 },
                    { name: "María Chen", score: 7.8, skills: ["Go", "Docker"], exp: "3 años", rank: 3 },
                  ].map(({ name, score, skills, exp, rank }) => (
                    <div key={name} className="flex items-center gap-4 py-3 border-b border-white/5 last:border-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold
                        ${rank === 1 ? "bg-gradient-to-br from-yellow-400 to-yellow-600 text-white shadow-md shadow-yellow-900/30" :
                          rank === 2 ? "bg-gradient-to-br from-slate-300 to-slate-500 text-white" :
                          "bg-gradient-to-br from-amber-600 to-amber-800 text-white"}`}>
                        {rank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{name}</p>
                        <div className="flex gap-1 mt-1">
                          {skills.map(s => (
                            <span key={s} className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-mono">{s}</span>
                          ))}
                          <span className="text-xs text-slate-500">{exp}</span>
                        </div>
                      </div>
                      <span className={`text-sm font-bold px-2.5 py-1 rounded-full
                        ${score >= 9 ? "bg-emerald-500/20 text-emerald-400" :
                          score >= 7 ? "bg-blue-500/20 text-blue-400" :
                          "bg-amber-500/20 text-amber-400"}`}>
                        {score}
                      </span>
                    </div>
                  ))}
                  <button className="mt-4 w-full text-xs text-center text-blue-400 hover:text-blue-300 transition-colors cursor-pointer py-2">
                    Ver ranking completo →
                  </button>
                </div>
              </Float>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Testimonial ── */}
      <Reveal variants={fadeUp}>
        <section className="bg-[#0F172A] py-16 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <div className="flex justify-center gap-1 mb-4">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={18} className="text-yellow-400 fill-yellow-400" />
              ))}
            </div>
            <blockquote className="text-xl text-white font-medium leading-relaxed mb-6">
              "Pasamos de revisar 80 CVs manualmente a tener un ranking objetivo en 5 minutos.
              Nunca volvemos al proceso anterior."
            </blockquote>
            <div className="flex items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                <span className="text-sm font-bold text-white">MR</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-white">Marcela Ruiz</p>
                <p className="text-xs text-slate-400">Head of Talent · TechCorp Latam</p>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      {/* ── CTA final ── */}
      <Reveal variants={scaleIn}>
        <section className="animated-gradient-bg py-24 px-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-black/20" />
          <div className="max-w-3xl mx-auto text-center relative">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
              Empieza a contratar mejor
              <br />
              <span className="text-blue-200">desde hoy</span>
            </h2>
            <p className="text-lg text-blue-100/80 mb-10">
              Crea tu cuenta gratis y rankea tu primer lote de candidatos en menos de 10 minutos.
            </p>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
              <Link href="/login"
                className="inline-flex items-center gap-3 bg-white text-slate-900 font-bold px-10 py-4 rounded-2xl hover:bg-blue-50 transition-all shadow-2xl shadow-black/30 cursor-pointer text-base">
                <Users size={20} />
                Crear cuenta gratis
              </Link>
            </motion.div>
            <p className="mt-6 text-xs text-blue-200/50">Sin tarjeta de crédito · Setup en 5 minutos</p>
          </div>
        </section>
      </Reveal>

      {/* ── Footer ── */}
      <footer className="bg-[#0F172A] border-t border-white/10 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
              <Zap size={12} className="text-white" fill="white" />
            </div>
            <span className="font-bold text-white text-sm">OpenScout AI</span>
          </div>
          <p className="text-xs text-slate-500 text-center">
            Construido para Fina + Platanus Hackathon 2025 · Powered by Gemini 2.0 Flash
          </p>
          <Link href="/login" className="text-xs text-blue-400 hover:text-blue-300 transition-colors cursor-pointer">
            Iniciar sesión →
          </Link>
        </div>
      </footer>

    </div>
  )
}
