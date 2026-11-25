/** Cho test quyết định lúc request đang chờ nhận được phản hồi. */
export function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
