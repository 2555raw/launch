/* Provider registry. Adding a provider is one file plus one line here. */
import * as fmp from './fmp.js';
import * as finnhub from './finnhub.js';
import { config } from '../config.js';

export const PROVIDERS = { fmp, finnhub };
export const listProviders = () => Object.values(PROVIDERS).map(p => ({ id: p.id, label: p.label, site: p.site }));
export const provider = () => PROVIDERS[config.provider] || PROVIDERS.fmp;
