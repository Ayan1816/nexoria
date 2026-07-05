import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Bot, ShieldAlert, Activity, Terminal, Zap, LogOut, Sun, Moon, 
  Cpu, ArrowRight, ShieldCheck, CheckCircle, History, Droplet, RefreshCw
} from 'lucide-react';

const modules = [
  { id: 'ai_batch', title: 'AI Batch Delegate', subtitle: 'MULTI-TX AUTONOMY', description: 'Command the AI to execute multiple transactions across different assets simultaneously.', accent: 'from-cyan-400 to-blue-500', icon: Bot, stat: 'AI CORE' },
  { id: 'history', title: 'Transaction Ledger', subtitle: 'ON-CHAIN RECEIPTS', description: 'Real-time history of all your executed transactions and transfers in this session.', accent: 'from-teal-400 to-emerald-500', icon: History, stat: 'LIVE SYNC' },
  { id: 'security', title: 'Token Security Matrix', subtitle: 'SMART REVOKE', description: 'Scan and revoke third-party smart contract allowances to protect your liquidity.', accent: 'from-amber-400 to-rose-500', icon: ShieldAlert, stat: 'SCANNER' },
  { id: 'telemetry', title: 'Arc Network Telemetry', subtitle: 'LIVE NODE DATA', description: 'Direct RPC feed from Arc Testnet showing real-time block generation and gas metrics.', accent: 'from-emerald-400 to-teal-500', icon: Activity, stat: 'LIVE SYNC' }
];

const EURC_CONTRACT_ADDRESS = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";
const arcChainIdHex = '0x4cef52';

