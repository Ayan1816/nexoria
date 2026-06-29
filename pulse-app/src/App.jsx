import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowRight, Bot, Boxes, Clock3, Cpu, Gauge, Globe2,
  Orbit, ShieldCheck, Sparkles, Wallet2, Zap, LogOut, Lock, Timer
} from 'lucide-react';

const modules = [
  { id: 'delegate', title: 'AI Agentic Delegate', subtitle: 'AUTONOMOUS POLICY ROUTING', description: 'Deploy an intent-driven delegate that negotiates treasury moves, routes liquidity, and watches risk in real time.', accent: 'from-cyan-400 to-blue-500', icon: Bot, stat: '92% SIGNAL CLARITY' },
  { id: 'escrow', title: 'Time-Stream Escrow', subtitle: 'PROGRAMMABLE MILESTONE TRUST', description: 'Lock funds securely in a time-locked smart contract. Funds can only be released after the set time expires.', accent: 'from-emerald-400 to-cyan-400', icon: Clock3, stat: '24/7 ESCROW PULSE' },
  { id: 'liquidity', title: 'Unified Liquidity Blackhole', subtitle: 'CONCENTRATED FLOW CONTROL', description: 'Bury fragmented balances into a single unified flow. Abstract away chain specifics entirely.', accent: 'from-fuchsia-500 to-cyan-500', icon: Boxes, stat: 'OMNICHAIN' },
  { id: 'shield', title: 'Silent Gas Shield', subtitle: 'ZERO-FRICTION EXECUTION', description: 'Native USDC gas abstraction. Users never see or pay native gas tokens like ETH or SOL again. Test Real Transaction Here.', accent: 'from-blue-500 to-indigo-500', icon: ShieldCheck, stat: 'GAS: $0.00' },
  { id: 'passport', title: 'Holographic Web3 Passport', subtitle: 'PORTABLE IDENTITY MESH', description: 'A unified identity layer that travels with the user across the entire Arc network ecosystem.', accent: 'from-violet-500 to-fuchsia-500', icon: Orbit, stat: 'boss.arc' }
];

const ESCROW_CONTRACT_ADDRESS = "0xB10A0aF8618CA1f288993B35Dbb72997E15B5B90";

