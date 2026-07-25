/**
 * Cálculo de edad a partir de la fecha de nacimiento — ver AGENTS.md §6.5.
 * Autodeclarada por el jugador (como en la gran mayoría de plataformas,
 * Roblox incluido): no hay verificación de identidad real detrás, así que
 * el texto de Términos y Condiciones debe ser honesto sobre esa limitación
 * — esto solo gatea la función de chat en vivo, nunca el acceso al juego
 * en sí (el juego sigue siendo para todas las edades).
 */
export const ADULT_AGE = 18;

export function calculateAge(birthDate: Date, now: Date = new Date()): number {
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
}

export function isAdultBirthDate(birthDate: Date, now: Date = new Date()): boolean {
  return calculateAge(birthDate, now) >= ADULT_AGE;
}
