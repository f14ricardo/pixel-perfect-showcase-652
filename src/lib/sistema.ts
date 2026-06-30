export const SALAS = [
  "1EF-A","1EF-B","2EF-A","2EF-B","3EF-A","3EF-B","4EF-A","4EF-B","5EF-A","5EF-B",
  "6EF-A","6EF-B","7EF-A","7EF-B","8EF-A","8EF-B","9EF-A","9EF-B",
  "1EM-A","1EM-B","2EM-A","2EM-B","3EM-A","3EM-B",
] as const;

export const COMPONENTES_LABEL: Record<string, string> = {
  BIO: "Biologia",
  FIS: "Física",
  QUI: "Química",
  MA: "Matemática",
  LP: "Língua Portuguesa",
  AR: "Arte",
  EF: "Educação Física",
  LI: "Língua Inglesa",
  HI: "História",
  GE: "Geografia",
  SOC: "Sociologia",
  FIL: "Filosofia",
  MTE: "Matemática (Estudo Técnico)",
  TPT: "Trabalho e Projeto de Vida",
  CN: "Ciências da Natureza",
  PR: "Projeto Integrador",
  STE: "STEAM",
};

export const STATUS_LABEL: Record<string, string> = {
  AT: "Ativo",
  TR: "Transferido",
  RE: "Realocado",
};

export type Etapa = 1 | 2 | 3;

export function projecao(n1: number | null, n2: number | null, n3: number | null): number | null {
  const vals = [n1, n2, n3].filter((v): v is number => v !== null && !Number.isNaN(v));
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function gradeClass(nota: number | null | undefined): string {
  if (nota === null || nota === undefined || Number.isNaN(nota)) return "bg-grade-empty text-muted-foreground";
  if (nota >= 7) return "bg-grade-good text-emerald-900";
  if (nota >= 5) return "bg-grade-warn text-amber-900";
  return "bg-grade-bad text-red-900";
}

export function statusBadgeClass(status: string): string {
  switch (status) {
    case "AT": return "bg-success text-success-foreground";
    case "TR": return "bg-muted text-muted-foreground";
    case "RE": return "bg-warning text-warning-foreground";
    default: return "bg-muted text-muted-foreground";
  }
}

export function formatNota(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toFixed(1).replace(".", ",");
}

export function formatFreq(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n.toFixed(2).replace(".", ",")}%`;
}
