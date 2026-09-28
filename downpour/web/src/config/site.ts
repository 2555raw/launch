/* Everything a fork would rename lives here. */

export const SITE = {
  name: 'Starmint',
  tagline: 'Mint a star in any currency.',
  footerLine: 'Coins that shine in the money you already use.',
  /** The platform's own token. Leave `address` empty until it exists: the bar under
   *  the nav with its contract address only shows once it is set. */
  token: {
    symbol: '$SMNT',
    address: '' as string,
    chainLabel: 'Robinhood Chain',
    chainId: 4663,
    explorer: 'https://robinhoodchain.blockscout.com',
  },
  links: {
    x: 'https://x.com/useStarmint',
    telegram: '',
    github: '',
  },
  /** The logo row on the home page: the chain the token lives on and projects around it.
   *  The logos are in web/public/eco and belong to their owners; `tile` puts a logo on a
   *  rounded square of that colour. An empty list hides the row. */
  ecosystem: {
    title: 'The Robinhood Chain ecosystem',
    items: [
      { name: 'Robinhood Chain', logo: '/eco/robinhood-chain.svg' },
      { name: 'Chainlink', logo: '/eco/chainlink.svg' },
      { name: 'USDG', logo: '/eco/usdg.svg' },
      { name: 'Uniswap', logo: '/eco/uniswap.svg', tile: '#fdeefa' },
      { name: 'Pons', logo: '/eco/pons.png' },
    ],
  },
} as const;

export type Mode = 'live' | 'playground';

/** Which mode the site opens in when a visitor has not picked one:
 *  'auto' = live if the default chain has a deployment, playground otherwise. */
export const DEFAULT_MODE: Mode | 'auto' = (import.meta.env.VITE_DEFAULT_MODE as Mode | 'auto') || 'auto';
