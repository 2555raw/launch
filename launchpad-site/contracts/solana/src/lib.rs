//! Sol Bite: a launchpad where every coin is paired with a tokenized
//! restaurant stock. The raise is paid in that stock token (or in SOL), the
//! program holds the funds until the raise closes, and then either graduates
//! the coin into a built-in constant-product pool (liquidity locked forever,
//! no LP tokens exist) or refunds everyone.
//!
//! Rules, fixed for every coin:
//!   supply 1,000,000,000 (6 decimals) · minimum to graduate = target / 3 ·
//!   cap per wallet = target / 10 · everyone pays the same rate ·
//!   at graduation 99 % of the raise + 20 % of the supply seed the pool,
//!   1 % of the raise is the platform fee, buyers claim the other 80 % ·
//!   below the minimum every buyer gets 100 % back.
//!
//! Accounts (all PDAs of this program):
//!   Config   ["config"]              admin, fee_to
//!   Raise    ["raise", coin_mint]    one per coin, holds SOL raises as lamports
//!   Paid     ["paid", raise, buyer]  what a wallet paid, claimed flag
//! Token vaults are associated token accounts owned by the Raise PDA.
//! UNAUDITED. Test on devnet first.
#![allow(clippy::too_many_arguments)]
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    clock::Clock,
    entrypoint,
    entrypoint::ProgramResult,
    instruction::{AccountMeta, Instruction},
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction, system_program,
    sysvar::Sysvar,
};

solana_program::declare_id!("GuN42keYrbBSgthwZJgw8oEEc4QCzzCnaSQdsQZut2Ub");

pub const SUPPLY: u64 = 1_000_000_000 * 1_000_000; // 1e9 coins, 6 decimals
pub const COIN_DECIMALS: u8 = 6;
pub const POOL_BPS: u64 = 2000; // 20 % of supply to the pool
pub const FEE_BPS: u64 = 100; // 1 % of the raise to the platform
pub const SWAP_FEE_BPS: u64 = 100; // 1 % per swap, stays in the pool
pub const MAX_DURATION: i64 = 30 * 86400;
#[cfg(not(feature = "fast"))]
pub const MIN_DURATION: i64 = 3600;
#[cfg(feature = "fast")]
pub const MIN_DURATION: i64 = 3; // test builds only: lets the deadline path run in seconds

