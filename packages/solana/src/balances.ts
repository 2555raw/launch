import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

export interface TokenBalance {
  mint: string;
  amount: string;
  decimals: number;
  uiAmount: number;
  tokenProgram: string;
}

export async function getWalletBalances(connection: Connection, owner: string): Promise<{ sol: number; lamports: number; tokens: TokenBalance[] }> {
  const pk = new PublicKey(owner);
  const [lamports, legacy, t22] = await Promise.all([
    connection.getBalance(pk, 'confirmed'),
    connection.getParsedTokenAccountsByOwner(pk, { programId: TOKEN_PROGRAM_ID }, 'confirmed'),
    connection.getParsedTokenAccountsByOwner(pk, { programId: TOKEN_2022_PROGRAM_ID }, 'confirmed'),
  ]);
  const tokens: TokenBalance[] = [];
  for (const [list, program] of [
    [legacy.value, TOKEN_PROGRAM_ID.toBase58()],
    [t22.value, TOKEN_2022_PROGRAM_ID.toBase58()],
  ] as const) {
    for (const acc of list) {
      const parsed = (acc.account.data as { parsed: { info: { mint: string; tokenAmount: { amount: string; decimals: number; uiAmount: number | null } } } }).parsed;
      const ta = parsed.info.tokenAmount;
      if (ta.amount === '0') continue;
      tokens.push({ mint: parsed.info.mint, amount: ta.amount, decimals: ta.decimals, uiAmount: ta.uiAmount ?? 0, tokenProgram: program });
    }
  }
  return { sol: lamports / LAMPORTS_PER_SOL, lamports, tokens };
}
