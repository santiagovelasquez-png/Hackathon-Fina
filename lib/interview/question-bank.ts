export interface Question {
  id: string
  competency_name: string
  question_text: string
  tags: string[] // skills/domains this question is especially relevant for
}

export const QUESTION_BANK: Question[] = [
  // Problem Solving
  {
    id: "q_ps_1",
    competency_name: "problem_solving",
    question_text: "Cuéntame de un problema técnico difícil que hayas resuelto. ¿Cuál fue tu proceso de diagnóstico?",
    tags: ["technical", "engineering", "backend", "frontend"],
  },
  {
    id: "q_ps_2",
    competency_name: "problem_solving",
    question_text: "Describe una situación donde tuviste que tomar una decisión con información incompleta. ¿Qué hiciste?",
    tags: ["product", "management", "strategy"],
  },

  // Technical Communication
  {
    id: "q_tc_1",
    competency_name: "technical_communication",
    question_text: "¿Cómo explicas conceptos técnicos complejos a personas sin background técnico? Dame un ejemplo.",
    tags: ["engineering", "backend", "frontend", "data"],
  },
  {
    id: "q_tc_2",
    competency_name: "technical_communication",
    question_text: "¿Cómo documentas tu trabajo? ¿Qué herramientas usas y cómo decides qué documentar?",
    tags: ["engineering", "backend", "api"],
  },

  // Collaboration
  {
    id: "q_col_1",
    competency_name: "collaboration",
    question_text: "Describe una situación donde tuviste un conflicto con un compañero de equipo. ¿Cómo lo resolviste?",
    tags: ["teamwork", "soft", "management"],
  },
  {
    id: "q_col_2",
    competency_name: "collaboration",
    question_text: "¿Cómo trabajas en equipos multidisciplinarios (diseño, producto, negocio)? Dame un ejemplo reciente.",
    tags: ["product", "design", "agile"],
  },

  // Learning Agility
  {
    id: "q_la_1",
    competency_name: "learning_agility",
    question_text: "¿Cuándo fue la última vez que aprendiste una tecnología nueva de cero? ¿Cómo lo hiciste y qué tan rápido lo dominaste?",
    tags: ["technical", "engineering", "growth"],
  },
  {
    id: "q_la_2",
    competency_name: "learning_agility",
    question_text: "¿Cómo te mantienes al día con los cambios en tu campo? Dame ejemplos de los últimos 6 meses.",
    tags: ["ai", "data", "engineering", "frontend"],
  },

  // Impact & Delivery
  {
    id: "q_id_1",
    competency_name: "impact_delivery",
    question_text: "¿Cuál es el proyecto del que estás más orgulloso/a? ¿Qué impacto tuvo y cómo lo mediste?",
    tags: ["engineering", "product", "management"],
  },
  {
    id: "q_id_2",
    competency_name: "impact_delivery",
    question_text: "Cuéntame de una vez que tuviste que cumplir un deadline muy ajustado. ¿Qué sacrificaste y qué defendiste?",
    tags: ["engineering", "product", "startup"],
  },

  // Leadership
  {
    id: "q_lead_1",
    competency_name: "leadership",
    question_text: "Cuéntame de una vez que tomaste iniciativa sin que nadie te lo pidiera. ¿Qué pasó?",
    tags: ["leadership", "startup", "senior"],
  },
  {
    id: "q_lead_2",
    competency_name: "leadership",
    question_text: "¿Has mentoreado o guiado a alguien más junior? ¿Cómo lo hiciste?",
    tags: ["leadership", "senior", "management"],
  },

  // Domain-specific extras
  {
    id: "q_data_1",
    competency_name: "analytical_thinking",
    question_text: "¿Cómo defines métricas de éxito para un proyecto? Dame un ejemplo donde cambiaste las métricas a mitad del proyecto.",
    tags: ["data", "product", "analytics"],
  },
  {
    id: "q_sys_1",
    competency_name: "systems_thinking",
    question_text: "¿Cómo diseñas sistemas que escalan? ¿Cuál fue el cuello de botella más difícil que resolviste?",
    tags: ["backend", "infrastructure", "engineering", "distributed"],
  },
  {
    id: "q_ux_1",
    competency_name: "user_empathy",
    question_text: "¿Cuándo fue la última vez que hablaste directamente con un usuario? ¿Qué aprendiste y qué cambiaste?",
    tags: ["product", "design", "frontend", "ux"],
  },
]

export const DEFAULT_QUESTION_COUNT = 6