pub const SPL_TOKEN: Pubkey = solana_program::pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
pub const SPL_TOKEN_2022: Pubkey = solana_program::pubkey!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
pub const ATA_PROGRAM: Pubkey = solana_program::pubkey!("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

pub const CONFIG_LEN: usize = 1 + 32 + 32 + 1;
pub const RAISE_LEN: usize = 1 + 1 + 32 + 32 + 32 + 1 + 1 + 32 + 8 + 24 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 4 + 8 + 8 + 8;
pub const PAID_LEN: usize = 1 + 8 + 1 + 1;

/// Discriminators: first byte of every account owned by the program.
pub const TAG_CONFIG: u8 = 1;
pub const TAG_RAISE: u8 = 2;
pub const TAG_PAID: u8 = 3;

#[derive(Clone, Copy, Debug)]
pub struct Config {
    pub admin: Pubkey,
    pub fee_to: Pubkey,
    pub bump: u8,
}

#[derive(Clone, Debug)]
pub struct Raise {
    pub bump: u8,
    pub creator: Pubkey,
    pub coin_mint: Pubkey,
    pub pay_mint: Pubkey, // Pubkey::default() means SOL
    pub pay_decimals: u8,
    pub pay_token_program_is_2022: bool,
    pub name: [u8; 32],
    pub symbol: [u8; 8],
    pub restaurant: [u8; 24],
    pub target: u64,
    pub raised: u64,
    pub min: u64,
    pub cap: u64,
    pub open_at: i64,
    pub close_at: i64,
    pub closed_at: i64,
    pub finalized: bool,
    pub graduated: bool,
    pub buyers: u32,
    pub pool_coin: u64,
    pub pool_pay: u64,
    pub claimed_total: u64,
}

#[derive(Clone, Copy, Debug)]
pub struct Paid {
    pub amount: u64,
    pub claimed: bool,
    pub bump: u8,
}

fn rd_u64(d: &[u8], o: usize) -> Result<u64, ProgramError> { d.get(o..o + 8).map(|b| u64::from_le_bytes(b.try_into().unwrap())).ok_or(ProgramError::InvalidAccountData) }
fn rd_i64(d: &[u8], o: usize) -> Result<i64, ProgramError> { d.get(o..o + 8).map(|b| i64::from_le_bytes(b.try_into().unwrap())).ok_or(ProgramError::InvalidAccountData) }
fn rd_u32(d: &[u8], o: usize) -> Result<u32, ProgramError> { d.get(o..o + 4).map(|b| u32::from_le_bytes(b.try_into().unwrap())).ok_or(ProgramError::InvalidAccountData) }
fn rd_pk(d: &[u8], o: usize) -> Result<Pubkey, ProgramError> { d.get(o..o + 32).map(|b| Pubkey::new_from_array(b.try_into().unwrap())).ok_or(ProgramError::InvalidAccountData) }

impl Config {
    pub fn unpack(d: &[u8]) -> Result<Config, ProgramError> {
        if d.len() < CONFIG_LEN || d[0] != TAG_CONFIG { return Err(ProgramError::InvalidAccountData); }
        Ok(Config { admin: rd_pk(d, 1)?, fee_to: rd_pk(d, 33)?, bump: d[65] })
    }
    pub fn pack(&self, d: &mut [u8]) { d[0] = TAG_CONFIG; d[1..33].copy_from_slice(self.admin.as_ref()); d[33..65].copy_from_slice(self.fee_to.as_ref()); d[65] = self.bump; }
}

impl Raise {
    pub fn unpack(d: &[u8]) -> Result<Raise, ProgramError> {
        if d.len() < RAISE_LEN || d[0] != TAG_RAISE { return Err(ProgramError::InvalidAccountData); }
        let mut o = 1;
        let bump = d[o]; o += 1;
        let creator = rd_pk(d, o)?; o += 32;
        let coin_mint = rd_pk(d, o)?; o += 32;
        let pay_mint = rd_pk(d, o)?; o += 32;
        let pay_decimals = d[o]; o += 1;
        let pay_token_program_is_2022 = d[o] == 1; o += 1;
        let mut name = [0u8; 32]; name.copy_from_slice(&d[o..o + 32]); o += 32;
        let mut symbol = [0u8; 8]; symbol.copy_from_slice(&d[o..o + 8]); o += 8;
        let mut restaurant = [0u8; 24]; restaurant.copy_from_slice(&d[o..o + 24]); o += 24;
        let target = rd_u64(d, o)?; o += 8;
        let raised = rd_u64(d, o)?; o += 8;
        let min = rd_u64(d, o)?; o += 8;
        let cap = rd_u64(d, o)?; o += 8;
        let open_at = rd_i64(d, o)?; o += 8;
        let close_at = rd_i64(d, o)?; o += 8;
        let closed_at = rd_i64(d, o)?; o += 8;
        let finalized = d[o] == 1; o += 1;
        let graduated = d[o] == 1; o += 1;
        let buyers = rd_u32(d, o)?; o += 4;
        let pool_coin = rd_u64(d, o)?; o += 8;
        let pool_pay = rd_u64(d, o)?; o += 8;
        let claimed_total = rd_u64(d, o)?;
        Ok(Raise { bump, creator, coin_mint, pay_mint, pay_decimals, pay_token_program_is_2022, name, symbol, restaurant, target, raised, min, cap, open_at, close_at, closed_at, finalized, graduated, buyers, pool_coin, pool_pay, claimed_total })
    }
    pub fn pack(&self, d: &mut [u8]) {
        let mut o = 0;
        d[o] = TAG_RAISE; o += 1;
        d[o] = self.bump; o += 1;
        d[o..o + 32].copy_from_slice(self.creator.as_ref()); o += 32;
        d[o..o + 32].copy_from_slice(self.coin_mint.as_ref()); o += 32;
        d[o..o + 32].copy_from_slice(self.pay_mint.as_ref()); o += 32;
        d[o] = self.pay_decimals; o += 1;
        d[o] = self.pay_token_program_is_2022 as u8; o += 1;
        d[o..o + 32].copy_from_slice(&self.name); o += 32;
        d[o..o + 8].copy_from_slice(&self.symbol); o += 8;
        d[o..o + 24].copy_from_slice(&self.restaurant); o += 24;
        for v in [self.target, self.raised, self.min, self.cap] { d[o..o + 8].copy_from_slice(&v.to_le_bytes()); o += 8; }
        for v in [self.open_at, self.close_at, self.closed_at] { d[o..o + 8].copy_from_slice(&v.to_le_bytes()); o += 8; }
        d[o] = self.finalized as u8; o += 1;
        d[o] = self.graduated as u8; o += 1;
        d[o..o + 4].copy_from_slice(&self.buyers.to_le_bytes()); o += 4;
        for v in [self.pool_coin, self.pool_pay, self.claimed_total] { d[o..o + 8].copy_from_slice(&v.to_le_bytes()); o += 8; }
    }
    pub fn pays_in_sol(&self) -> bool { self.pay_mint == Pubkey::default() }
    pub fn is_closed(&self, now: i64) -> bool { self.closed_at != 0 || now >= self.close_at }
}

impl Paid {
    pub fn unpack(d: &[u8]) -> Result<Paid, ProgramError> {
        if d.len() < PAID_LEN || d[0] != TAG_PAID { return Err(ProgramError::InvalidAccountData); }
        Ok(Paid { amount: rd_u64(d, 1)?, claimed: d[9] == 1, bump: d[10] })
    }
    pub fn pack(&self, d: &mut [u8]) { d[0] = TAG_PAID; d[1..9].copy_from_slice(&self.amount.to_le_bytes()); d[9] = self.claimed as u8; d[10] = self.bump; }
}

/// Instruction data: tag byte followed by little-endian fields.
///   0 InitConfig   { fee_to: Pubkey }
///   1 Create       { name[32], symbol[8], restaurant[24], target: u64, duration: i64 }
///   2 Buy          { amount: u64 }
///   3 Finalize
///   4 Claim
///   5 Refund
///   6 Swap         { amount_in: u64, min_out: u64, coin_to_pay: u8 }
///   7 SetFeeTo     { fee_to: Pubkey }  (admin)
#[derive(Debug)]
pub enum Ix {
    InitConfig { fee_to: Pubkey },
    Create { name: [u8; 32], symbol: [u8; 8], restaurant: [u8; 24], target: u64, duration: i64 },
    Buy { amount: u64 },
    Finalize,
    Claim,
    Refund,
    Swap { amount_in: u64, min_out: u64, coin_to_pay: bool },
    SetFeeTo { fee_to: Pubkey },
}

impl Ix {
    pub fn unpack(d: &[u8]) -> Result<Ix, ProgramError> {
        let (tag, rest) = d.split_first().ok_or(ProgramError::InvalidInstructionData)?;
        Ok(match tag {
            0 => Ix::InitConfig { fee_to: rd_pk(rest, 0)? },
            1 => {
                if rest.len() < 32 + 8 + 24 + 8 + 8 { return Err(ProgramError::InvalidInstructionData); }
                let mut name = [0u8; 32]; name.copy_from_slice(&rest[0..32]);
                let mut symbol = [0u8; 8]; symbol.copy_from_slice(&rest[32..40]);
                let mut restaurant = [0u8; 24]; restaurant.copy_from_slice(&rest[40..64]);
                Ix::Create { name, symbol, restaurant, target: rd_u64(rest, 64)?, duration: rd_i64(rest, 72)? }
            }
            2 => Ix::Buy { amount: rd_u64(rest, 0)? },
            3 => Ix::Finalize,
            4 => Ix::Claim,
            5 => Ix::Refund,
            6 => Ix::Swap { amount_in: rd_u64(rest, 0)?, min_out: rd_u64(rest, 8)?, coin_to_pay: rest.get(16).copied().unwrap_or(0) == 1 },
            7 => Ix::SetFeeTo { fee_to: rd_pk(rest, 0)? },
            _ => return Err(ProgramError::InvalidInstructionData),
        })
    }
}

entrypoint!(process);

pub fn process(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    match Ix::unpack(data)? {
        Ix::InitConfig { fee_to } => init_config(program_id, accounts, fee_to),
        Ix::SetFeeTo { fee_to } => set_fee_to(program_id, accounts, fee_to),
        Ix::Create { name, symbol, restaurant, target, duration } => create(program_id, accounts, name, symbol, restaurant, target, duration),
        Ix::Buy { amount } => buy(program_id, accounts, amount),
        Ix::Finalize => finalize(program_id, accounts),
        Ix::Claim => claim(program_id, accounts),
        Ix::Refund => refund(program_id, accounts),
        Ix::Swap { amount_in, min_out, coin_to_pay } => swap(program_id, accounts, amount_in, min_out, coin_to_pay),
    }
}

/* ---------- helpers ---------- */

fn create_pda_account<'a>(payer: &AccountInfo<'a>, new: &AccountInfo<'a>, space: usize, owner: &Pubkey, seeds: &[&[u8]], system: &AccountInfo<'a>) -> ProgramResult {
    let rent = Rent::get()?.minimum_balance(space);
    invoke_signed(&system_instruction::create_account(payer.key, new.key, rent, space as u64, owner), &[payer.clone(), new.clone(), system.clone()], &[seeds])
}

