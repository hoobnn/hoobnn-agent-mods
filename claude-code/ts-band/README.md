# ts-band

A band above the prompt with each Tailscale node's state: online count, then one entry per node, green for a direct connection, yellow through a relay or DERP, red when offline. Reads `tailscale status --json` every minute and toasts when a node comes up or goes down. `/ts` hides or shows it.
