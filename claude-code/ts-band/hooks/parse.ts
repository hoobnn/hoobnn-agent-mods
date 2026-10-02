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
