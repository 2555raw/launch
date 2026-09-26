/* Everything a fork would rename lives here. */

export const SITE = {
  name: 'Downpour',
  tagline: 'Make it rain in any currency.',
  footerLine: 'Coins that fall in the money you already use.',
  /** The platform's own token, shown in the bar under the nav. Leave `address`
   *  empty until it exists and the bar says so instead of showing a fake CA. */
  token: {
    symbol: '$POUR',
    address: '' as string,
    chainLabel: 'Robinhood Chain',
    chainId: 4663,
    explorer: 'https://explorer.chain.robinhood.com',
  },
  links: {
    x: '',
    telegram: '',
    github: '',
  },
} as const;

export type Mode = 'live' | 'playground';

/** Which mode the site opens in when a visitor has not picked one:
 *  'auto' = live if the default chain has a deployment, playground otherwise. */
export const DEFAULT_MODE: Mode | 'auto' = (import.meta.env.VITE_DEFAULT_MODE as Mode | 'auto') || 'auto';
