import { z } from 'zod';
import { defineTask, JSON_RULES } from '../task';

export interface TranslateNameInput {
  text: string;
}
const output = z.object({ en: z.string().min(1).max(80), ar: z.string().min(1).max(80) });

/** Short school-subject name → English + Arabic. */
export const translateName = defineTask({
  name: 'translateName',
  model: 'fast',
  schema: output,
  system: `You translate a school subject name. Return the English name and the Modern Standard Arabic name a Lebanese school would use. Keep it short (1-4 words). If the input is already Arabic, translate to English for "en". ${JSON_RULES}
Schema: {"en":string,"ar":string}`,
  user: (i: TranslateNameInput) => `Subject name: ${i.text}`,
  mock: (i: TranslateNameInput) => ({ en: i.text, ar: i.text }),
});
