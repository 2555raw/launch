/**
 * Simplified Chinese dictionary, keyed by the English source string.
 * Split by area so several people can extend it without conflicts; `ZH` merges everything.
 */
import { ZH_COMMON } from './zh/common';
import { ZH_GAME } from './zh/game';
import { ZH_SOCIAL } from './zh/social';
import { ZH_WEB3 } from './zh/web3';
import { ZH_ADMIN } from './zh/admin';

export const ZH: Record<string, string> = { ...ZH_COMMON, ...ZH_GAME, ...ZH_SOCIAL, ...ZH_WEB3, ...ZH_ADMIN };
