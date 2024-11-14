"use client";
import { Field, PrivateKey, Poseidon } from "o1js";
import { useEffect, useState } from "react";
import GradientBG from "../components/GradientBG";
import styles from "../styles/Home.module.css";
// import './reactCOIServiceWorker';
import ZkappWorkerClient from "./zkappWorkerClient";

let transactionFee = 0.1;
const ZKAPP_ADDRESS = "B62qpiMCcXrFrG5pRNekmtFbEEjrv73HTboGyCyCxVhfqGQ9HfmsezZ";

export default function Home() {
  const [zkappWorkerClient, setZkappWorkerClient] =
    useState<null | ZkappWorkerClient>(null);
  const [hasWallet, setHasWallet] = useState<null | boolean>(null);
  const [hasBeenSetup, setHasBeenSetup] = useState(false);
  const [accountExists, setAccountExists] = useState(false);
  const [currentNum, setCurrentNum] = useState<null | Field>(null);
  const [publicKeyBase58, setPublicKeyBase58] = useState("");
  const [creatingTransaction, setCreatingTransaction] = useState(false);
  const [displayText, setDisplayText] = useState("");
  const [transactionlink, setTransactionLink] = useState("");
  const [messageInput, setMessageInput] = useState(""); // Temporary input as string
const [privateKeyInput, setPrivateKeyInput] = useState(""); // Temporary input as string

  const displayStep = (step: string) => {
    setDisplayText(step);
    console.log(step);
  };

  // -------------------------------------------------------
  // Do Setup

  useEffect(() => {
    const setup = async () => {
      try {
        if (!hasBeenSetup) {
          displayStep("Loading web worker...");
          const zkappWorkerClient = new ZkappWorkerClient();
          setZkappWorkerClient(zkappWorkerClient);
          await new Promise((resolve) => setTimeout(resolve, 5000));
          displayStep("Done loading web worker");

          await zkappWorkerClient.setActiveInstanceToDevnet();

          const mina = (window as any).mina;
          if (mina == null) {
            setHasWallet(false);
            displayStep("Wallet not found.");
            return;
          }

          const publicKeyBase58: string = (await mina.requestAccounts())[0];
          setPublicKeyBase58(publicKeyBase58);
          displayStep(`Using key:${publicKeyBase58}`);

          displayStep("Checking if fee payer account exists...");
          const res = await zkappWorkerClient.fetchAccount(publicKeyBase58);
          const accountExists = res.error === null;
          setAccountExists(accountExists);

          await zkappWorkerClient.loadContract();

          displayStep("Compiling zkApp...");
          await zkappWorkerClient.compileContract();
          displayStep("zkApp compiled");

          await zkappWorkerClient.initZkappInstance(ZKAPP_ADDRESS);

          displayStep("Getting zkApp state...");
          await zkappWorkerClient.fetchAccount(ZKAPP_ADDRESS);

          setHasBeenSetup(true);
          setHasWallet(true);
          setDisplayText("");
        }
      } catch (error: any) {
        displayStep(`Error during setup: ${error.message}`);
      }
    };

    setup();
  }, []);

  // -------------------------------------------------------
  // Wait for account to exist, if it didn't

  useEffect(() => {
    const checkAccountExists = async () => {
      if (hasBeenSetup && !accountExists) {
        try {
          for (;;) {
            displayStep("Checking if fee payer account exists...");

            const res = await zkappWorkerClient!.fetchAccount(publicKeyBase58);
            const accountExists = res.error == null;
            if (accountExists) {
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
        } catch (error: any) {
          displayStep(`Error checking account: ${error.message}`);
        }
      }
      setAccountExists(true);
    };

    checkAccountExists();
  }, [zkappWorkerClient, hasBeenSetup, accountExists]);

  // -------------------------------------------------------
  // Publish a message
  const onSubmitMessage = async () => {
    console.log("publicKeyBase58 sending to worker", publicKeyBase58);
    await zkappWorkerClient!.fetchAccount(publicKeyBase58);
  
    try {
      if (messageInput && privateKeyInput) {
        // Ensure messageInput is not null
        await zkappWorkerClient!.publishMessageClient(messageInput, privateKeyInput);
      } else {
        console.error("Message is null. Please enter a valid message.");
        displayStep("Message is null. Please enter a valid message.");
        return;
      }
  
      displayStep("Creating proof...");
      await zkappWorkerClient!.proveUpdateTransaction();
  
      displayStep("Requesting send transaction...");
      const transactionJSON = await zkappWorkerClient!.getTransactionJSON();
  
      displayStep("Getting transaction JSON...");
      const { hash } = await (window as any).mina.sendTransaction({
        transaction: transactionJSON,
        feePayer: {
          fee: transactionFee,
          memo: "",
        },
      });
  
      const transactionLink = `https://minascan.io/devnet/tx/${hash}`;
      setTransactionLink(transactionLink);
      setDisplayText(transactionLink);
  
    } catch (error: any) {
      // Display the error message from the contract on the frontend
      displayStep(`Transaction failed: ${error.message}`);
      console.error("Transaction failed:", error);
    } finally {
      setCreatingTransaction(false); // Ensure the transaction state is reset
    }
  };
  

  // -------------------------------------------------------
  // Create UI elements

  let auroLinkElem;
  if (hasWallet === false) {
    const auroLink = "https://www.aurowallet.com/";
    auroLinkElem = (
      <div>
        Could not find a wallet.{" "}
        <a href="https://www.aurowallet.com/" target="_blank" rel="noreferrer">
          Install Auro wallet here
        </a>
      </div>
    );
  }

  const stepDisplay = transactionlink ? (
    <a
      href={transactionlink}
      target="_blank"
      rel="noreferrer"
      style={{ textDecoration: "underline" }}
    >
      View transaction
    </a>
  ) : (
    displayText
  );

  let setup = (
    <div
      className={styles.start}
      style={{ fontWeight: "bold", fontSize: "1.5rem", paddingBottom: "5rem" }}
    >
      {stepDisplay}
      {auroLinkElem}
    </div>
  );

  let accountDoesNotExist;
  if (hasBeenSetup && !accountExists) {
    const faucetLink = `https://faucet.minaprotocol.com/?address='${publicKeyBase58}`;
    accountDoesNotExist = (
      <div>
        <span style={{ paddingRight: "1rem" }}>Account does not exist.</span>
        <a href={faucetLink} target="_blank" rel="noreferrer">
          Visit the faucet to fund this fee payer account
        </a>
      </div>
    );
  }

  let mainContent;
  if (hasBeenSetup && accountExists) {
    mainContent = (
      <div style={{ justifyContent: "center", alignItems: "center" }}>
        <div className={styles.center} style={{ padding: 0 }}>
          {/* Input for message */}
          <input
            type="text"
            placeholder="Enter your message"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            style={{ width: "300px", margin: "10px 0" }}
          />

          {/* Input for private key */}
          <input
            type="text"
            placeholder="Enter your private key"
            value={privateKeyInput}
            onChange={(e) => setPrivateKeyInput(e.target.value)}
            style={{ width: "300px", margin: "10px 0" }}
          />

          {/* Submit button to send the message */}
          <button
            className={styles.card}
            onClick={onSubmitMessage}
            disabled={creatingTransaction}
          >
            Submit Message
          </button>

          {/* Retrieve messages */}
          <button
            className={styles.card}
            onClick={async () => {
              const messages = await zkappWorkerClient!.getMessageClient();
              console.log(messages);
            }}
          >
            Retrieve Messages
          </button>
        </div>
      </div>
    );
  }

  return (
    <GradientBG>
      <div className={styles.main} style={{ padding: 0 }}>
        <div className={styles.center} style={{ padding: 0 }}>
          {setup}
          {accountDoesNotExist}
          {mainContent}
        </div>
      </div>
    </GradientBG>
  );
}
