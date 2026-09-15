/* Launching a coin, on Meteora's Dynamic Bonding Curve.
 *
 * A launchpad is not a contract we wrote. It is somebody else's audited
 * program plus a configuration that says what the curve looks like and who
 * gets the fees — and that is deliberate. Writing a fresh bonding curve that
 * holds strangers' money, unaudited, is the single most expensive mistake
 * available in this space. DBC is open source, it is what the launchpads you
 * have seen are built on, and its program id is read out of Meteora's own
 * published SDK rather than out of memory:
 *
 *   dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN
 *
 * Ward cannot load that SDK: the page runs under script-src 'self', so nothing
 * arrives from a CDN, and the SDK is a bundler's worth of dependencies anyway.
 * So the two instructions a launch actually needs are built here by hand, the
 * same way the SPL transfer was, and checked the same way — byte for byte
 * against the real SDK, offline, in test/dbc.js. Every PDA below is checked
 * against Meteora's own derive helpers too.
 *
 * What this file does NOT do, and cannot: create the config. That is a
 * one-time on-chain transaction that fixes the curve, the fees and the
 * migration target for every coin ever launched through Ward, it costs real
 * SOL, and it is the operator's decision rather than a default worth guessing.
 * WARD_DBC.config has to be set before any of this works. */

window.WARD_DBC = (function () {
  const SOL = window.WARD_SOL;
  const P = SOL.parts;
  const enc = new TextEncoder();

  const PROGRAM = SOL.b58decode('dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN');
  const METADATA_PROGRAM = SOL.b58decode('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
  /* Wrapped SOL. Every curve here is quoted in it, which is why a launch needs
     no quote token account of its own: the program owns the quote vault. */
  const WSOL = SOL.b58decode('So11111111111111111111111111111111111111112');

  /* Anchor names an instruction by the first eight bytes of the SHA-256 of
     "global:<name>". These are copied from the published IDL and then checked
     against that rule in the tests, so a typo cannot survive. */
  const DISC = {
    initialize: Uint8Array.of(140, 85, 215, 176, 102, 54, 104, 79),   // initialize_virtual_pool_with_spl_token
    swap:       Uint8Array.of(248, 198, 158, 145, 225, 117, 135, 200) // swap
  };

  /* ── addresses the program derives rather than stores ─────────────────── */

  const poolAuthority = () => P.findPda([enc.encode('pool_authority')], PROGRAM);
  const eventAuthority = () => P.findPda([enc.encode('__event_authority')], PROGRAM);

  /* The pool's address depends on the pair, and the two mints go in by value:
     the larger 32 bytes first. Not the order they were passed in — that would
     make the same pool derive two different addresses depending on who asked. */
  function poolAddress(configPub, baseMint, quoteMint) {
    const cmp = (() => {
      for (let i = 0; i < 32; i++) if (baseMint[i] !== quoteMint[i]) return baseMint[i] - quoteMint[i];
      return 0;
    })();
    const [hi, lo] = cmp > 0 ? [baseMint, quoteMint] : [quoteMint, baseMint];
    return P.findPda([enc.encode('pool'), configPub, hi, lo], PROGRAM);
  }

  const tokenVault = (poolPub, mintPub) =>
    P.findPda([enc.encode('token_vault'), mintPub, poolPub], PROGRAM);

  const mintMetadata = mintPub =>
    P.findPda([enc.encode('metadata'), METADATA_PROGRAM, mintPub], METADATA_PROGRAM);

  /* ── argument encoding ────────────────────────────────────────────────── */

  /* Borsh writes a string as a four-byte length and then the utf-8. The length
     counts bytes, not characters, which is the whole reason this is not
     s.length: a coin called "ライオン" is twelve bytes and four characters, and
     the program reads the number it is given. */
  function str(s) {
    const b = enc.encode(s);
    const out = new Uint8Array(4 + b.length);
    new DataView(out.buffer).setUint32(0, b.length, true);
    out.set(b, 4);
    return out;
  }

  const u64 = v => {
    const out = new Uint8Array(8);
    new DataView(out.buffer).setBigUint64(0, BigInt(v), true);
    return out;
  };

  /* ── the two instructions ─────────────────────────────────────────────── */

  /* Creating the coin. The mint is a signer here and it is brand new, which is
     why a launch carries two signatures: the program creates the mint account
     inside this instruction, so the key that will own it has to agree. */
  async function initializeIx(o) {
    const pool = (await poolAddress(o.config, o.baseMint, o.quoteMint)).address;
    const baseVault = (await tokenVault(pool, o.baseMint)).address;
    const quoteVault = (await tokenVault(pool, o.quoteMint)).address;
    const meta = (await mintMetadata(o.baseMint)).address;
    const evt = (await eventAuthority()).address;
    const auth = (await poolAuthority()).address;

    return {
      programId: PROGRAM,
      keys: [
        { key: o.config,            signer: false, writable: false },
        { key: auth,                signer: false, writable: false },
        { key: o.creator,           signer: true,  writable: false },
        { key: o.baseMint,          signer: true,  writable: true  },
        { key: o.quoteMint,         signer: false, writable: false },
        { key: pool,                signer: false, writable: true  },
        { key: baseVault,           signer: false, writable: true  },
        { key: quoteVault,          signer: false, writable: true  },
        { key: meta,                signer: false, writable: true  },
        { key: METADATA_PROGRAM,    signer: false, writable: false },
        { key: o.payer,             signer: true,  writable: true  },
        { key: P.TOKEN_PROGRAM,     signer: false, writable: false },
        { key: P.TOKEN_PROGRAM,     signer: false, writable: false },
        { key: P.SYSTEM_PROGRAM,    signer: false, writable: false },
        { key: evt,                 signer: false, writable: false },
        { key: PROGRAM,             signer: false, writable: false }
      ],
      data: P.cat(DISC.initialize, str(o.name), str(o.symbol), str(o.uri))
    };
  }

  /* Buying or selling against the curve. amountIn and minOut are both in the
     smallest unit; minOut is the slippage floor and passing zero means "any
     price at all", which is how people get sandwiched. */
  async function swapIx(o) {
    const pool = (await poolAddress(o.config, o.baseMint, o.quoteMint)).address;
    const baseVault = (await tokenVault(pool, o.baseMint)).address;
    const quoteVault = (await tokenVault(pool, o.quoteMint)).address;
    const evt = (await eventAuthority()).address;
    const auth = (await poolAuthority()).address;

    return {
      programId: PROGRAM,
      keys: [
        { key: auth,                signer: false, writable: false },
        { key: o.config,            signer: false, writable: false },
        { key: pool,                signer: false, writable: true  },
        { key: o.inputTokenAccount, signer: false, writable: true  },
        { key: o.outputTokenAccount,signer: false, writable: true  },
        { key: baseVault,           signer: false, writable: true  },
        { key: quoteVault,          signer: false, writable: true  },
        { key: o.baseMint,          signer: false, writable: false },
        { key: o.quoteMint,         signer: false, writable: false },
        { key: o.payer,             signer: true,  writable: false },
        { key: P.TOKEN_PROGRAM,     signer: false, writable: false },
        { key: P.TOKEN_PROGRAM,     signer: false, writable: false },
        /* The referral account is optional, and Anchor spells "absent" as the
           program's own id in a read-only slot — read-only even though the
           account is declared writable, because there is nothing there to
           write to. Marking it writable produces a different message and a
           rejected transaction; the tests caught exactly that. */
        o.referral ? { key: o.referral, signer: false, writable: true }
                   : { key: PROGRAM,    signer: false, writable: false },
        { key: evt,                 signer: false, writable: false },
        { key: PROGRAM,             signer: false, writable: false }
      ],
      data: P.cat(DISC.swap, u64(o.amountIn), u64(o.minOut))
    };
  }

  return {
    PROGRAM, WSOL, METADATA_PROGRAM, DISC,
    poolAuthority, eventAuthority, poolAddress, tokenVault, mintMetadata,
    initializeIx, swapIx,
    str, u64
  };
})();
