import type { Link, Node } from '../types'

type Peer = {
  HostName?: string
  Online?: boolean
  CurAddr?: string
  PeerRelay?: string
  Relay?: string
}

export function parseStatus(json: string): Node[] {
  const status = JSON.parse(json) as { Peer?: Record<string, Peer> }
  const nodes = Object.values(status.Peer ?? {}).map(peer => {
    const isOnline = peer.Online === true
    let link: Link = 'offline'
    let via = ''
    if (isOnline && peer.CurAddr) {
      link = 'direct'
    } else if (isOnline && peer.PeerRelay) {
      link = 'peer-relay'
    } else if (isOnline) {
      link = 'derp'
      via = peer.Relay ?? ''
    }

    return { name: peer.HostName ?? '?', isOnline, link, via }
  })

  return nodes.sort((a, b) => a.name.localeCompare(b.name))
}

// `nodes` option ("nas=家里, dev-box") to the nodes shown, in its order and
// renamed; empty keeps every node. Host names match case-insensitively.
export function selectNodes(nodes: Node[], spec: string): Node[] {
  const picks = spec
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      const [host = '', label = ''] = item.split('=').map(s => s.trim())
      return { host: host.toLowerCase(), label: label || host }
    })
  if (picks.length === 0) {
    return nodes
  }
  return picks.flatMap(({ host, label }) => {
    const node = nodes.find(n => n.name.toLowerCase() === host)
    return node ? [{ ...node, name: label }] : []
  })
}
