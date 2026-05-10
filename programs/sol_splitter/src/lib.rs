use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, system_instruction};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkgSQ3B9r3TQ");

#[program]
pub mod sol_splitter {
    use super::*;

    /// Splits `amount` lamports from payer to recipients by percentage shares.
    ///
    /// Recipients are passed as both:
    /// 1) `recipients`: a vector of expected public keys
    /// 2) `remaining_accounts`: account infos in the same order as `recipients`
    ///
    /// This dual passing allows the instruction to handle a dynamic number of recipients
    /// while still enforcing strict key matching and share validation.
    pub fn split_payment(
        ctx: Context<SplitPayment>,
        amount: u64,
        recipients: Vec<Pubkey>,
        shares: Vec<u8>,
    ) -> Result<()> {
        require!(!recipients.is_empty(), SplitterError::NoRecipients);
        require!(
            recipients.len() == shares.len(),
            SplitterError::RecipientsAndSharesLengthMismatch
        );
        require!(
            recipients.len() == ctx.remaining_accounts.len(),
            SplitterError::MissingRecipientAccounts
        );

        let total_share: u16 = shares.iter().map(|&s| s as u16).sum();
        require!(
            total_share == 100,
            SplitterError::SharesMustSumToOneHundred
        );

        let payer = ctx.accounts.payer.to_account_info();
        let system_program = ctx.accounts.system_program.to_account_info();

        let mut distributed: u64 = 0;

        for (index, (recipient_key, share)) in recipients.iter().zip(shares.iter()).enumerate() {
            let recipient_info = &ctx.remaining_accounts[index];

            require_keys_eq!(
                *recipient_info.key,
                *recipient_key,
                SplitterError::RecipientAccountMismatch
            );

            // Keep integer math deterministic. Any remainder from division is
            // assigned to the last recipient so the full amount is distributed.
            let recipient_amount = if index == recipients.len() - 1 {
                amount
                    .checked_sub(distributed)
                    .ok_or(SplitterError::MathOverflow)?
            } else {
                amount
                    .checked_mul(*share as u64)
                    .ok_or(SplitterError::MathOverflow)?
                    .checked_div(100)
                    .ok_or(SplitterError::MathOverflow)?
            };

            distributed = distributed
                .checked_add(recipient_amount)
                .ok_or(SplitterError::MathOverflow)?;

            if recipient_amount > 0 {
                let transfer_ix = system_instruction::transfer(
                    payer.key,
                    recipient_info.key,
                    recipient_amount,
                );

                invoke(
                    &transfer_ix,
                    &[
                        payer.clone(),
                        recipient_info.clone(),
                        system_program.clone(),
                    ],
                )?;
            }
        }

        Ok(())
    }
}

#[derive(Accounts)]
pub struct SplitPayment<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum SplitterError {
    #[msg("At least one recipient is required")]
    NoRecipients,
    #[msg("Recipients and shares must have the same length")]
    RecipientsAndSharesLengthMismatch,
    #[msg("Missing recipient accounts in remaining accounts")]
    MissingRecipientAccounts,
    #[msg("Shares must sum to 100")]
    SharesMustSumToOneHundred,
    #[msg("Recipient account does not match provided recipient key")]
    RecipientAccountMismatch,
    #[msg("Math overflow while calculating split amounts")]
    MathOverflow,
}