fn token_transfer<'a>(token_program: &AccountInfo<'a>, from: &AccountInfo<'a>, mint: &AccountInfo<'a>, to: &AccountInfo<'a>, authority: &AccountInfo<'a>, amount: u64, decimals: u8, signer_seeds: Option<&[&[u8]]>) -> ProgramResult {
    // SPL Token / Token-2022 TransferChecked: tag 12, amount u64, decimals u8
    let mut data = Vec::with_capacity(10); data.push(12u8); data.extend_from_slice(&amount.to_le_bytes()); data.push(decimals);
    let ix = Instruction { program_id: *token_program.key, accounts: vec![AccountMeta::new(*from.key, false), AccountMeta::new_readonly(*mint.key, false), AccountMeta::new(*to.key, false), AccountMeta::new_readonly(*authority.key, true)], data };
    let infos = [from.clone(), mint.clone(), to.clone(), authority.clone(), token_program.clone()];
    match signer_seeds { Some(s) => invoke_signed(&ix, &infos, &[s]), None => invoke(&ix, &infos) }
}

fn create_ata<'a>(payer: &AccountInfo<'a>, ata: &AccountInfo<'a>, owner: &AccountInfo<'a>, mint: &AccountInfo<'a>, system: &AccountInfo<'a>, token_program: &AccountInfo<'a>, ata_program: &AccountInfo<'a>) -> ProgramResult {
    if ata_program.key != &ATA_PROGRAM { return Err(ProgramError::IncorrectProgramId); }
    let expected = Pubkey::find_program_address(&[owner.key.as_ref(), token_program.key.as_ref(), mint.key.as_ref()], &ATA_PROGRAM).0;
    if &expected != ata.key { msg!("wrong associated token account"); return Err(ProgramError::InvalidArgument); }
    if ata.data_len() > 0 { return Ok(()); }
    let ix = Instruction { program_id: ATA_PROGRAM, accounts: vec![AccountMeta::new(*payer.key, true), AccountMeta::new(*ata.key, false), AccountMeta::new_readonly(*owner.key, false), AccountMeta::new_readonly(*mint.key, false), AccountMeta::new_readonly(system_program::id(), false), AccountMeta::new_readonly(*token_program.key, false)], data: vec![1u8] }; // CreateIdempotent
    invoke(&ix, &[payer.clone(), ata.clone(), owner.clone(), mint.clone(), system.clone(), token_program.clone(), ata_program.clone()])
}

