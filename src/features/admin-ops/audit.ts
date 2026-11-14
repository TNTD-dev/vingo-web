/** Keep credentials and personal data out of audit previews and downloaded exports. */
export function safeAuditJson(value: unknown): string {
  return JSON.stringify(
    value ?? {},
    (key, v: unknown) =>
      /token|password|secret|authorization|email|phone|payload|idempotency/i.test(key) ? '[đã ẩn]' : v,
    2,
  )
}
