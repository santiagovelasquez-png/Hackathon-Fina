/**
 * Canonical skill name map. Normalizes common aliases to a standard form.
 * Keys: lowercase input variants. Values: canonical display name.
 */
const SKILL_MAP: Record<string, string> = {
  // JavaScript ecosystem
  js: "JavaScript",
  javascript: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  node: "Node.js",
  nodejs: "Node.js",
  "node.js": "Node.js",
  react: "React",
  reactjs: "React",
  "react.js": "React",
  next: "Next.js",
  nextjs: "Next.js",
  "next.js": "Next.js",
  vue: "Vue.js",
  vuejs: "Vue.js",
  "vue.js": "Vue.js",
  angular: "Angular",
  svelte: "Svelte",

  // Python
  python: "Python",
  py: "Python",
  django: "Django",
  flask: "Flask",
  fastapi: "FastAPI",

  // Data / ML
  sql: "SQL",
  postgresql: "PostgreSQL",
  postgres: "PostgreSQL",
  mysql: "MySQL",
  mongodb: "MongoDB",
  mongo: "MongoDB",
  redis: "Redis",
  elasticsearch: "Elasticsearch",
  pandas: "Pandas",
  numpy: "NumPy",
  sklearn: "scikit-learn",
  "scikit-learn": "scikit-learn",
  tensorflow: "TensorFlow",
  pytorch: "PyTorch",

  // Cloud / DevOps
  aws: "AWS",
  gcp: "GCP",
  azure: "Azure",
  docker: "Docker",
  kubernetes: "Kubernetes",
  k8s: "Kubernetes",
  terraform: "Terraform",
  github: "GitHub",
  gitlab: "GitLab",

  // Languages
  java: "Java",
  go: "Go",
  golang: "Go",
  rust: "Rust",
  php: "PHP",
  ruby: "Ruby",
  "c#": "C#",
  csharp: "C#",
  cpp: "C++",
  "c++": "C++",
  swift: "Swift",
  kotlin: "Kotlin",

  // Soft skills
  leadership: "Leadership",
  communication: "Communication",
  teamwork: "Teamwork",
  "problem solving": "Problem Solving",
  "problem-solving": "Problem Solving",
  agile: "Agile",
  scrum: "Scrum",
}

export function normalizeSkillName(raw: string): string {
  const key = raw.toLowerCase().trim()
  return SKILL_MAP[key] ?? titleCase(raw.trim())
}

function titleCase(str: string): string {
  return str.replace(/\w\S*/g, (word) => {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  })
}
