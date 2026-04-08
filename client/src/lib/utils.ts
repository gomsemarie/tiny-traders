import { type ClassValue, clsx } from 'clsx';

/** Tailwind CSS class merge utility (shadcn/ui 호환) */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
