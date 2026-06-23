import React, { useState } from 'react';
import { Wallet, ArrowRightLeft, Activity } from 'lucide-react';
import { ethers } from 'ethers';

function App() {
      const [walletAddress, setWalletAddress] = useState('');

        const connectWallet = async () => {
                if (typeof window.ethereum !== 'undefined') {
                          try {
                                    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                                            setWalletAddress(accounts[0]);
                          } catch (error) {
                                    console.error("Connection failed or rejected");
                          }
                } else {
                          alert("Please install a Web3 Wallet like MetaMask!");
                }
        };

          const formatAddress = (address) => {
                return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
          };

            return (
                    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
                          <div className="max-w-md w-full bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-700">
                                  <div className="flex items-center justify-center space-x-3 mb-8">
                                            <Activity className="text-blue-500 w-10 h-10" />
                                                      <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                                                                  PulsePay
                                                                            </h1>
                                                                                    </div>
                                                                                            <div className="bg-gray-950 rounded-xl p-6 mb-8 border border-gray-700 text-center shadow-inner">
                                                                                                      <p className="text-gray-400 text-sm mb-2 font-medium">Total Balance (Sepolia ETH)</p>
                                                                                                                <h2 className="text-5xl font-extrabold text-white">$0.00</h2>
                                                                                                                        </div>
                                                                                                                                <div className="grid grid-cols-2 gap-4">
                                                                                                                                          <button 
                                                                                                                                                      onClick={connectWallet}
                                                                                                                                                                  className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-all shadow-lg active:scale-95"
                                                                                                                                                                            >
                                                                                                                                                                                        <Wallet className="w-5 h-5" />
                                                                                                                                                                                                    <span>{walletAddress ? formatAddress(walletAddress) : 'Connect Wallet'}</span>
                                                                                                                                                                                                              </button>
                                                                                                                                                                                                                        <button className="flex items-center justify-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-semibold transition-all shadow-lg active:scale-95">
                                                                                                                                                                                                                                    <ArrowRightLeft className="w-5 h-5" />
                                                                                                                                                                                                                                                <span>Transfer</span>
                                                                                                                                                                                                                                                          </button>
                                                                                                                                                                                                                                                                  </div>
                                                                                                                                                                                                                                                                        </div>
                                                                                                                                                                                                                                                                            </div>
            );
}

export default App;
