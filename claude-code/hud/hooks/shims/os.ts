// `node:os`, from facts the mod reads once per session (see register.tsx).
export const sysinfo = { totalmem: 0, freemem: 0, platform: 'darwin', home: '/', tmpdir: '/tmp', hostname: '' }

export function homedir(): string {
  return sysinfo.home
}

export function totalmem(): number {
  return sysinfo.totalmem
}

export function freemem(): number {
  return sysinfo.freemem
}

export function platform(): string {
  return sysinfo.platform
}

export function tmpdir(): string {
  return sysinfo.tmpdir
}

export function hostname(): string {
  return sysinfo.hostname
}

export const EOL = '\n'

export default { homedir, totalmem, freemem, platform, tmpdir, hostname, EOL }