fn token_account_owner_and_mint(acc: &AccountInfo) -> Result<(Pubkey, Pubkey, u64), ProgramError> {
    let d = acc.try_borrow_data()?; if d.len() < 72 { return Err(ProgramError::InvalidAccountData); }
    Ok((rd_pk(&d, 32)?, rd_pk(&d, 0)?, rd_u64(&d, 64)?))
}

fn mint_decimals(mint: &AccountInfo) -> Result<u8, ProgramError> { let d = mint.try_borrow_data()?; d.get(44).copied().ok_or(ProgramError::InvalidAccountData) }

fn is_token_program(k: &Pubkey) -> bool { k == &SPL_TOKEN || k == &SPL_TOKEN_2022 }

fn mul_div(a: u64, b: u64, c: u64) -> Result<u64, ProgramError> { if c == 0 { return Err(ProgramError::ArithmeticOverflow); } let r = (a as u128) * (b as u128) / (c as u128); u64::try_from(r).map_err(|_| ProgramError::ArithmeticOverflow) }

fn pay_to<'a>(raise_acc: &AccountInfo<'a>, raise: &Raise, pay_vault: &AccountInfo<'a>, pay_mint: &AccountInfo<'a>, to: &AccountInfo<'a>, token_program: &AccountInfo<'a>, amount: u64, seeds: &[&[u8]]) -> ProgramResult {
    if amount == 0 { return Ok(()); }
    if raise.pays_in_sol() {
        // lamports held by the raise PDA; keep its rent
        let rent = Rent::get()?.minimum_balance(raise_acc.data_len());
        let have = raise_acc.lamports(); if have.saturating_sub(amount) < rent { msg!("vault short"); return Err(ProgramError::InsufficientFunds); }
        **raise_acc.try_borrow_mut_lamports()? -= amount; **to.try_borrow_mut_lamports()? += amount; Ok(())
    } else { token_transfer(token_program, pay_vault, pay_mint, to, raise_acc, amount, raise.pay_decimals, Some(seeds)) }
}

/* ---------- instructions ---------- */

