---
description: "Web interface for containers, stacks, volumes and networks."
notes:
  - "On first access, Portainer asks for a setup token. Find it with docker logs portainer 2>&1 | grep setup_token. Create the admin account within 5 minutes of starting, or Portainer locks itself and you have to restart the container."
  - "Portainer has full access to the Docker socket. Never expose it to the internet unprotected."
  - "The lts tag only gets stable releases with long-term support. If you always want the newest features, use sts."
---
