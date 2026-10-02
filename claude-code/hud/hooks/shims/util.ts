// `node:util.promisify`, honouring `promisify.custom` the way Node does.
const custom = Symbol.for('nodejs.util.promisify.custom')

type Callback = (err: unknown, value?: unknown) => void

export function promisify<T extends (...args: never[]) => unknown>(fn: T): (...args: unknown[]) => Promise<any> {
  const own = (fn as unknown as Record<symbol, unknown>)[custom]
  if (typeof own === 'function') return own as (...args: unknown[]) => Promise<any>
  return (...args: unknown[]) =>
    new Promise((resolve, reject) => {
      const cb: Callback = (err, value) => (err ? reject(err) : resolve(value))
      ;(fn as unknown as (...a: unknown[]) => void)(...args, cb)
    })
}
promisify.custom = custom

export function format(...args: unknown[]): string {
  return args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')
}
