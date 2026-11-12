const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })

/** Tiền là số nguyên VND (contract). 1500000 → "1.500.000 ₫" */
export function formatVnd(amount: number): string {
  return vnd.format(amount)
}
