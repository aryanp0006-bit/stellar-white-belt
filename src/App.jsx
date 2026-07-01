import { useState, useEffect } from "react";
import { getAddress, signTransaction, isConnected } from "@stellar/freighter-api";
import {
  Horizon,
  TransactionBuilder,
  Operation,
  Asset,
  BASE_FEE,
  Transaction,
} from "@stellar/stellar-sdk";
import "./App.css";

function App() {
  const [publicKey, setPublicKey] = useState("");
  const [balance, setBalance] = useState("");
  const [receiver, setReceiver] = useState("");
  const [amount, setAmount] = useState("");
  const [txStatus, setTxStatus] = useState("");
  const [txStatusType, setTxStatusType] = useState(""); // "success" | "error" | "pending"
  const [isLoading, setIsLoading] = useState(false);
  const [extensionInstalled, setExtensionInstalled] = useState(null); // null = checking
  const [notification, setNotification] = useState(null); // { msg, type }

  const NETWORK = "Test SDF Network ; September 2015";
  const server = new Horizon.Server("https://horizon-testnet.stellar.org");

  // Check if Freighter is installed on mount
  useEffect(() => {
    const checkExtension = async () => {
      try {
        const result = await isConnected();
        // isConnected() returns { isConnected: boolean } in newer API versions
        if (typeof result === "object" && result !== null && "isConnected" in result) {
          setExtensionInstalled(result.isConnected);
        } else {
          setExtensionInstalled(!!result);
        }
      } catch {
        setExtensionInstalled(false);
      }
    };
    // v6 isConnected() has a 2s internal timeout — wait longer than that
    setTimeout(checkExtension, 2500);
  }, []);

  const showNotification = (msg, type = "error") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // 🔹 CONNECT WALLET
  const connectWallet = async () => {
    setIsLoading(true);
    try {
      // getAddress() in v6 triggers Freighter popup if not yet connected
      const result = await getAddress();
      console.log("getAddress result:", result);

      // v6 returns { address, error } — address is the public key
      const pk = result.address || result.publicKey || "";

      if (!pk) {
        // Try requestAccess as fallback (triggers popup)
        const accessResult = await requestAccess();
        console.log("requestAccess result:", accessResult);
        const pk2 = accessResult.address || accessResult.publicKey || "";
        if (!pk2) {
          showNotification("Could not get public key. Please unlock Freighter and approve.", "error");
          setIsLoading(false);
          return;
        }
        await loadBalance(pk2);
        return;
      }

      await loadBalance(pk);
    } catch (error) {
      console.error("Connect Error:", error);
      showNotification("Wallet connection failed. Make sure Freighter is unlocked.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const loadBalance = async (pk) => {
    const account = await server.loadAccount(pk);
    const xlmBalance = account.balances.find(
      (bal) => bal.asset_type === "native"
    );
    setPublicKey(pk);
    setBalance(xlmBalance ? xlmBalance.balance : "0");
    setTxStatus("");
    setTxStatusType("");
    showNotification("Wallet connected successfully! 🎉", "success");
  };

  // 🔹 SEND XLM
  const sendXLM = async () => {
    if (!receiver) {
      showNotification("Please enter a receiver public key", "error");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      showNotification("Please enter a valid amount", "error");
      return;
    }
    if (Number(amount) > Number(balance)) {
      showNotification("Insufficient balance", "error");
      return;
    }

    setIsLoading(true);
    setTxStatus("Processing transaction...");
    setTxStatusType("pending");

    try {
      const account = await server.loadAccount(publicKey);

      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK,
      })
        .addOperation(
          Operation.payment({
            destination: receiver,
            asset: Asset.native(),
            amount: amount,
          })
        )
        .setTimeout(100)
        .build();

      // v6 API: signTransaction returns { signedTransaction, signerAddress, error }
      const signResult = await signTransaction(transaction.toXDR(), {
        networkPassphrase: NETWORK,
      });

      if (signResult.error) {
        throw new Error(signResult.error.message || "Signing failed");
      }

      // v6 returns signedTransaction (not signedTxXdr)
      const xdr = signResult.signedTxXdr || signResult.signedTransaction;
      const signedTx = new Transaction(xdr, NETWORK);
      await server.submitTransaction(signedTx);

      setTxStatus("Transaction Successful!");
      setTxStatusType("success");
      showNotification("XLM sent successfully! 🚀", "success");

      const updatedAccount = await server.loadAccount(publicKey);
      const updatedBalance = updatedAccount.balances.find(
        (b) => b.asset_type === "native"
      );
      setBalance(updatedBalance ? updatedBalance.balance : balance);
      setAmount("");
      setReceiver("");
    } catch (error) {
      console.error("Transaction Error:", error);
      setTxStatus("Transaction Failed");
      setTxStatusType("error");
      showNotification("Transaction failed. Please try again.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const shortKey = publicKey
    ? `${publicKey.slice(0, 6)}...${publicKey.slice(-6)}`
    : "";

  return (
    <div className="app-bg">
      {/* Animated background orbs */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      {/* Notification Toast */}
      {notification && (
        <div className={`toast toast-${notification.type}`}>
          <span className="toast-icon">
            {notification.type === "success" ? "✅" : notification.type === "pending" ? "⏳" : "⚠️"}
          </span>
          <span>{notification.msg}</span>
        </div>
      )}

      <div className="glass-card main-card">
        {/* Header */}
        <div className="header">
          <div className="logo-ring">
            <span className="logo-emoji">🚀</span>
          </div>
          <div>
            <h1 className="title">Stellar White Belt</h1>
            <p className="subtitle">Testnet Wallet · XLM Transfers</p>
          </div>
        </div>

        {/* Extension warning banner */}
        {extensionInstalled === false && (
          <div className="banner banner-warning">
            <span>⚠️</span>
            <div>
              <strong>Freighter Not Detected</strong>
              <p>
                Install the{" "}
                <a
                  href="https://www.freighter.app/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Freighter Wallet Extension
                </a>{" "}
                and reload this page.
              </p>
            </div>
          </div>
        )}

        {/* Wallet Section */}
        {!publicKey ? (
          <div className="connect-section">
            <p className="connect-hint">
              Connect your Freighter wallet to get started on Stellar Testnet
            </p>
            <button
              className="btn btn-primary btn-large"
              onClick={connectWallet}
              disabled={isLoading}
              id="connect-wallet-btn"
            >
              {isLoading ? (
                <span className="spinner" />
              ) : (
                <>
                  <span>🔗</span> Connect Wallet
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="wallet-info">
            <div className="info-grid">
              <div className="info-chip">
                <span className="info-label">Public Key</span>
                <span
                  className="info-value mono"
                  title={publicKey}
                  onClick={() => navigator.clipboard.writeText(publicKey)}
                  style={{ cursor: "pointer" }}
                >
                  {shortKey} <span className="copy-hint">📋</span>
                </span>
              </div>
              <div className="info-chip balance-chip">
                <span className="info-label">XLM Balance</span>
                <span className="info-value balance-value">
                  {balance ? `${Number(balance).toFixed(4)} XLM` : "—"}
                </span>
              </div>
            </div>

            {/* Send Form */}
            <div className="send-form">
              <h2 className="section-title">Send XLM</h2>

              <div className="field-group">
                <label className="field-label" htmlFor="receiver-input">
                  Receiver Address
                </label>
                <input
                  id="receiver-input"
                  type="text"
                  placeholder="G... (Stellar Public Key)"
                  value={receiver}
                  onChange={(e) => setReceiver(e.target.value)}
                  className="glass-input"
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="amount-input">
                  Amount (XLM)
                </label>
                <input
                  id="amount-input"
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="glass-input"
                  min="0"
                  step="0.01"
                />
              </div>

              {txStatus && (
                <div className={`tx-status tx-status-${txStatusType}`}>
                  {txStatusType === "pending" && <span className="spinner sm" />}
                  {txStatus}
                </div>
              )}

              <div className="btn-row">
                <button
                  className="btn btn-primary"
                  onClick={sendXLM}
                  disabled={isLoading}
                  id="send-xlm-btn"
                >
                  {isLoading ? <span className="spinner" /> : "Send XLM 🚀"}
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={connectWallet}
                  disabled={isLoading}
                  id="refresh-btn"
                >
                  ↻ Refresh
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="footer-note">
          Powered by Stellar Testnet · Freighter Wallet
        </div>
      </div>
    </div>
  );
}

export default App;