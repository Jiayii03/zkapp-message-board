import { Mina, PrivateKey, AccountUpdate, Field, SmartContract, method } from 'o1js';

// Initialize the local blockchain
const Local = Mina.LocalBlockchain({ proofsEnabled: false });
Mina.setActiveInstance(Local);

// Access a test account from LocalBlockchain's test accounts
const feePayer = Local.testAccounts[0].key;

// Define a sample contract (Add contract for demonstration)
class Add extends SmartContract {
  @method add(a: Field, b: Field) {
    return a.add(b);
  }
}

// Generate zkApp account and instance
const zkAppPrivateKey = PrivateKey.random();
const zkAppAddress = zkAppPrivateKey.toPublicKey();
const zkAppInstance = new Add(zkAppAddress);

// Deploy the contract
const txn = await Mina.transaction(feePayer, async () => {
  AccountUpdate.fundNewAccount(feePayer);
  zkAppInstance.deploy({ zkappKey: zkAppPrivateKey });
});

const txPromise = await txn.send();
await txPromise.wait();
console.log("Contract deployed to local blockchain at:", zkAppAddress.toBase58());

// Call a method on the deployed contract
const callTxn = await Mina.transaction(feePayer, async () => {
  zkAppInstance.add(Field(5), Field(10));
});

const callTxPromise = await callTxn.send();
await callTxPromise.wait();
console.log("Method called on the contract successfully.");
