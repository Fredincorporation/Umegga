import React, { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { X, Bot, Play, CheckCircle2, AlertCircle, Code, Terminal, Sparkles } from 'lucide-react';

export const WebMCPConsole: React.FC = () => {
  const { activePanel, setActivePanel, mcpLogs } = useGameStore();

  const [selectedTool, setSelectedTool] = useState<string>('query_world_state');
  const [paramsJson, setParamsJson] = useState<string>('{}');
  const [lastResult, setLastResult] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (activePanel !== 'mcp_console') return null;

  const toolsList = typeof window !== 'undefined' && window.umegaMCP
    ? window.umegaMCP.getTools()
    : [];

  const handleSelectTool = (toolName: string) => {
    setSelectedTool(toolName);
    setErrorMessage(null);

    // Provide default template payload based on tool
    if (toolName === 'query_world_state') {
      setParamsJson('{}');
    } else if (toolName === 'propose_story') {
      setParamsJson(
        JSON.stringify(
          {
            title: 'The Great Aether Alignment',
            content: 'The stars aligned in an unprecedented harmonic pattern above Umega.',
            impact: 'Ambient mana capacity tripled across the sanctuary.',
            visualEffect: 'aurora',
          },
          null,
          2
        )
      );
    } else if (toolName === 'propose_law') {
      setParamsJson(
        JSON.stringify(
          {
            title: 'Decree of Swiftness',
            edict: 'Movement velocities increased by 40%.',
            category: 'Reality Edict',
            effectType: 'speed_boost',
            magnitude: 1.4,
          },
          null,
          2
        )
      );
    } else if (toolName === 'spawn_agent') {
      setParamsJson(
        JSON.stringify(
          {
            characterId: 'vance',
            name: 'Vance Goldspire',
            role: 'Guildmaster of Trade',
            x: 500,
            y: 500,
          },
          null,
          2
        )
      );
    } else if (toolName === 'move_agent') {
      setParamsJson(
        JSON.stringify(
          {
            agentId: 'agent_torren',
            x: 600,
            y: 350,
          },
          null,
          2
        )
      );
    } else if (toolName === 'narrate_event') {
      setParamsJson(
        JSON.stringify(
          {
            narrator: 'Cosmic Oracle',
            message: 'A surge of starlight has touched the center monolith!',
          },
          null,
          2
        )
      );
    } else if (toolName === 'set_weather') {
      setParamsJson(
        JSON.stringify(
          {
            weather: 'aurora',
          },
          null,
          2
        )
      );
    }
  };

  const handleExecute = async () => {
    if (!window.umegaMCP) return;
    setIsExecuting(true);
    setErrorMessage(null);

    try {
      const parsedArgs = JSON.parse(paramsJson);
      const res = await window.umegaMCP.callTool(selectedTool, parsedArgs);
      setLastResult(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Execution error');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-3xl bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 shadow-2xl relative text-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-950 border border-emerald-500/40 text-emerald-400">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-fantasy font-bold text-lg text-emerald-300">WebMCP Agent Protocol</h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/30 text-emerald-300 font-mono">
                  document.modelContext
                </span>
              </div>
              <p className="text-xs text-slate-400">Interact directly with registered LLM agent tools</p>
            </div>
          </div>
          <button
            onClick={() => setActivePanel('none')}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Console Layout: Left Tools List / Right Execution & Logs */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 overflow-hidden text-xs">
          {/* Left: Registered Tools */}
          <div className="md:col-span-4 bg-slate-950/60 border border-slate-800 rounded-2xl p-3 flex flex-col overflow-y-auto space-y-1.5">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Code className="w-3.5 h-3.5 text-emerald-400" />
              Registered Tools ({toolsList.length})
            </div>
            {toolsList.map((tool) => (
              <button
                key={tool.name}
                onClick={() => handleSelectTool(tool.name)}
                className={`p-2.5 rounded-xl text-left transition-all cursor-pointer ${
                  selectedTool === tool.name
                    ? 'bg-emerald-950/80 border border-emerald-500 text-emerald-200 shadow-md font-semibold'
                    : 'bg-slate-800/40 hover:bg-slate-800 border border-slate-700/50 text-slate-300'
                }`}
              >
                <div className="font-mono text-xs">{tool.name}</div>
                <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{tool.description}</div>
              </button>
            ))}
          </div>

          {/* Right: Parameters Editor & Execution Output */}
          <div className="md:col-span-8 flex flex-col gap-3 overflow-hidden">
            {/* Parameters Editor */}
            <div className="flex-1 flex flex-col bg-slate-950/80 border border-slate-800 rounded-2xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                  <Terminal className="w-3.5 h-3.5" />
                  tool: {selectedTool}(args)
                </span>
                <button
                  onClick={handleExecute}
                  disabled={isExecuting}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  {isExecuting ? 'Invoking...' : 'Execute Tool'}
                </button>
              </div>

              <textarea
                value={paramsJson}
                onChange={(e) => setParamsJson(e.target.value)}
                rows={5}
                className="w-full bg-slate-900 border border-slate-700 font-mono text-[11px] text-emerald-300 p-2.5 rounded-xl focus:outline-none focus:border-emerald-400 resize-none"
              />

              {/* Execution Status / Output */}
              {errorMessage && (
                <div className="mt-2 p-2 bg-red-950/60 border border-red-500/40 rounded-xl text-red-300 text-[11px] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {lastResult && !errorMessage && (
                <div className="mt-2 p-2.5 bg-slate-900 border border-emerald-500/30 rounded-xl max-h-24 overflow-y-auto">
                  <div className="text-[10px] text-emerald-400 font-semibold mb-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Response Payload:
                  </div>
                  <pre className="font-mono text-[10px] text-slate-300 whitespace-pre-wrap">
                    {JSON.stringify(lastResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* MCP Execution Logs */}
            <div className="h-32 bg-slate-950/80 border border-slate-800 rounded-2xl p-3 flex flex-col overflow-hidden">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                Live Tool Execution Stream ({mcpLogs.length})
              </div>
              <div className="flex-1 overflow-y-auto space-y-1 pr-1 font-mono text-[10px]">
                {mcpLogs.length === 0 ? (
                  <div className="text-slate-500 italic">No tools invoked yet.</div>
                ) : (
                  mcpLogs.map((log) => (
                    <div key={log.id} className="text-slate-300 bg-slate-900/60 p-1.5 rounded-lg">
                      <span className="text-emerald-400">[{log.timestamp}]</span>{' '}
                      <span className="text-amber-300 font-bold">{log.tool}</span>:{' '}
                      <span className="text-slate-400">{JSON.stringify(log.args)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