fn init_config(program_id: &Pubkey, accounts: &[AccountInfo], fee_to: Pubkey) -> ProgramResult {
    let it = &mut accounts.iter(); let admin = next_account_info(it)?; let config = next_account_info(it)?; let system = next_account_info(it)?;
    if !admin.is_signer { return Err(ProgramError::MissingRequiredSignature); }
    let (pda, bump) = Pubkey::find_program_address(&[b"config"], program_id); if &pda != config.key { return Err(ProgramError::InvalidSeeds); }
    if config.data_len() > 0 { msg!("config exists"); return Err(ProgramError::AccountAlreadyInitialized); }
    create_pda_account(admin, config, CONFIG_LEN, program_id, &[b"config", &[bump]], system)?;
    Config { admin: *admin.key, fee_to, bump }.pack(&mut config.try_borrow_mut_data()?); Ok(())
}

fn set_fee_to(program_id: &Pubkey, accounts: &[AccountInfo], fee_to: Pubkey) -> ProgramResult {
    let it = &mut accounts.iter(); let admin = next_account_info(it)?; let config = next_account_info(it)?;
    if !admin.is_signer || config.owner != program_id { return Err(ProgramError::MissingRequiredSignature); }
    let mut c = Config::unpack(&config.try_borrow_data()?)?; if &c.admin != admin.key { return Err(ProgramError::IllegalOwner); }
    c.fee_to = fee_to; c.pack(&mut config.try_borrow_mut_data()?); Ok(())
}

/// accounts: creator(s,w), raise(w), coin_mint(s,w), coin_vault(w), pay_mint (or system program id for SOL), pay_vault(w) (or any for SOL), pay_token_program, coin_token_program (SPL Token), ata_program, system, rent
fn create(program_id: &Pubkey, accounts: &[AccountInfo], name: [u8; 32], symbol: [u8; 8], restaurant: [u8; 24], target: u64, duration: i64) -> ProgramResult {
    let it = &mut accounts.iter();
    let creator = next_account_info(it)?; let raise_acc = next_account_info(it)?; let coin_mint = next_account_info(it)?; let coin_vault = next_account_info(it)?;
    let pay_mint = next_account_info(it)?; let pay_vault = next_account_info(it)?; let pay_token_program = next_account_info(it)?; let coin_token_program = next_account_info(it)?;
    let ata_program = next_account_info(it)?; let system = next_account_info(it)?; let _rent = next_account_info(it)?;
    if !creator.is_signer || !coin_mint.is_signer { return Err(ProgramError::MissingRequiredSignature); }
    if coin_token_program.key != &SPL_TOKEN { return Err(ProgramError::IncorrectProgramId); }
    if target < 1000 { msg!("target too small"); return Err(ProgramError::InvalidArgument); }
    if !(MIN_DURATION..=MAX_DURATION).contains(&duration) { msg!("duration"); return Err(ProgramError::InvalidArgument); }
    if symbol.iter().take_while(|b| **b != 0).count() < 2 || name.iter().take_while(|b| **b != 0).count() < 2 { return Err(ProgramError::InvalidArgument); }
    let (pda, bump) = Pubkey::find_program_address(&[b"raise", coin_mint.key.as_ref()], program_id); if &pda != raise_acc.key { return Err(ProgramError::InvalidSeeds); }
    if raise_acc.data_len() > 0 { return Err(ProgramError::AccountAlreadyInitialized); }
    let seeds: &[&[u8]] = &[b"raise", coin_mint.key.as_ref(), &[bump]];
    let pays_in_sol = pay_mint.key == &system_program::id();
    let (pay_decimals, is_2022) = if pays_in_sol { (9u8, false) } else {
        if !is_token_program(pay_token_program.key) || pay_mint.owner != pay_token_program.key { msg!("pay mint / program mismatch"); return Err(ProgramError::IncorrectProgramId); }
        (mint_decimals(pay_mint)?, pay_token_program.key == &SPL_TOKEN_2022)
    };
    // the raise state account
    create_pda_account(creator, raise_acc, RAISE_LEN, program_id, seeds, system)?;
    // the coin mint: 82 bytes, authority = raise PDA
    let mint_rent = Rent::get()?.minimum_balance(82);
    invoke(&system_instruction::create_account(creator.key, coin_mint.key, mint_rent, 82, &SPL_TOKEN), &[creator.clone(), coin_mint.clone(), system.clone()])?;
    let mut d = vec![20u8, COIN_DECIMALS]; d.extend_from_slice(raise_acc.key.as_ref()); d.push(0); // InitializeMint2: decimals, mint_authority, no freeze authority
    invoke(&Instruction { program_id: SPL_TOKEN, accounts: vec![AccountMeta::new(*coin_mint.key, false)], data: d }, &[coin_mint.clone(), coin_token_program.clone()])?;
    // the coin vault (ATA of the raise PDA) and the whole supply into it
    create_ata(creator, coin_vault, raise_acc, coin_mint, system, coin_token_program, ata_program)?;
    let mut md = vec![7u8]; md.extend_from_slice(&SUPPLY.to_le_bytes());
    invoke_signed(&Instruction { program_id: SPL_TOKEN, accounts: vec![AccountMeta::new(*coin_mint.key, false), AccountMeta::new(*coin_vault.key, false), AccountMeta::new_readonly(*raise_acc.key, true)], data: md }, &[coin_mint.clone(), coin_vault.clone(), raise_acc.clone(), coin_token_program.clone()], &[seeds])?;
    // the pay vault for SPL raises
    if !pays_in_sol { create_ata(creator, pay_vault, raise_acc, pay_mint, system, pay_token_program, ata_program)?; }
    let now = Clock::get()?.unix_timestamp;
    let r = Raise { bump, creator: *creator.key, coin_mint: *coin_mint.key, pay_mint: if pays_in_sol { Pubkey::default() } else { *pay_mint.key }, pay_decimals, pay_token_program_is_2022: is_2022, name, symbol, restaurant, target, raised: 0, min: target / 3, cap: target / 10, open_at: now, close_at: now + duration, closed_at: 0, finalized: false, graduated: false, buyers: 0, pool_coin: 0, pool_pay: 0, claimed_total: 0 };
    r.pack(&mut raise_acc.try_borrow_mut_data()?);
    msg!("created {} target {}", String::from_utf8_lossy(&symbol), target); Ok(())
}

