
import React from 'react';

const Dedication: React.FC = () => {
  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center pt-24 pb-12 overflow-hidden">
      {/* Content Container */}
      <div className="relative z-10 container mx-auto px-6 max-w-4xl text-center">
        <div className="inline-block mb-8">
           <span className="px-4 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-amber-200 text-xs font-mono tracking-[0.2em] uppercase backdrop-blur-md">
             Manifesto
           </span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tighter mb-12 leading-tight drop-shadow-2xl">
          To The <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 to-cyan-400">
            Builders of Tomorrow
          </span>
        </h1>

        <div className="space-y-8 text-lg md:text-xl text-slate-300 leading-relaxed font-light drop-shadow-md">
          <p>
            We dedicate Agdi to those who dream in code and design. To the visionaries who see a blank canvas not as emptiness, but as infinite potential.
          </p>
          <p>
            The gap between imagination and implementation has always been the greatest friction in software. We built Agdi to erase that gap. We believe that your ability to create should be limited only by your ability to think, not by the syntax you memorize or the boilerplate you type.
          </p>
          <p className="text-white font-medium">
            This is not just a tool. It is a tribute to human creativity, amplified by machine intelligence.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
           <div className="p-6 rounded-2xl bg-slate-900/40 border border-white/10 backdrop-blur-md shadow-xl">
             <div className="text-2xl mb-4">🚀</div>
             <h3 className="text-lg font-bold text-white mb-2">Velocity</h3>
             <p className="text-sm text-slate-400">From idea to deployment in seconds, not weeks.</p>
           </div>
           <div className="p-6 rounded-2xl bg-slate-900/40 border border-white/10 backdrop-blur-md shadow-xl">
             <div className="text-2xl mb-4">💎</div>
             <h3 className="text-lg font-bold text-white mb-2">Quality</h3>
             <p className="text-sm text-slate-400">Code that is clean, maintainable, and production-ready.</p>
           </div>
           <div className="p-6 rounded-2xl bg-slate-900/40 border border-white/10 backdrop-blur-md shadow-xl">
             <div className="text-2xl mb-4">🧠</div>
             <h3 className="text-lg font-bold text-white mb-2">Freedom</h3>
             <p className="text-sm text-slate-400">Focus on the 'what' and 'why', let AI handle the 'how'.</p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Dedication;