export default function App() {
  const [isDark, setIsDark] = useState(true);
  const [activeModule, setActiveModule] = useState(modules[0].id);
  
  const [walletAddress, setWalletAddress] = useState(null);
  const [activeProvider, setActiveProvider] = useState(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const [balance, setBalance] = useState('0.00');
  const [eurcBalance, setEurcBalance] = useState('0.00');
  
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [txHistory, setTxHistory] = useState([]);
  const terminalEndRef = useRef(null);

  const [aiCommand, setAiCommand] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [blockNumber, setBlockNumber] = useState('SYNCING...');
  const [gasPrice, setGasPrice] = useState('SYNCING...');
  const [spenderAddress, setSpenderAddress] = useState('');
  const [currentAllowance, setCurrentAllowance] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (terminalEndRef.current) terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [terminalLogs]);
    const addLog = (msg, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    setTerminalLogs(prev => [...prev, { time, msg, type }]);
  };

  const fetchNetworkData = async (provider) => {
    try {
      const blockHex = await provider.request({ method: 'eth_blockNumber' });
      const gasHex = await provider.request({ method: 'eth_gasPrice' });
      setBlockNumber(parseInt(blockHex, 16).toString());
      setGasPrice((parseInt(gasHex, 16) / 1e9).toFixed(4) + ' Gwei');
    } catch (e) { console.log(e); }
  };

  const updateBalances = async () => {
    if (!activeProvider || !walletAddress) return;
    try {
      addLog(`Refreshing balances...`, 'process');
      const balHex = await activeProvider.request({ method: 'eth_getBalance', params: [walletAddress, 'latest'] });
      setBalance((parseInt(balHex, 16) / 1e18).toFixed(4));
      
      const ethersProvider = new window.ethers.BrowserProvider(activeProvider);
      const eurcContract = new window.ethers.Contract(EURC_CONTRACT_ADDRESS, ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"], ethersProvider);
      const eurcBal = await eurcContract.balanceOf(walletAddress);
      const decimals = await eurcContract.decimals();
      setEurcBalance(parseFloat(window.ethers.formatUnits(eurcBal, decimals)).toFixed(2));
      addLog(`Balances synced successfully.`, 'success');
    } catch (e) { addLog(`Balance sync error: ${e.message}`, 'error'); }
  };

  useEffect(() => {
    let interval;
    if (activeProvider && activeModule === 'telemetry') {
      fetchNetworkData(activeProvider);
      interval = setInterval(() => fetchNetworkData(activeProvider), 3000);
    }
    return () => clearInterval(interval);
  }, [activeProvider, activeModule]);
    const executeConnection = async (targetProvider) => {
    try {
      setIsConnecting(true); 
      setShowWalletModal(false); 
      
      const accounts = await targetProvider.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];
      const currentChain = await targetProvider.request({ method: 'eth_chainId' });
      
      if (currentChain.toLowerCase() !== arcChainIdHex.toLowerCase()) {
        try { await targetProvider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: arcChainIdHex }] }); }
        catch (e) {
            await targetProvider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: arcChainIdHex, chainName: 'Arc Testnet', rpcUrls: ['https://rpc.testnet.arc.network'], nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 } }] });
        }
      }
      
      setActiveProvider(targetProvider);
      setWalletAddress(address);
      setIsConnecting(false);
      // Wait for provider to settle
      setTimeout(() => updateBalances(), 1000);
      addLog(`Wallet Connected: ${address}`, 'success');
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.3 } });
    } catch (error) { 
      setIsConnecting(false); 
      addLog(`Connection failed: ${error.message}`, 'error'); 
    }
  };

  const handleProviderSelect = (type) => {
    if (!window.ethereum) return alert("No wallet installed!");
    const provs = window.ethereum.providers || [window.ethereum];
    let chosen = window.ethereum;
    if (type === 'rabby') chosen = provs.find(p => p.isRabby) || window.ethereum;
    else if (type === 'metamask') chosen = provs.find(p => p.isMetaMask && !p.isRabby) || window.ethereum;
    executeConnection(chosen);
  };
    const handleAiCommand = async () => {
    if (!aiCommand || !activeProvider) return;
    addLog(`[AI INPUT] ${aiCommand}`, 'info');
    setIsAiProcessing(true);
    
    // Improved Regex to find "Send X to Y" commands even without "and"
    const regex = /send\s+([\d.]+)\s*(usdc|eurc)?\s+(?:to\s+)?(0x[a-fA-F0-9]{40})/gi;
    let match;
    let intents = [];
    
    while ((match = regex.exec(aiCommand)) !== null) {
      intents.push({
        amount: match[1],
        token: (match[2] || 'USDC').toUpperCase(),
        to: match[3]
      });
    }

    if (intents.length === 0) {
      addLog(`AI didn't understand. Format: "Send 1 USDC to 0x... and Send 2 EURC to 0x..."`, 'warning');
      setIsAiProcessing(false);
      return;
    }

    for (let i = 0; i < intents.length; i++) {
      const intent = intents[i];
      addLog(`[Task ${i+1}/${intents.length}] Executing: Send ${intent.amount} ${intent.token} to ${intent.to.substring(0,6)}...`, 'process');
      
      try {
        let txHash;
        if (intent.token === 'USDC') {
          const val = BigInt(Math.floor(parseFloat(intent.amount) * 1e18)).toString(16);
          txHash = await activeProvider.request({ method: 'eth_sendTransaction', params: [{ from: walletAddress, to: intent.to, value: '0x' + val }] });
        } else {
          const provider = new window.ethers.BrowserProvider(activeProvider);
          const signer = await provider.getSigner();
          const contract = new window.ethers.Contract(EURC_CONTRACT_ADDRESS, ["function transfer(address, uint256) returns (bool)", "function decimals() view returns (uint8)"], signer);
          const decimals = await contract.decimals();
          const tx = await contract.transfer(intent.to, window.ethers.parseUnits(intent.amount, decimals));
          txHash = tx.hash;
        }
        addLog(`[Task ${i+1}/${intents.length}] Success! TX: ${txHash}`, 'success');
        setTxHistory(prev => [{ id: Date.now() + i, hash: txHash, amount: intent.amount, token: intent.token, to: intent.to, time: new Date().toLocaleTimeString() }, ...prev]);
      } catch(e) { 
        addLog(`[Task ${i+1}/${intents.length}] Failed or Rejected.`, 'error');
        break; 
      }
    }
    confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
    setTimeout(() => updateBalances(), 3000);
    setAiCommand('');
    setIsAiProcessing(false);
  };
    return (
    <div className={`min-h-screen font-sans transition-colors duration-500 ${isDark ? 'bg-slate-950 text-slate-200' : 'bg-slate-100 text-slate-800'}`}>
      {/* Wallet Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 max-w-sm w-full space-y-4">
            <div className="flex justify-between items-center text-white font-bold"><span>Select Web3 Wallet</span><button onClick={() => setShowWalletModal(false)}>✕</button></div>
            <button onClick={() => handleProviderSelect('rabby')} className="w-full p-4 bg-slate-950 hover:bg-slate-800 border border-white/5 rounded-xl text-cyan-400 font-bold">Rabby Wallet</button>
            <button onClick={() => handleProviderSelect('metamask')} className="w-full p-4 bg-slate-950 hover:bg-slate-800 border border-white/5 rounded-xl text-amber-400 font-bold">MetaMask</button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className={`border-b backdrop-blur-md sticky top-0 z-40 ${isDark ? 'bg-slate-950/80 border-white/5' : 'bg-white/90 border-slate-300'}`}>
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold tracking-widest"><Cpu className="text-cyan-500" />ARC<span className="text-cyan-500">OS</span></div>
          {walletAddress ? (
            <button onClick={() => { setWalletAddress(null); setTerminalLogs([]); }} className="px-4 py-2 rounded-lg bg-red-500/10 text-red-500 text-sm font-bold border border-red-500/20">DISCONNECT</button>
          ) : (
            <button onClick={() => setShowWalletModal(true)} className="px-5 py-2 rounded-lg bg-cyan-500 text-slate-950 font-bold text-sm">CONNECT WALLET</button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Asset Telemetry Hero */}
        <section className={`border rounded-2xl p-6 md:p-8 ${isDark ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-300'}`}>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h1 className="text-3xl font-bold">Asset Telemetry</h1>
            <div className="flex gap-2">
              <button onClick={updateBalances} className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700"><RefreshCw className="w-4 h-4" /></button>
              <button onClick={() => window.open('https://faucet.circle.com/', '_blank')} className="px-4 py-2 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg text-xs font-bold flex items-center gap-2"><Droplet className="w-4 h-4" /> TEST FAUCET</button>
            </div>
          </div>
          <div className="mt-6 p-4 rounded-xl bg-slate-950 border border-white/10">
            <div className="flex justify-between text-xs font-mono mb-2"><span>USDC: {balance}</span><span>EURC: {eurcBalance}</span></div>
            <div className="h-3 w-full rounded-full bg-slate-800 overflow-hidden flex">
              <div style={{ width: `${(parseFloat(balance)/(parseFloat(balance)+parseFloat(eurcBalance)||1))*100}%` }} className="h-full bg-cyan-500"></div>
              <div style={{ width: `${(parseFloat(eurcBalance)/(parseFloat(balance)+parseFloat(eurcBalance)||1))*100}%` }} className="h-full bg-fuchsia-500"></div>
            </div>
          </div>
        </section>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-4 space-y-3">
            {modules.map((mod) => (
              <button key={mod.id} onClick={() => setActiveModule(mod.id)} className={`w-full p-4 rounded-xl border text-left ${activeModule === mod.id ? 'bg-cyan-950/20 border-cyan-500/50' : 'bg-slate-900 border-white/5'}`}>
                <div className="flex items-center gap-2 mb-1 font-bold text-sm"><mod.icon className="w-4 h-4" />{mod.title}</div>
              </button>
            ))}
          </div>

          <div className="md:col-span-8 space-y-6">
            <section className={`border rounded-2xl p-6 ${isDark ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-300'}`}>
              
              {activeModule === 'ai_batch' && (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold">AI Batch Delegate</h3>
                  <div className="p-4 rounded-xl bg-slate-950 border border-white/10 flex flex-col gap-3">
                    <div className="flex gap-2">
                      <input type="text" value={aiCommand} onChange={(e) => setAiCommand(e.target.value)} placeholder='Try: "Send 1 USDC to 0x... and Send 2 EURC to 0x..."' className="flex-1 bg-transparent text-sm font-mono focus:outline-none" />
                      <button onClick={handleAiCommand} className="px-4 py-2 bg-cyan-500 text-slate-950 font-bold rounded-lg"><ArrowRight className="w-4 h-4" /></button>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setAiCommand('Send 1 USDC to ')} className="text-[10px] bg-slate-800 px-3 py-1 rounded-full border border-white/10">💡 Fast Send</button>
                      <button onClick={() => setAiCommand('Send 1 USDC to  and Send 2 EURC to ')} className="text-[10px] bg-slate-800 px-3 py-1 rounded-full border border-white/10">⚡ Batch Transfer</button>
                    </div>
                  </div>
                </div>
              )}

              {activeModule === 'history' && (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold">Transaction Ledger</h3>
                  {txHistory.map(tx => (
                    <div key={tx.id} className="p-3 border-b border-white/5 text-sm font-mono flex justify-between">
                      <span>{tx.amount} {tx.token} → {tx.to.substring(0,8)}...</span>
                      <a href={`https://testnet.arcscan.app/tx/${tx.hash}`} target="_blank" className="text-cyan-400">View</a>
                    </div>
                  ))}
                </div>
              )}

              {activeModule === 'security' && (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold">Security Matrix</h3>
                  <input type="text" onChange={e => setSpenderAddress(e.target.value)} placeholder="Contract Address..." className="w-full p-3 bg-slate-950 border border-white/10 rounded-lg" />
                  <button onClick={checkAllowance} className="w-full p-3 bg-amber-500/20 text-amber-500 border border-amber-500/50 font-bold rounded-lg">SCAN</button>
                </div>
              )}

              {activeModule === 'telemetry' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 bg-slate-950 border border-white/10 rounded-xl text-center"><div className="text-[10px] text-slate-500">BLOCK</div><div className="text-2xl font-bold text-cyan-500">{blockNumber}</div></div>
                  <div className="p-6 bg-slate-950 border border-white/10 rounded-xl text-center"><div className="text-[10px] text-slate-500">GAS</div><div className="text-2xl font-bold text-emerald-500">{gasPrice}</div></div>
                </div>
              )}
            </section>

            <section className="bg-black border border-cyan-500/30 rounded-2xl overflow-hidden">
              <div className="bg-slate-900 p-2 text-[10px] font-mono text-slate-400">SYSTEM TERMINAL</div>
              <div className="p-4 h-40 overflow-y-auto font-mono text-xs space-y-1">
                {terminalLogs.map((log, i) => <div key={i} className="text-slate-400">[{log.time}] {log.msg}</div>)}
                <div ref={terminalEndRef} />
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
