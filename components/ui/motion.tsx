"use client"

import { motion, useMotionValue, useTransform, animate, type Variants } from "framer-motion"
import { useEffect, useRef } from "react"

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.4 } },
}

export const stagger = (delay = 0.1): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: delay } },
})

export const slideLeft: Variants = {
  hidden: { opacity: 0, x: -40 },
  show: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}

export const slideRight: Variants = {
  hidden: { opacity: 0, x: 40 },
  show: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
}

// Section reveal wrapper — triggers once on scroll
export function Reveal({
  children,
  variants = fadeUp,
  className,
  delay = 0,
}: {
  children: React.ReactNode
  variants?: Variants
  className?: string
  delay?: number
}) {
  return (
    <motion.div
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Stagger container — children must use Reveal or motion variants
export function StaggerReveal({
  children,
  className,
  delayChildren = 0,
  staggerDelay = 0.12,
}: {
  children: React.ReactNode
  className?: string
  delayChildren?: number
  staggerDelay?: number
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: staggerDelay, delayChildren } } }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Animated number counter
export function CountUp({
  to,
  duration = 1.5,
  className,
  prefix = "",
  suffix = "",
}: {
  to: number
  duration?: number
  className?: string
  prefix?: string
  suffix?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const motionVal = useMotionValue(0)
  const rounded = useTransform(motionVal, (v) => `${prefix}${Math.round(v)}${suffix}`)
  const hasAnimated = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true
          animate(motionVal, to, { duration, ease: "easeOut" })
        }
      },
      { threshold: 0.5 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [to, duration, motionVal])

  return (
    <motion.span ref={ref} className={className}>
      {rounded}
    </motion.span>
  )
}

// Hover card lift
export function HoverCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: "0 20px 40px -12px rgba(0,0,0,0.15)" }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Float animation (infinite)
export function Float({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export { motion }