export default function App() {
  const [activeModule, setActiveModule] = useState(modules[0].id);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletAddress, setWalletAddress] = useState(null);
  const [balance, setBalance] = useState('0.00');
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [activeProvider, setActiveProvider] = useState(null);
  
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');

  const [escrowAmount, setEscrowAmount] = useState('');
  const [escrowDuration, setEscrowDuration] = useState('1');

  const [isExecuting, setIsExecuting] = useState(false);
  const [txHash, setTxHash] = useState(null);

  const arcChainIdHex = '0x4cef52'; 

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.ethers) {
      const script = document.createElement('script');
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/ethers/6.13.1/ethers.umd.min.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const executeConnection = async (targetProvider) => {
    try {
      setIsConnecting(true);
      setShowWalletModal(false);
      setActiveProvider(targetProvider); 

      try {
        await targetProvider.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }]
        });
      } catch (permError) {
        setIsConnecting(false);
        return;
      }

      const accounts = await targetProvider.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];
      const currentChain = await targetProvider.request({ method: 'eth_chainId' });
      
      if (currentChain.toLowerCase() !== arcChainIdHex.toLowerCase()) {
        try {
          await targetProvider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: arcChainIdHex }],
          });
        } catch (switchError) {
          if (switchError.code === 4902 || switchError.code === -32603) {
            await targetProvider.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: arcChainIdHex,
                chainName: 'Arc Testnet',
                rpcUrls: ['https://rpc.testnet.arc.network'],
                nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 }, 
                blockExplorerUrls: ['https://testnet.arcscan.app']
              }],
            });
          } else {
            throw new Error("Network switch cancelled");
          }
        }
      }

      await new Promise(resolve => setTimeout(resolve, 1500));

      const balanceHex = await targetProvider.request({
        method: 'eth_getBalance',
        params: [address, 'latest']
      });
      
      const realBalance = (parseInt(balanceHex, 16) / 1e18).toFixed(4);
      setWalletAddress(address);
      setBalance(realBalance);
      setIsConnecting(false);

      confetti({ particleCount: 150, spread: 80, origin: { y: 0.3 }, colors: ['#22d3ee', '#34d399', '#c084fc'] });
    } catch (error) {
      console.error(error);
      setIsConnecting(false);
      alert("Boss, Connection cancelled! Please approve the network switch.");
    }
  };

  const handleProviderSelect = (walletType) => {
    if (typeof window === 'undefined' || !window.ethereum) {
      alert("Boss, No Web3 wallet detected!");
      return;
    }
    const providers = window.ethereum.providers || [window.ethereum];
    let chosen = window.ethereum;
    if (walletType === 'rabby') chosen = providers.find(p => p.isRabby) || window.ethereum;
    else if (walletType === 'metamask') chosen = providers.find(p => p.isMetaMask && !p.isRabby) || window.ethereum;
    executeConnection(chosen);
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
    setBalance('0.00');
    setActiveProvider(null);
    setTxHash(null);
    setRecipient('');
    setAmount('');
    setEscrowAmount('');
  };  const handleAction = async () => {
    if (!walletAddress || !activeProvider) {
      alert('Boss, please connect your Web3 wallet first!');
      return;
    }

    if (activeModule === 'shield') {
      if (!recipient || !amount) {
        alert('Boss, please enter Recipient Address and Amount!');
        return;
      }
      try {
        setIsExecuting(true);
        setTxHash(null);
        const valueInWei = BigInt(Math.floor(parseFloat(amount) * 1e18)).toString(16);
        const tx = await activeProvider.request({
          method: 'eth_sendTransaction',
          params: [{ from: walletAddress, to: recipient, value: '0x' + valueInWei }],
        });
        setTxHash(tx);
        setIsExecuting(false);
        confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 }, colors: ['#34d399', '#22d3ee', '#f472b6'] });
        
        setTimeout(async () => {
          const balanceHex = await activeProvider.request({ method: 'eth_getBalance', params: [walletAddress, 'latest'] });
          setBalance((parseInt(balanceHex, 16) / 1e18).toFixed(4));
        }, 5000);
      } catch (error) {
        setIsExecuting(false);
      }

    } else if (activeModule === 'escrow') {
      if (!escrowAmount || parseFloat(escrowAmount) <= 0) {
        alert('Boss, please enter a valid USDC amount to lock!');
        return;
      }

      if (!window.ethers) {
        alert('Web3 Engine is loading in background... please click EXECUTE again in 2 seconds!');
        return;
      }

      try {
        setIsExecuting(true);
        setTxHash(null);
        const durationInSeconds = parseInt(escrowDuration) * 3600;
        const provider = new window.ethers.BrowserProvider(activeProvider);
        const signer = await provider.getSigner();

        const escrowContract = new window.ethers.Contract(
          ESCROW_CONTRACT_ADDRESS,
          [
            "function lockFunds(uint256 durationInSeconds) external payable",
            "function claimFunds() external"
          ],
          signer
        );

        const amountInWei = window.ethers.parseEther(escrowAmount.toString());
        const tx = await escrowContract.lockFunds(durationInSeconds, {
          value: amountInWei
        });

        setTxHash(tx.hash);
        setIsExecuting(false);
        confetti({ particleCount: 250, spread: 120, origin: { y: 0.6 }, colors: ['#10b981', '#34d399', '#6ee7b7'] });

        setTimeout(async () => {
          const balanceHex = await activeProvider.request({ method: 'eth_getBalance', params: [walletAddress, 'latest'] });
          setBalance((parseInt(balanceHex, 16) / 1e18).toFixed(4));
        }, 5000);

      } catch (error) {
        console.error("Escrow Execution Error:", error);
        alert("Boss, Transaction Cancelled or Failed! Check wallet popup.");
        setIsExecuting(false);
      }

    } else {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#22d3ee', '#f472b6'] });
    }
  };

  const formatAddress = (addr) => addr ? `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}` : '';
  const activeData = modules.find(m => m.id === activeModule);
  const ActiveIcon = activeData.icon;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-cyan-500/30 relative">
      {showWalletModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-[0_0_30px_rgba(34,211,238,0.2)]">
            <div className="flex justify-between items-center text-white font-bold">
              <span>Select Web3 Wallet</span>
              <button onClick={() => setShowWalletModal(false)} className="text-slate-400 hover:text-white transition-colors">✕</button>
            </div>
            <div className="space-y-3 pt-2">
              <button onClick={() => handleProviderSelect('rabby')} className="w-full p-4 bg-slate-950 hover:bg-slate-800 border border-white/5 rounded-xl font-mono text-sm flex items-center justify-between text-cyan-400 font-bold transition-all">
                <span>Rabby Wallet</span> <span className="text-xs bg-cyan-500/10 px-2 py-1 rounded">INSTANT</span>
              </button>
              <button onClick={() => handleProviderSelect('metamask')} className="w-full p-4 bg-slate-950 hover:bg-slate-800 border border-white/5 rounded-xl font-mono text-sm flex items-center justify-between text-amber-400 font-bold transition-all">
                <span>MetaMask</span> <span className="text-xs bg-amber-500/10 px-2 py-1 rounded">POPULAR</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="border-b border-white/5 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-cyan-400" />
            <span className="font-bold tracking-widest text-white">ARC<span className="text-cyan-400">OS</span></span>
          </div>
          {walletAddress ? (
            <button onClick={disconnectWallet} className="px-4 py-2 rounded-lg text-sm font-mono font-bold bg-slate-900 border border-cyan-500/30 text-cyan-400 flex items-center gap-2 hover:bg-rose-950/30 hover:border-rose-500/30 hover:text-rose-400 transition-all">
              {formatAddress(walletAddress)} <LogOut className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={() => setShowWalletModal(true)} disabled={isConnecting} className="px-5 py-2 rounded-lg text-sm font-mono font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all">
              {isConnecting ? 'CONNECTING...' : 'CONNECT WALLET'}
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <section className="bg-slate-900 border border-white/5 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row gap-8 justify-between items-start relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none" />
          <div className="space-y-4 relative z-10">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-cyan-400 font-mono">
              <Cpu className="w-3 h-3" /> ArcOS - Agentic Economic Matrix
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight">Future-proof finance, tuned for autonomous motion.</h1>
            <p className="text-slate-400 max-w-lg text-sm md:text-base">Command liquidity, identity, and execution from a single premium cockpit built for the next era of onchain operations.</p>
          </div>
          <div className="flex flex-col gap-4 min-w-[200px] relative z-10 w-full md:w-auto">
            <div className="bg-slate-950 rounded-xl p-4 border border-white/5">
              <div className="text-[10px] text-slate-500 font-mono mb-1">NETWORK STATUS</div>
              <div className="flex items-center gap-2 text-emerald-400 font-mono text-sm"><Zap className="w-3 h-3" /> SECURE & LIVE</div>
            </div>
            <div className="bg-slate-950 rounded-xl p-4 border border-white/5">
              <div className="text-[10px] text-slate-500 font-mono mb-1">ARC BALANCE</div>
              <div className="text-2xl font-bold text-white font-mono">{balance} <span className="text-cyan-500 text-sm">USDC</span></div>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-mono">Choose a control surface</h2>
            <Gauge className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="space-y-3">
            {modules.map((mod) => {
              const Icon = mod.icon;
              const isActive = activeModule === mod.id;
              return (
                <button key={mod.id} onClick={() => setActiveModule(mod.id)} className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left ${isActive ? 'bg-slate-900 border-cyan-500/50 shadow-[0_0_20px_rgba(34,211,238,0.1)]' : 'bg-slate-900/50 border-white/5 hover:bg-slate-900'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${isActive ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-400'}`}><Icon className="w-5 h-5" /></div>
                    <div>
                      <div className={`font-bold ${isActive ? 'text-white' : 'text-slate-300'}`}>{mod.title}</div>
                      <div className="text-[10px] font-mono tracking-widest text-slate-500 mt-1">{mod.subtitle}</div>
                    </div>
                  </div>
                  <ArrowRight className={`w-4 h-4 ${isActive ? 'text-cyan-400 translate-x-1' : 'text-slate-600'}`} />
                </button>
              );
            })}
          </div>
        </section>

        <section className="bg-slate-900 border border-white/5 rounded-2xl p-6 md:p-8 relative overflow-hidden">
          <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${activeData.accent}`} />
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-slate-400 font-mono"><Sparkles className="w-3 h-3 text-cyan-400" /> Active Module</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-400 font-mono bg-cyan-400/10 px-2 py-1 rounded">{activeData.stat}</div>
          </div>
          <div className="space-y-6">
            <div className="inline-flex p-3 rounded-xl bg-slate-800/50 border border-white/5 text-cyan-400"><ActiveIcon className="w-6 h-6" /></div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">{activeData.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">{activeData.description}</p>
            </div>
            
            {activeModule === 'shield' && (
              <div className="pt-4 space-y-4 border-t border-white/5 mt-4">
                <div>
                  <label className="block text-[10px] text-slate-500 font-mono mb-2">RECIPIENT ADDRESS</label>
                  <input type="text" placeholder="0x..." value={recipient} onChange={e => setRecipient(e.target.value)} className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white font-mono text-sm focus:outline-none focus:border-cyan-500/50 transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 font-mono mb-2">AMOUNT (USDC)</label>
                  <input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white font-mono text-sm focus:outline-none focus:border-cyan-500/50 transition-all" />
                </div>
              </div>
            )}

            {activeModule === 'escrow' && (
              <div className="pt-4 space-y-4 border-t border-emerald-500/20 mt-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <label className="block text-[10px] text-emerald-500 font-mono mb-2 flex items-center gap-1"><Lock className="w-3 h-3"/> AMOUNT TO LOCK (USDC)</label>
                    <input type="number" placeholder="2.00" value={escrowAmount} onChange={e => setEscrowAmount(e.target.value)} className="w-full bg-slate-950 border border-emerald-500/30 rounded-xl p-3 text-emerald-400 font-mono text-sm focus:outline-none focus:border-emerald-400 transition-all" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] text-emerald-500 font-mono mb-2 flex items-center gap-1"><Timer className="w-3 h-3"/> LOCK DURATION</label>
                    <select value={escrowDuration} onChange={e => setEscrowDuration(e.target.value)} className="w-full bg-slate-950 border border-emerald-500/30 rounded-xl p-3 text-emerald-400 font-mono text-sm focus:outline-none focus:border-emerald-400 transition-all">
                      <option value="1">1 Hour</option>
                      <option value="6">6 Hours</option>
                      <option value="24">24 Hours</option>
                      <option value="72">3 Days</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {txHash && (activeModule === 'shield' || activeModule === 'escrow') && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs font-mono break-all mt-4">
                ✅ Success! TX Hash: <br/>
                <a href={`https://testnet.arcscan.app/tx/${txHash}`} target="_blank" rel="noreferrer" className="underline hover:text-emerald-300 mt-1 inline-block">
                  {txHash}
                </a>
              </div>
            )}

            <div className="pt-4 border-t border-white/5 mt-6">
              <button 
                onClick={handleAction} 
                disabled={isExecuting}
                className={`w-full md:w-auto px-8 py-3 text-slate-950 font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 ${activeModule === 'escrow' ? 'bg-emerald-400 hover:bg-emerald-300 hover:shadow-[0_0_20px_rgba(52,211,153,0.3)]' : 'bg-white hover:bg-cyan-400 hover:shadow-[0_0_20px_rgba(34,211,238,0.3)]'}`}
              >
                <Zap className="w-4 h-4" /> 
                {isExecuting ? 'EXECUTING ONCHAIN...' : `EXECUTE ${activeData.title.split(' ')[0].toUpperCase()}`}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
                         }

  
