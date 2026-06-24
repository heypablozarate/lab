// fade.ts
export function fadeAlpha(age: number, life: number): number {
  if (age < 0 || age > life) return 0
  const inT = life * 0.2, outT = life * 0.4
  if (age < inT) return age / inT
  if (age > life - outT) return (life - age) / outT
  return 1
}
