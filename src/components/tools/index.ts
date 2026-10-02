/** Maps tool ids (src/config/site.ts) to their components. */
import type { ToolId } from '../../config/site';
import Assistant from './Assistant.astro';
import Borgmatic from './Borgmatic.astro';
import ComposeExplainer from './ComposeExplainer.astro';
import DocsExport from './DocsExport.astro';
import PasswordHash from './PasswordHash.astro';
import PowerCalculator from './PowerCalculator.astro';
import ProxyConfig from './ProxyConfig.astro';
import SecurityCheck from './SecurityCheck.astro';
import ServerSetup from './ServerSetup.astro';
import StackBuilder from './StackBuilder.astro';

export const toolComponents = {
  assistant: Assistant,
  'server-setup': ServerSetup,
  'stack-builder': StackBuilder,
  'compose-explainer': ComposeExplainer,
  'proxy-config': ProxyConfig,
  'password-hash': PasswordHash,
  borgmatic: Borgmatic,
  'docs-export': DocsExport,
  'security-check': SecurityCheck,
  'power-calculator': PowerCalculator,
} satisfies Record<ToolId, unknown>;

/** Tools that don't use "Mein Setup" values hide the setup bar */
export const noSetupBar: ToolId[] = ['compose-explainer', 'password-hash', 'power-calculator', 'security-check'];
