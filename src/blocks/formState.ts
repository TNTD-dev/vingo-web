import type { FormField } from './adminPayloads'

/** Giá trị form theo `key`. */
export type FormValues = Record<string, string>

export const initialValues = (fields: FormField[]): FormValues =>
  Object.fromEntries(fields.map((f) => [f.key, f.value]))

/** Ô còn nguyên giá trị Vingo điền (viền lime). Admin sửa là thành ô của admin. */
export function isAgentFilled(field: FormField, values: FormValues): boolean {
  return field.byAgent && (values[field.key] ?? '') === field.value
}

/** Các ô admin đã sửa so với bản Vingo điền. */
export function editedFields(fields: FormField[], values: FormValues): FormValues {
  return Object.fromEntries(
    fields.filter((f) => (values[f.key] ?? '') !== f.value).map((f) => [f.key, values[f.key] ?? '']),
  )
}

export const hasEdits = (fields: FormField[], values: FormValues) =>
  Object.keys(editedFields(fields, values)).length > 0

/** Form chỉ gửi đi được khi mọi ô đều có giá trị. */
export const isComplete = (values: FormValues) => Object.values(values).every((v) => v.trim() !== '')
