import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";

describe("sol-splitter", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolSplitter as Program;

  const createRecipients = (count: number): anchor.web3.Keypair[] =>
    Array.from({ length: count }, () => anchor.web3.Keypair.generate());

  const getBalances = async (pubkeys: anchor.web3.PublicKey[]): Promise<number[]> => {
    return Promise.all(pubkeys.map((pubkey) => provider.connection.getBalance(pubkey)));
  };

  it("splits a payment evenly when shares total 100", async () => {
    const recipients = createRecipients(2);
    const recipientKeys = recipients.map((kp) => kp.publicKey);
    const shares = [50, 50];
    const amount = new anchor.BN(1_000_000);

    const beforeBalances = await getBalances(recipientKeys);

    await program.methods
      .splitPayment(amount, recipientKeys, shares)
      .accounts({
        payer: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .remainingAccounts(
        recipientKeys.map((pubkey) => ({
          pubkey,
          isWritable: true,
          isSigner: false,
        }))
      )
      .rpc();

    const afterBalances = await getBalances(recipientKeys);

    assert.strictEqual(afterBalances[0] - beforeBalances[0], 500_000);
    assert.strictEqual(afterBalances[1] - beforeBalances[1], 500_000);
  });

  it("handles uneven splits that still total 100", async () => {
    const recipients = createRecipients(3);
    const recipientKeys = recipients.map((kp) => kp.publicKey);
    const shares = [33, 33, 34];
    const amountLamports = 1_000_003;
    const amount = new anchor.BN(amountLamports);

    const beforeBalances = await getBalances(recipientKeys);

    await program.methods
      .splitPayment(amount, recipientKeys, shares)
      .accounts({
        payer: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .remainingAccounts(
        recipientKeys.map((pubkey) => ({
          pubkey,
          isWritable: true,
          isSigner: false,
        }))
      )
      .rpc();

    const afterBalances = await getBalances(recipientKeys);

    const expectedFirst = Math.floor((amountLamports * shares[0]) / 100);
    const expectedSecond = Math.floor((amountLamports * shares[1]) / 100);
    const expectedThird = amountLamports - expectedFirst - expectedSecond;

    assert.strictEqual(afterBalances[0] - beforeBalances[0], expectedFirst);
    assert.strictEqual(afterBalances[1] - beforeBalances[1], expectedSecond);
    assert.strictEqual(afterBalances[2] - beforeBalances[2], expectedThird);
  });

  it("fails when shares do not add up to 100", async () => {
    const recipients = createRecipients(2);
    const recipientKeys = recipients.map((kp) => kp.publicKey);
    const shares = [60, 30]; // totals 90
    const amount = new anchor.BN(500_000);

    try {
      await program.methods
        .splitPayment(amount, recipientKeys, shares)
        .accounts({
          payer: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .remainingAccounts(
          recipientKeys.map((pubkey) => ({
            pubkey,
            isWritable: true,
            isSigner: false,
          }))
        )
        .rpc();

      assert.fail("Transaction should have failed because shares do not total 100");
    } catch (error) {
      const message = `${error}`;
      assert.include(message, "Shares must sum to 100");
    }
  });
});