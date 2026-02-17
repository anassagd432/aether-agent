import React from 'react';
import { ArrowLeft, Brain, Globe2, Zap, Users, Code } from 'lucide-react';

interface AboutProps {
    onBack: () => void;
}

const About: React.FC<AboutProps> = ({ onBack }) => {
    return (
        <div className="min-h-screen bg-transparent text-white pt-20 pb-16">
            <div className="max-w-4xl mx-auto px-6">

                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8 group"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Back to Home
                </button>

                <h1 className="text-4xl md:text-6xl font-bold mb-6">
                    Building the <span className="text-cyan-400">Autonomous</span> Future
                </h1>

                <p className="text-xl text-slate-400 mb-16 leading-relaxed max-w-2xl">
                    Agdi is not just another copilot. It's an autonomous software architect that lives in your browser. We believe coding should be about <span className="text-white font-semibold">intent</span>, not syntax.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
                    <div className="p-8 bg-slate-900/50 rounded-2xl border border-white/5 hover:border-cyan-500/30 transition-colors">
                        <Brain className="w-8 h-8 text-cyan-400 mb-4" />
                        <h3 className="text-xl font-bold mb-2">Neural Architecture</h3>
                        <p className="text-slate-400">Our agents don't just autocomplete. They plan, reason, and verify their own work using a sophisticated multi-agent swarm.</p>
                    </div>
                    <div className="p-8 bg-slate-900/50 rounded-2xl border border-white/5 hover:border-cyan-500/30 transition-colors">
                        <Globe2 className="w-8 h-8 text-cyan-400 mb-4" />
                        <h3 className="text-xl font-bold mb-2">Universal Access</h3>
                        <p className="text-slate-400">We removed the login wall. We open-sourced the core. We believe powerful AI tools should be accessible to everyone, instantly.</p>
                    </div>
                </div>

                <section className="mb-20">
                    <h2 className="text-3xl font-bold mb-8">Our Philosophy</h2>
                    <div className="space-y-6 text-slate-300 leading-relaxed text-lg">
                        <p>
                            Software development has become too complex. The toolchain is bloated. The learning curve is steep.
                            We are stripping it all away.
                        </p>
                        <p>
                            With Agdi, you don't configure Webpack. You don't debug Docker containers.
                            You simply <strong>describe your idea</strong>, and our agents build it.
                        </p>
                    </div>
                </section>

                <div className="p-8 rounded-3xl bg-gradient-to-r from-cyan-950/30 to-amber-950/30 border border-cyan-500/20 text-center">
                    <h2 className="text-2xl font-bold mb-4">Join the Revolution</h2>
                    <p className="text-slate-300 mb-6 max-w-lg mx-auto">
                        We are a small team of engineers building the tools we wish we had.
                    </p>
                    <div className="flex justify-center gap-4">
                        <a href="https://github.com/anassagd/Agdi.ai" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-6 py-3 bg-white text-slate-950 rounded-xl font-bold hover:bg-cyan-50 transition-colors">
                            <Code className="w-4 h-4" />
                            Star on GitHub
                        </a>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default About;
