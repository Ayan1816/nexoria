import { useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowRight,
  Bot,
  Boxes,
  Clock3,
  Cpu,
  Gauge,
  Globe2,
  Orbit,
  ShieldCheck,
  Sparkles,
  Wallet2,
  Zap,
} from 'lucide-react';

const modules = [
  {
    id: 'delegate',
    title: 'AI Agentic Delegate',
    subtitle: 'Autonomous policy routing',
    description:
      'Deploy an intent-driven delegate that negotiates treasury moves, routes liquidity, and watches risk in real time.',
    accent: 'from-cyan-400 to-blue-500',
    icon: Bot,
    stat: '92% signal clarity',
  },
  {
    id: 'escrow',
    title: 'Time-Stream Escrow',
    subtitle: 'Programmable milestone trust',
    description:
      'Release funds on a live cadence while preserving custody, compliance, and counterparty confidence.',
    accent: 'from-emerald-400 to-cyan-400',
    icon: Clock3,
    stat: '24/7 escrow pulse',
  },
  {
    id: 'liquidity',
    title: 'Unified Liquidity Blackhole',
    subtitle: 'Concentrated flow control',
    description:
      'Bury fragmented balances into a single synthetic reserve with instant composability across chains.',
    accent: 'from-fuchsia-500 to-cyan-500',
    icon: Boxes,
    stat: '$4.8M synchronized',
  },
  {
    id: 'gas',
    title: 'Silent Gas Shield',
    subtitle: 'Zero-friction execution',
    description:
      'Absorb fee spikes through abstraction layers so execution remains clean, quiet, and economically efficient.',
    accent: 'from-violet-500 to-cyan-400',
    icon: ShieldCheck,
    stat: '0.00 gas noise',
  },
  {
    id: 'passport',
    title: 'Holographic Web3 Passport',
    subtitle: 'Portable identity mesh',
    description:
      'Carry a living, verifiable identity across dApps with privacy-preserving attestations and instant trust checks.',
    accent: 'from-cyan-300 to-slate-200',
    icon: Orbit,
    stat: 'Multi-chain verified',
  },
];

export default function App() {
  const [activeModule, setActiveModule] = useState(modules[0].id);

  const currentModule = useMemo(
    () => modules.find((module) => module.id === activeModule) ?? modules[0],
    [activeModule],
  );

  const handleActivate = () => {
    confetti({
      particleCount: 90,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#22d3ee', '#38bdf8', '#f8fafc'],
    });
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 selection:bg-cyan-500/40">
      <div className="relative isolate min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.20),_transparent_42%),radial-gradient(circle_at_bottom_right,_rgba(56,189,248,0.14),_transparent_28%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(34,211,238,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(34,211,238,0.08)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(circle_at_center,black_40%,transparent_90%)] opacity-30" />

        <div className="relative mx-auto flex max-w-7xl flex-col gap-6 rounded-[32px] border border-cyan-400/20 bg-slate-950/70 p-4 shadow-[0_0_80px_rgba(34,211,238,0.12)] backdrop-blur-2xl sm:p-6 lg:p-8">
          <header className="flex flex-col gap-4 rounded-[24px] border border-cyan-400/20 bg-slate-900/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-cyan-300">
                <Cpu className="h-3.5 w-3.5" /> ArcOS • Agentic Economic Matrix
              </div>
              <h1 className="text-3xl font-black tracking-[0.2em] text-white sm:text-4xl">
                Future-proof finance, tuned for autonomous motion.
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-slate-400 sm:text-base">
                Command liquidity, identity, and execution from a single premium cockpit built for the next era of onchain operations.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
                <div className="flex items-center gap-2 font-semibold">
                  <Zap className="h-4 w-4" /> Network live
                </div>
                <p className="mt-1 text-xs uppercase tracking-[0.3em] text-emerald-200/80">8.2ms latency</p>
              </div>
              <button
                onClick={handleActivate}
                className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-200 transition hover:-translate-y-0.5 hover:bg-cyan-400/20"
              >
                Trigger pulse
              </button>
            </div>
          </header>

          <main className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-[28px] border border-cyan-400/20 bg-slate-900/60 p-4 sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.35em] text-cyan-400">System layers</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">Choose a control surface</h2>
                </div>
                <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 p-2 text-cyan-300">
                  <Gauge className="h-5 w-5" />
                </div>
              </div>

              <div className="grid gap-3">
                {modules.map((module) => {
                  const Icon = module.icon;
                  const isActive = module.id === activeModule;
                  return (
                    <button
                      key={module.id}
                      onClick={() => setActiveModule(module.id)}
                      className={`group rounded-[20px] border p-4 text-left transition ${
                        isActive
                          ? 'border-cyan-400/50 bg-cyan-400/10 shadow-[0_0_35px_rgba(34,211,238,0.14)]'
                          : 'border-slate-800 bg-slate-950/60 hover:border-cyan-400/30 hover:bg-slate-900/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`rounded-2xl bg-gradient-to-br ${module.accent} p-2 text-slate-950`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">{module.title}</p>
                            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{module.subtitle}</p>
                          </div>
                        </div>
                        <ArrowRight className={`h-4 w-4 transition ${isActive ? 'translate-x-1 text-cyan-300' : 'text-slate-600 group-hover:text-cyan-300'}`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[28px] border border-cyan-400/20 bg-slate-900/60 p-4 sm:p-6">
              <div className="rounded-[24px] border border-cyan-400/20 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-cyan-300">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-[10px] uppercase tracking-[0.35em]">Active module</span>
                  </div>
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-cyan-200">
                    {currentModule.stat}
                  </span>
                </div>

                <div className={`rounded-[22px] border border-cyan-400/20 bg-gradient-to-br ${currentModule.accent} p-[1px]`}>
                  <div className="rounded-[21px] bg-slate-950/90 p-5">
                    <div className="mb-5 inline-flex rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-200">
                      <currentModule.icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-2xl font-semibold text-white">{currentModule.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-400">{currentModule.description}</p>

                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                        <div className="flex items-center gap-2 text-cyan-300">
                          <Wallet2 className="h-4 w-4" />
                          <span className="text-xs uppercase tracking-[0.3em]">Treasury</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-300">Protected and auto-routed</p>
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                        <div className="flex items-center gap-2 text-cyan-300">
                          <Globe2 className="h-4 w-4" />
                          <span className="text-xs uppercase tracking-[0.3em]">Reach</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-300">Cross-chain by default</p>
                      </div>
                    </div>

                    <button
                      onClick={handleActivate}
                      className="mt-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/20"
                    >
                      Activate protocol <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
