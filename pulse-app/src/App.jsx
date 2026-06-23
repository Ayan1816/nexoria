import React, { useState, useEffect } from 'react';
import { Wallet, Zap, Activity, StopCircle, PlayCircle, ArrowLeft } from 'lucide-react';
import { ethers } from 'ethers';

function App() {
      const [walletAddress, setWalletAddress] = useState('');
        const [balance, setBalance] = useState('0.0000');
          const [isArcMode, setIsArcMode] = useState(false);
            const [recipient, setRecipient] = useState('');
              const [isStreaming, setIsStreaming] = useState(false);
                const [streamedAmount, setStreamedAmount] = useState(0);

                  const connectWallet = async () => {
                        if (typeof window.ethereum !== 'undefined') {
                                  try {
                                            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                                                    const address = accounts[0];
                                                            setWalletAddress(address);
                                                                    fetchBalance(address);
                                  } catch (error) {
                                            console.error("Connection failed");
                                  }
                        } else {
                                  alert("Please install MetaMask!");
                        }
                  };

                    const fetchBalance = async (address) => {
                            try {
                                      const provider = new ethers.BrowserProvider(window.ethereum);
                                            const balanceBigInt = await provider.getBalance(address);
                                                  const ethBalance = ethers.formatEther(balanceBigInt);
                                                        setBalance(parseFloat(ethBalance).toFixed(4));
                            } catch (error) {
                                      console.error("Fetch failed", error);
                            }
                    };

                      const formatAddress = (address) => {
                            return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
                      };

                        useEffect(() => {
                                let interval;
                                    if (isStreaming) {
                                              interval = setInterval(() => {
                                                        setStreamedAmount(prev => prev + 0.00001);
                                              }, 100); 
                                    } else {
                                              clearInterval(interval);
                                    }
                                        return () => clearInterval(interval);
                        }, [isStreaming]);

                          const toggleStream = () => {
                                if (!recipient) {
                                          alert("Please enter a recipient wallet address!");
                                                return;
                                }
                                    setIsStreaming(!isStreaming);
                          };

                            return (
                                    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
                                          <div className="max-w-md w-full bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-700 relative overflow-hidden">
                                                  <div className="flex items-center justify-center space-x-3 mb-8">
                                                            <Activity className="text-blue-500 w-10 h-10" />
                                                                      <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                                                                                  PulsePay : ARC
                                                                                            </h1>
                                                                                                    </div>
                                                                                                            {!isArcMode ? (
                                                                                                                          <div className="animate-in fade-in zoom-in duration-300">
                                                                                                                                      <div className="bg-gray-950 rounded-xl p-6 mb-8 border border-gray-700 text-center shadow-inner">
                                                                                                                                                    <p className="text-gray-400 text-sm mb-2 font-medium">Total Balance (Sepolia ETH)</p>
                                                                                                                                                                  <h2 className="text-5xl font-extrabold text-white">{balance} <span className="text-2xl text-gray-500">ETH</span></h2>
                                                                                                                                                                              </div>
                                                                                                                                                                                          <div className="grid grid-cols-2 gap-4">
                                                                                                                                                                                                        <button onClick={connectWallet} className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-all shadow-lg active:scale-95">
                                                                                                                                                                                                                        <Wallet className="w-5 h-5" />
                                                                                                                                                                                                                                        <span>{walletAddress ? formatAddress(walletAddress) : 'Connect'}</span>
                                                                                                                                                                                                                                                      </button>
                                                                                                                                                                                                                                                                    <button onClick={() => setIsArcMode(true)} className="flex items-center justify-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-semibold transition-all shadow-lg active:scale-95 relative overflow-hidden group">
                                                                                                                                                                                                                                                                                    <Zap className="w-5 h-5 text-yellow-400 animate-pulse" />
                                                                                                                                                                                                                                                                                                    <span>Open ARC</span>
                                                                                                                                                                                                                                                                                                                  </button>
                                                                                                                                                                                                                                                                                                                              </div>
                                                                                                                                                                                                                                                                                                                                        </div>
                                                                                                            ) : (
                                                                                                                          <div className="animate-in slide-in-from-right duration-300">
                                                                                                                                      <button onClick={() => { setIsArcMode(false); setIsStreaming(false); }} className="flex items-center text-gray-400 hover:text-white mb-6 transition-colors">
                                                                                                                                                    <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
                                                                                                                                                                </button>
                                                                                                                                                                            <div className="bg-gray-950 rounded-xl p-6 mb-6 border border-purple-500/30 text-center relative overflow-hidden">
                                                                                                                                                                                          <div className={`absolute inset-0 bg-purple-500/10 ${isStreaming ? 'animate-pulse' : 'hidden'}`}></div>
                                                                                                                                                                                                        <p className="text-purple-400 text-sm mb-2 font-bold uppercase tracking-wider">Live Flow Meter</p>
                                                                                                                                                                                                                      <h2 className="text-5xl font-mono font-extrabold text-white">
                                                                                                                                                                                                                                      {streamedAmount.toFixed(5)} <span className="text-lg text-gray-500">ETH</span>
                                                                                                                                                                                                                                                    </h2>
                                                                                                                                                                                                                                                                </div>
                                                                                                                                                                                                                                                                            <div className="space-y-4">
                                                                                                                                                                                                                                                                                          <div>
                                                                                                                                                                                                                                                                                                          <label className="block text-xs text-gray-400 mb-1 ml-1 uppercase tracking-wide">Recipient Address</label>
                                                                                                                                                                                                                                                                                                                          <input type="text" placeholder="0x..." value={recipient} onChange={(e) => setRecipient(e.target.value)} disabled={isStreaming} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 disabled:opacity-50 transition-colors" />
                                                                                                                                                                                                                                                                                                                                        </div>
                                                                                                                                                                                                                                                                                                                                                      <button onClick={toggleStream} className={`w-full flex items-center justify-center space-x-2 py-4 rounded-lg font-bold text-lg transition-all shadow-lg active:scale-95 ${isStreaming ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}>
                                                                                                                                                                                                                                                                                                                                                                      {isStreaming ? <StopCircle className="w-6 h-6" /> : <PlayCircle className="w-6 h-6" />}
                                                                                                                                                                                                                                                                                                                                                                                      <span>{isStreaming ? 'Stop Flow' : 'Start Streaming'}</span>
                                                                                                                                                                                                                                                                                                                                                                                                    </button>
                                                                                                                                                                                                                                                                                                                                                                                                                </div>
                                                                                                                                                                                                                                                                                                                                                                                                                          </div>
                                                                                                            )}
                                                                                                                  </div>
                                                                                                                      </div>
                            );
}

export default App;
