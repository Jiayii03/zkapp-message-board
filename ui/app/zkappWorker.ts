import {
  Field,
  Mina,
  PublicKey,
  PrivateKey,
  fetchAccount,
  Poseidon,
} from "o1js";
import * as Comlink from "comlink"; 
import type { Message } from "../../contracts/src/message";

type Transaction = Awaited<ReturnType<typeof Mina.transaction>>;

const state = {
  messageInstance: null as null | typeof Message,
  zkappInstance: null as null | Message,
  transaction: null as null | Transaction,
};

export const api = {
  async setActiveInstanceToDevnet() {
    const Network = Mina.Network(
      "https://api.minascan.io/node/devnet/v1/graphql"
    );
    console.log("Devnet network instance configured");
    Mina.setActiveInstance(Network);
  },

  async loadContract() {
    const { Message } = await import("../../contracts/build/src/message.js");
    state.messageInstance = Message;
  },

  async compileContract() {
    await state.messageInstance!.compile();
  },

  async fetchAccount(publicKey58: string) {
    const publicKey = PublicKey.fromBase58(publicKey58);
    return fetchAccount({ publicKey });
  },

  async initZkappInstance(publicKey58: string) {
    const publicKey = PublicKey.fromBase58(publicKey58);
    state.zkappInstance = new state.messageInstance!(publicKey);
  },

  async publishMessage(messageText: string, privateKey58: string) {
    console.log("Starting publishMessage in ZKAppWorker");

    // Convert message text to Field
    const messageField = Poseidon.hash(
      messageText.split("").map((char) => Field(char.charCodeAt(0)))
    );

    // Convert privateKey58 from string to PrivateKey instance
    const privateKey = PrivateKey.fromBase58(privateKey58);
    if (!(privateKey instanceof PrivateKey)) {
      console.error("Invalid private key");
      throw new Error("privateKey is not a valid PrivateKey instance.");
    }

    try {
      console.log("Starting Mina.transaction in ZKAppWorker");

      // Initialize the transaction to publish the message and ensure errors are caught
      
      state.transaction = await Mina.transaction(async () => {
        try {
          console.log("Calling publishMessage on zkAppInstance...");
          state.zkappInstance!.publishMessage(messageField, privateKey);
        } catch (innerError) {
          console.error("Error inside Mina.transaction callback:", innerError);
          throw innerError; // Re-throw to ensure it propagates
        }
      });

      console.log("Transaction completed successfully in ZKAppWorker");
    } catch (error) {
      console.error("Error in publishMessage in ZKAppWorker:", error);
      throw error; // Re-throw the error to propagate it back to the caller
    }
  },

  async getMessages() {
    if (!state.zkappInstance) {
      throw new Error(
        "zkappInstance has not been initialized. Call initZkappInstance first."
      );
    }
    const messages = await state.zkappInstance.message.get();
    return JSON.stringify(messages.toJSON());
  },

  async proveUpdateTransaction() {
    if (!state.transaction) {
      throw new Error(
        "Transaction has not been created. Call publishMessage first."
      );
    }
    try{
      console.log("Proving transaction:", state.transaction);
      await state.transaction.prove();
    } catch (error) {
      console.error("Error in proveUpdateTransaction in ZKAppWorker:", error);
      throw error; // Re-throw the error to propagate it back to the caller
    }
  },

  async getTransactionJSON() {
    if (!state.transaction) {
      throw new Error(
        "Transaction has not been created. Call publishMessage first."
      );
    }
    return state.transaction.toJSON();
  },
};

// Expose the API to be used by the main thread
Comlink.expose(api);