/// accounts: buyer(s,w), raise(w), paid(w), buyer_pay_ata(w) (any for SOL), pay_vault(w) (any for SOL), pay_mint, pay_token_program, system
fn buy(program_id: &Pubkey, accounts: &[AccountInfo], amount: u64) -> ProgramResult {
    let it = &mut accounts.iter();
    let buyer = next_account_info(it)?; let raise_acc = next_account_info(it)?; let paid_acc = next_account_info(it)?; let buyer_pay = next_account_info(it)?; let pay_vault = next_account_info(it)?; let pay_mint = next_account_info(it)?; let pay_token_program = next_account_info(it)?; let system = next_account_info(it)?;
    if !buyer.is_signer { return Err(ProgramError::MissingRequiredSignature); }
    if raise_acc.owner != program_id { return Err(ProgramError::IllegalOwner); }
    let mut r = Raise::unpack(&raise_acc.try_borrow_data()?)?;
    let now = Clock::get()?.unix_timestamp;
    if r.is_closed(now) || r.finalized { msg!("closed"); return Err(ProgramError::InvalidArgument); }
    let (paid_pda, pbump) = Pubkey::find_program_address(&[b"paid", raise_acc.key.as_ref(), buyer.key.as_ref()], program_id); if &paid_pda != paid_acc.key { return Err(ProgramError::InvalidSeeds); }
    let mut paid = if paid_acc.data_len() == 0 { create_pda_account(buyer, paid_acc, PAID_LEN, program_id, &[b"paid", raise_acc.key.as_ref(), buyer.key.as_ref(), &[pbump]], system)?; r.buyers += 1; Paid { amount: 0, claimed: false, bump: pbump } } else { Paid::unpack(&paid_acc.try_borrow_data()?)? };
    let room = r.target.saturating_sub(r.raised); let left = r.cap.saturating_sub(paid.amount);
    let take = amount.min(room).min(left);
    if take == 0 { msg!("cap or target reached"); return Err(ProgramError::InvalidArgument); }
    if r.pays_in_sol() {
        invoke(&system_instruction::transfer(buyer.key, raise_acc.key, take), &[buyer.clone(), raise_acc.clone(), system.clone()])?;
    } else {
        if pay_mint.key != &r.pay_mint { return Err(ProgramError::InvalidArgument); }
        let (vo, vm, _) = token_account_owner_and_mint(pay_vault)?; if vo != *raise_acc.key || vm != r.pay_mint { msg!("bad pay vault"); return Err(ProgramError::InvalidArgument); }
        token_transfer(pay_token_program, buyer_pay, pay_mint, pay_vault, buyer, take, r.pay_decimals, None)?;
    }
    paid.amount += take; r.raised += take;
    if r.raised >= r.target { r.closed_at = now; }
    paid.pack(&mut paid_acc.try_borrow_mut_data()?); r.pack(&mut raise_acc.try_borrow_mut_data()?);
    msg!("bought {} total {}", take, r.raised); Ok(())
}

