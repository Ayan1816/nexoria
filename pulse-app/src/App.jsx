import React, { useState, useEffect } from 'react';
import { Wallet, Zap, Activity, StopCircle, PlayCircle, ArrowLeft, CheckCircle2, LogOut, ExternalLink, AlertTriangle, ShieldCheck } from 'lucide-react';
import { ethers } from 'ethers';

function App() {
      const [walletAddress, setWalletAddress] = useState('');
        const [balance, setBalance] = useState('0.0000');
          const [isArcMode, setIsArcMode] = useState(false);

            // Flow states
              const [recipient, setRecipient] = useState('');
                const [streamLimit, setStreamLimit] = useState('');
                  const [isStreaming, setIsStreaming] = useState(false);
                    const [streamedAmount, setStreamedAmount] = useState(0);
                      const [txHash, setTxHash] = useState('');
                        const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
                          const [isProcessing, setIsProcessing] = useState(false);

                            const connectWallet = async () => {
                                    if (typeof window.ethereum !== 'undefined') {
                                              try {
                                                        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                                                                const address = accounts[0];
                                                                        setWalletAddress(address);
                                                                                fetchBalance(address);
                                                                                        setStatusMsg({ type: 'success', text: 'Wallet connected securely!' });
                                              } catch (error) {
                                                        setStatusMsg({ type: 'error', text: 'Connection rejected by user.' });
                                              }
                                    } else {
                                              setStatusMsg({ type: 'warning', text: 'Please open this link inside MetaMask mobile app browser!' });
                                    }
                            };

                              const disconnectWallet = () => {
                                    setWalletAddress('');
                                        setBalance('0.0000');
                                            setIsArcMode(false);
                                                setIsStreaming(false);
                                                    setTxHash('');
                                                        setStatusMsg({ type: 'info', text: 'Wallet disconnected.' });
                              };

                                const fetchBalance = async (address) => {
                                        try {
                                                  const provider = new ethers.BrowserProvider(window.ethereum);
                                                        const balanceBigInt = await provider.getBalance(address);
                                                              const ethBalance = ethers.formatEther(balanceBigInt);
                                                                    setBalance(parseFloat(ethBalance).toFixed(4));
                                        } catch (error) {
                                                  console.error("Balance fetch error");
                                        }
                                };

                                  const formatAddress = (address) => {
                                        if (!address) return '';
                                            return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
                                  };

                                    // Streaming Engine with "Smart Brake"
                                      useEffect(() => {
                                            let interval;
                                                if (isStreaming) {
                                                          interval = setInterval(() => {
                                                                    setStreamedAmount(prev => {
                                                                                  const nextVal = prev + 0.00001;
                                                                                            if (streamLimit && parseFloat(streamLimit) > 0 && nextVal >= parseFloat(streamLimit)) {
                                                                                                            return parseFloat(streamLimit); 
                                                                                            }
                                                                                                      return nextVal;
                                                                    });
                                                          }, 100); 
                                                } else {
                                                          clearInterval(interval);
                                                }
                                                    return () => clearInterval(interval);
                                      }, [isStreaming, streamLimit]);

                                        // Auto-stop watcher
                                          useEffect(() => {
                                                if (isStreaming && streamLimit && parseFloat(streamLimit) > 0) {
                                                          if (streamedAmount >= parseFloat(streamLimit)) {
                                                                    setIsStreaming(false);
                                                                            setStatusMsg({ type: 'warning', text: 'Auto-Stopped: Maximum stream limit reached! Please settle.' });
                                                          }
                                                }
                                          }, [streamedAmount, isStreaming, streamLimit]);

                                            const startFlow = () => {
                                                    if (!walletAddress) {
                                                              setStatusMsg({ type: 'error', text: 'Please connect your wallet first!' });
                                                                    return;
                                                    }
                                                        if (!recipient || !ethers.isAddress(recipient)) {
                                                                  setStatusMsg({ type: 'error', text: 'Invalid recipient Ethereum address!' });
                                                                        return;
                                                        }
                                                            if (recipient.toLowerCase() === walletAddress.toLowerCase()) {
                                                                      setStatusMsg({ type: 'error', text: 'Cannot stream to your own wallet!' });
                                                                            return;
                                                            }
                                                                if (streamLimit && parseFloat(streamLimit) < 0) {
                                                                          setStatusMsg({ type: 'error', text: 'Limit cannot be negative!' });
                                                                                return;
                                                                }
                                                                    
                                                                        setTxHash('');
                                                                            setStatusMsg({ type: 'info', text: 'Channel open. Stream flowing live...' });
                                                                                setStreamedAmount(0); 
                                                                                    setIsStreaming(true);
                                            };

                                              const stopAndSettle = async () => {
                                                    setIsStreaming(false);
                                                        setIsProcessing(true);
                                                            setStatusMsg({ type: 'warning', text: 'Please confirm the transaction in your Metamask wallet...' });

                                                                try {
                                                                          const provider = new ethers.BrowserProvider(window.ethereum);
                                                                                const signer = await provider.getSigner();
                                                                                      
                                                                                            const cleanAmount = streamedAmount.toFixed(6).toString();
                                                                                                  const amountInWei = ethers.parseEther(cleanAmount);

                                                                                                        const tx = await signer.sendTransaction({
                                                                                                                    to: recipient,
                                                                                                                            value: amountInWei
                                                                                                        });

                                                                                                              setTxHash(tx.hash);
                                                                                                                    setStatusMsg({ type: 'success', text: `Success! Transaction broadcasted.` });
                                                                                                                          fetchBalance(walletAddress);
                                                                } catch (error) {
                                                                          if (error.code === 'INSUFFICIENT_FUNDS' || (error.message && error.message.includes('gas'))) {
                                                                                    setStatusMsg({ type: 'error', text: 'Action Failed: Your wallet has 0 Sepolia ETH for Gas!' });
                                                                          } else {
                                                                                    setStatusMsg({ type: 'error', text: 'Transaction cancelled or rejected.' });
                                                                          }
                                                                } finally {
                                                                          setIsProcessing(false);
                                                                }
                                              };

                                                return (
                                                        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 font-sans">
                                                              <div className="max-w-md w-full bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-700 relative overflow-hidden">
                                                                      <div className="flex items-center justify-between mb-8">
                                                                                <div className="flex items-center space-x-3">
                                                                                            <Activity className="text-blue-500 w-8 h-8 animate-pulse" />
                                                                                                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 font-mono">
                                                                                                                      PulsePay<span className="text-xs ml-1 px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded border border-purple-500/30">ARC</span>
                                                                                                                                  </h1>
                                                                                                                                            </div>
                                                                                                                                                      {walletAddress && (
                                                                                                                                                                    <button onClick={disconnectWallet} className="flex items-center space-x-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg border border-red-500/20 transition-all active:scale-95">
                                                                                                                                                                                  <LogOut className="w-3.5 h-3.5" />
                                                                                                                                                                                                <span>Disconnect</span>
                                                                                                                                                                                                            </button>
                                                                                                                                                      )}
                                                                                                                                                              </div>

                                                                                                                                                                      {statusMsg.text && (
                                                                                                                                                                                  <div className={`p-3 rounded-xl mb-6 text-xs flex items-start space-x-2 border ${
                                                                                                                                                                                                statusMsg.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                                                                                                                                                                                                            statusMsg.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400 font-mono' :
                                                                                                                                                                                                                        statusMsg.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 font-medium' :
                                                                                                                                                                                                                                    'bg-blue-500/10 border-blue-500/30 text-blue-400'
                                                                                                                                                                                  }`}>
                                                                                                                                                                                              {statusMsg.type === 'error' ? <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" /> : <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                                                                                                                                                                                                          <span className="flex-1 break-words">{statusMsg.text}</span>
                                                                                                                                                                                                                    </div>
                                                                                                                                                                      )}

                                                                                                                                                                              {!isArcMode ? (
                                                                                                                                                                                          <div className="animate-in fade-in zoom-in duration-300">
                                                                                                                                                                                                      <div className="bg-gray-950 rounded-xl p-6 mb-8 border border-gray-700 text-center shadow-inner relative">
                                                                                                                                                                                                                    <p className="text-gray-400 text-xs mb-1 font-mono uppercase tracking-wider">Sepolia Testnet Balance</p>
                                                                                                                                                                                                                                  <h2 className="text-4xl font-extrabold text-white font-mono">{balance} <span className="text-lg text-gray-500">ETH</span></h2>
                                                                                                                                                                                                                                              </div>
                                                                                                                                                                                                                                                          <div className="grid grid-cols-2 gap-4">
                                                                                                                                                                                                                                                                        {!walletAddress ? (
                                                                                                                                                                                                                                                                                            <button onClick={connectWallet} className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold transition-all shadow-lg active:scale-95 col-span-2 tracking-wide">
                                                                                                                                                                                                                                                                                                              <Wallet className="w-5 h-5" />
                                                                                                                                                                                                                                                                                                                                <span>Connect MetaMask</span>
                                                                                                                                                                                                                                                                                                                                                </button>
                                                                                                                                                                                                                                                                        ) : (
                                                                                                                                                                                                                                                                                            <>
                                                                                                                                                                                                                                                                                                              <div className="flex items-center justify-center bg-gray-900 border border-gray-700 text-blue-400 py-3 rounded-xl font-mono text-xs font-bold">
                                                                                                                                                                                                                                                                                                                                  {formatAddress(walletAddress)}
                                                                                                                                                                                                                                                                                                                                                    </div>
                                                                                                                                                                                                                                                                                                                                                                      <button onClick={() => setIsArcMode(true)} className="flex items-center justify-center space-x-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95 group">
                                                                                                                                                                                                                                                                                                                                                                                          <Zap className="w-4 h-4 text-yellow-300 group-hover:scale-125 transition-transform" />
                                                                                                                                                                                                                                                                                                                                                                                                              <span>Launch ARC</span>
                                                                                                                                                                                                                                                                                                                                                                                                                                </button>
                                                                                                                                                                                                                                                                                                                                                                                                                                                </>
                                                                                                                                                                                                                                                                        )}
                                                                                                                                                                                                                                                                                    </div>
                                                                                                                                                                                                                                                                                              </div>
                                                                                                                                                                              ) : (
                                                                                                                                                                                          <div className="animate-in slide-in-from-right duration-300">
                                                                                                                                                                                                      <button onClick={() => { setIsArcMode(false); setIsStreaming(false); }} className="flex items-center text-gray-400 hover:text-white mb-6 text-xs transition-colors font-medium">
                                                                                                                                                                                                                    <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Dashboard
                                                                                                                                                                                                                                </button>

                                                                                                                                                                                                                                            <div className="bg-gray-950 rounded-xl p-6 mb-6 border border-purple-500/30 text-center relative overflow-hidden">
                                                                                                                                                                                                                                                          <div className={`absolute inset-0 bg-purple-500/10 ${isStreaming ? 'animate-pulse' : 'hidden'}`}></div>
                                                                                                                                                                                                                                                                        <p className="text-purple-400 text-xs mb-1 font-bold font-mono tracking-widest uppercase">Live Flow Meter</p>
                                                                                                                                                                                                                                                                                      <h2 className="text-5xl font-mono font-black text-white">
                                                                                                                                                                                                                                                                                                      {streamedAmount.toFixed(5)} <span className="text-base text-gray-500">ETH</span>
                                                                                                                                                                                                                                                                                                                    </h2>
                                                                                                                                                                                                                                                                                                                                </div>

                                                                                                                                                                                                                                                                                                                                            <div className="space-y-4">
                                                                                                                                                                                                                                                                                                                                                          <div>
                                                                                                                                                                                                                                                                                                                                                                          <label className="block text-xs text-gray-400 mb-1 ml-1 font-mono uppercase">Recipient Address</label>
                                                                                                                                                                                                                                                                                                                                                                                          <input type="text" placeholder="Paste 0x... address" value={recipient} onChange={(e) => setRecipient(e.target.value)} disabled={isStreaming || isProcessing} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 disabled:opacity-50 font-mono text-xs transition-colors" />
                                                                                                                                                                                                                                                                                                                                                                                                        </div>

                                                                                                                                                                                                                                                                                                                                                                                                                      <div>
                                                                                                                                                                                                                                                                                                                                                                                                                                      <label className="block text-xs text-emerald-400 mb-1 ml-1 font-mono uppercase">Max Limit (Optional)</label>
                                                                                                                                                                                                                                                                                                                                                                                                                                                      <input type="number" placeholder="e.g. 0.0005" value={streamLimit} onChange={(e) => setStreamLimit(e.target.value)} disabled={isStreaming || isProcessing} className="w-full bg-gray-900 border border-emerald-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50 font-mono text-xs transition-colors" />
                                                                                                                                                                                                                                                                                                                                                                                                                                                                    </div>

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  {txHash && (
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="w-full p-3.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-xl flex items-center justify-between text-xs text-purple-300 font-mono transition-all group shadow-lg">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      <span className="truncate mr-2 font-bold">↗ Verify on Etherscan</span>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        <ExternalLink className="w-4 h-4 text-purple-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform flex-shrink-0" />
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        </a>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  )}

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                {!isStreaming ? (
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    <button onClick={startFlow} disabled={isProcessing} className="w-full flex items-center justify-center space-x-2 py-4 rounded-xl font-bold text-base bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg active:scale-95 disabled:opacity-50 tracking-wide">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      <PlayCircle className="w-5 h-5" />
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        <span>START STREAM</span>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        </button>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                ) : (
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    <button onClick={stopAndSettle} disabled={isProcessing} className="w-full flex items-center justify-center space-x-2 py-4 rounded-xl font-bold text-base bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-lg active:scale-95 animate-pulse tracking-wide">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      <StopCircle className="w-5 h-5" />
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        <span>{isProcessing ? 'SIGNING...' : 'STOP & SETTLE'}</span>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        </button>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                )}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      </div>
                                                                                                                                                                              )}
                                                                                                                                                                                    </div>
                                                                                                                                                                                        </div>
                                                );
}

export default App;
