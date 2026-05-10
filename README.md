# Sol Splitter (Anchor)

A Solana program built with Anchor that splits an incoming SOL payment across multiple recipients based on percentage shares.

## What This Program Does

The program exposes one instruction:

- `split_payment(amount, recipients, shares)`

It transfers `amount` lamports from a payer to a dynamic list of recipient wallets.
Each recipient receives a share based on the matching percentage entry in `shares`.

Validation rules:

- `recipients` cannot be empty.
- `recipients.len()` must equal `shares.len()`.
- Recipient account infos passed via `remaining_accounts` must match `recipients` in order.
- Total of all `shares` must equal exactly `100`.

If any rule fails, the transaction aborts.

## Account Structure

The instruction uses the following explicit accounts:

- `payer` (`Signer`, mutable): wallet paying the SOL.
- `system_program` (`Program<System>`): required for SOL transfer CPI.

Dynamic recipient accounts are supplied through `remaining_accounts`.

## Instruction Parameters

- `amount: u64`
  - Total lamports to split.
- `recipients: Vec<Pubkey>`
  - Recipient wallet addresses.
- `shares: Vec<u8>`
  - Percentage for each recipient; must total 100.

### Notes on Rounding

Integer division can produce remainders. This implementation sends any remainder to the last recipient so the full `amount` is always distributed.

## Error Cases

The program returns custom errors for:

- `NoRecipients`
- `RecipientsAndSharesLengthMismatch`
- `MissingRecipientAccounts`
- `SharesMustSumToOneHundred`
- `RecipientAccountMismatch`
- `MathOverflow`

## Project Layout

- `programs/sol_splitter/src/lib.rs`: on-chain Anchor program.
- `tests/sol-splitter.ts`: Anchor TypeScript tests.
- `Anchor.toml`: Anchor config.

## Test Coverage

The test suite includes:

- Successful 50/50 split.
- Successful uneven split (33/33/34) that still totals 100.
- Failing split where shares do not add up to 100.

## Run Locally (Localnet)

### 1) Prerequisites

Install:

- Rust + Cargo
- Solana CLI
- Anchor CLI
- Node.js + Yarn (or npm)

### 2) Install JS dependencies

```bash
yarn install
```

### 3) Start local validator (optional if `anchor test` manages it)

```bash
solana-test-validator
```

### 4) Run tests

```bash
anchor test
```

Anchor builds and deploys the program to localnet, then runs the TypeScript tests.