/// accounts: anyone(s), raise(w), config, fee_to_destination(w) (fee_to ATA for SPL / fee_to for SOL), pay_vault(w), pay_mint, pay_token_program
fn finalize(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let it = &mut accounts.iter();
    let _who = next_account_info(it)?; let raise_acc = next_account_info(it)?; let config = next_account_info(it)?; let fee_dest = next_account_info(it)?; let pay_vault = next_account_info(it)?; let pay_mint = next_account_info(it)?; let pay_token_program = next_account_info(it)?;
    if raise_acc.owner != program_id || config.owner != program_id { return Err(ProgramError::IllegalOwner); }
    let mut r = Raise::unpack(&raise_acc.try_borrow_data()?)?; let c = Config::unpack(&config.try_borrow_data()?)?;
    let now = Clock::get()?.unix_timestamp;
    if !r.is_closed(now) { msg!("still open"); return Err(ProgramError::InvalidArgument); }
    if r.finalized { return Err(ProgramError::InvalidArgument); }
    if r.closed_at == 0 { r.closed_at = r.close_at; }
    r.finalized = true;
    if r.raised >= r.min {
        // fee destination must belong to fee_to
        if r.pays_in_sol() { if fee_dest.key != &c.fee_to { return Err(ProgramError::InvalidArgument); } } else { let (o, m, _) = token_account_owner_and_mint(fee_dest)?; if o != c.fee_to || m != r.pay_mint { msg!("fee destination"); return Err(ProgramError::InvalidArgument); } }
        let fee = mul_div(r.raised, FEE_BPS, 10_000)?;
        let seeds: &[&[u8]] = &[b"raise", r.coin_mint.as_ref(), &[r.bump]];
        pay_to(raise_acc, &r, pay_vault, pay_mint, fee_dest, pay_token_program, fee, seeds)?;
        r.graduated = true; r.pool_pay = r.raised - fee; r.pool_coin = mul_div(SUPPLY, POOL_BPS, 10_000)?;
        msg!("graduated: pool {} coin / {} pay", r.pool_coin, r.pool_pay);
    } else { msg!("below minimum: refunds open"); }
    r.pack(&mut raise_acc.try_borrow_mut_data()?); Ok(())
}

/// accounts: buyer(s,w), raise(w), paid(w), coin_vault(w), buyer_coin_ata(w), coin_mint, coin_token_program, ata_program, system
fn claim(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let it = &mut accounts.iter();
    let buyer = next_account_info(it)?; let raise_acc = next_account_info(it)?; let paid_acc = next_account_info(it)?; let coin_vault = next_account_info(it)?; let buyer_coin = next_account_info(it)?; let coin_mint = next_account_info(it)?; let coin_token_program = next_account_info(it)?; let ata_program = next_account_info(it)?; let system = next_account_info(it)?;
    if !buyer.is_signer { return Err(ProgramError::MissingRequiredSignature); }
    if raise_acc.owner != program_id || paid_acc.owner != program_id { return Err(ProgramError::IllegalOwner); }
    let mut r = Raise::unpack(&raise_acc.try_borrow_data()?)?; let mut p = Paid::unpack(&paid_acc.try_borrow_data()?)?;
    let (paid_pda, _) = Pubkey::find_program_address(&[b"paid", raise_acc.key.as_ref(), buyer.key.as_ref()], program_id); if &paid_pda != paid_acc.key { return Err(ProgramError::InvalidSeeds); }
    if !r.graduated || p.claimed || p.amount == 0 || coin_mint.key != &r.coin_mint { msg!("nothing to claim"); return Err(ProgramError::InvalidArgument); }
    let buyers_share = SUPPLY - mul_div(SUPPLY, POOL_BPS, 10_000)?;
    let tokens = mul_div(buyers_share, p.amount, r.raised)?;
    create_ata(buyer, buyer_coin, buyer, coin_mint, system, coin_token_program, ata_program)?;
    let seeds: &[&[u8]] = &[b"raise", r.coin_mint.as_ref(), &[r.bump]];
    token_transfer(coin_token_program, coin_vault, coin_mint, buyer_coin, raise_acc, tokens, COIN_DECIMALS, Some(seeds))?;
    p.claimed = true; r.claimed_total += tokens;
    p.pack(&mut paid_acc.try_borrow_mut_data()?); r.pack(&mut raise_acc.try_borrow_mut_data()?);
    msg!("claimed {}", tokens); Ok(())
}

/// accounts: buyer(s,w), raise(w), paid(w), buyer_pay_ata(w) (any for SOL), pay_vault(w), pay_mint, pay_token_program
fn refund(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let it = &mut accounts.iter();
    let buyer = next_account_info(it)?; let raise_acc = next_account_info(it)?; let paid_acc = next_account_info(it)?; let buyer_pay = next_account_info(it)?; let pay_vault = next_account_info(it)?; let pay_mint = next_account_info(it)?; let pay_token_program = next_account_info(it)?;
    if !buyer.is_signer { return Err(ProgramError::MissingRequiredSignature); }
    if raise_acc.owner != program_id || paid_acc.owner != program_id { return Err(ProgramError::IllegalOwner); }
    let r = Raise::unpack(&raise_acc.try_borrow_data()?)?; let mut p = Paid::unpack(&paid_acc.try_borrow_data()?)?;
    let (paid_pda, _) = Pubkey::find_program_address(&[b"paid", raise_acc.key.as_ref(), buyer.key.as_ref()], program_id); if &paid_pda != paid_acc.key { return Err(ProgramError::InvalidSeeds); }
    if !r.finalized || r.graduated || p.amount == 0 { msg!("no refund"); return Err(ProgramError::InvalidArgument); }
    let amount = p.amount; p.amount = 0; p.pack(&mut paid_acc.try_borrow_mut_data()?);
    let seeds: &[&[u8]] = &[b"raise", r.coin_mint.as_ref(), &[r.bump]];
    let dest = if r.pays_in_sol() { buyer } else { buyer_pay };
    pay_to(raise_acc, &r, pay_vault, pay_mint, dest, pay_token_program, amount, seeds)?;
    msg!("refunded {}", amount); Ok(())
}

/// Built-in constant-product pool after graduation. 1 % fee stays in the pool. Liquidity can never be withdrawn.
/// accounts: trader(s,w), raise(w), coin_vault(w), trader_coin_ata(w), pay_vault(w) (any for SOL), trader_pay_ata(w) (any for SOL), coin_mint, pay_mint, coin_token_program, pay_token_program, ata_program, system
fn swap(program_id: &Pubkey, accounts: &[AccountInfo], amount_in: u64, min_out: u64, coin_to_pay: bool) -> ProgramResult {
    let it = &mut accounts.iter();
    let trader = next_account_info(it)?; let raise_acc = next_account_info(it)?; let coin_vault = next_account_info(it)?; let trader_coin = next_account_info(it)?; let pay_vault = next_account_info(it)?; let trader_pay = next_account_info(it)?; let coin_mint = next_account_info(it)?; let pay_mint = next_account_info(it)?; let coin_token_program = next_account_info(it)?; let pay_token_program = next_account_info(it)?; let ata_program = next_account_info(it)?; let system = next_account_info(it)?;
    if !trader.is_signer { return Err(ProgramError::MissingRequiredSignature); }
    if raise_acc.owner != program_id { return Err(ProgramError::IllegalOwner); }
    let mut r = Raise::unpack(&raise_acc.try_borrow_data()?)?;
    if !r.graduated || amount_in == 0 || coin_mint.key != &r.coin_mint { return Err(ProgramError::InvalidArgument); }
    let seeds: &[&[u8]] = &[b"raise", r.coin_mint.as_ref(), &[r.bump]];
    let fee_in = amount_in - mul_div(amount_in, SWAP_FEE_BPS, 10_000)?;
    if coin_to_pay {
        // sell coin for the pay token
        let out = mul_div(r.pool_pay, fee_in, r.pool_coin + fee_in)?;
        if out < min_out || out >= r.pool_pay { msg!("slippage"); return Err(ProgramError::InvalidArgument); }
        token_transfer(coin_token_program, trader_coin, coin_mint, coin_vault, trader, amount_in, COIN_DECIMALS, None)?;
        let dest = if r.pays_in_sol() { trader } else { trader_pay };
        pay_to(raise_acc, &r, pay_vault, pay_mint, dest, pay_token_program, out, seeds)?;
        r.pool_coin += amount_in; r.pool_pay -= out;
        msg!("sold {} for {}", amount_in, out);
    } else {
        // buy coin with the pay token
        let out = mul_div(r.pool_coin, fee_in, r.pool_pay + fee_in)?;
        if out < min_out || out >= r.pool_coin { msg!("slippage"); return Err(ProgramError::InvalidArgument); }
        if r.pays_in_sol() { invoke(&system_instruction::transfer(trader.key, raise_acc.key, amount_in), &[trader.clone(), raise_acc.clone(), system.clone()])?; }
        else { token_transfer(pay_token_program, trader_pay, pay_mint, pay_vault, trader, amount_in, r.pay_decimals, None)?; }
        create_ata(trader, trader_coin, trader, coin_mint, system, coin_token_program, ata_program)?;
        token_transfer(coin_token_program, coin_vault, coin_mint, trader_coin, raise_acc, out, COIN_DECIMALS, Some(seeds))?;
        r.pool_pay += amount_in; r.pool_coin -= out;
        msg!("bought {} for {}", out, amount_in);
    }
    r.pack(&mut raise_acc.try_borrow_mut_data()?); Ok(())
}
