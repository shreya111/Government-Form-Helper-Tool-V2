import { useEffect, useState } from "react";
import {
  Bot,
  Loader2,
  MessageCircleQuestion,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Wand2,
} from "lucide-react";

const Card = ({ tone, Icon, title, children, testId }) => {
  const tones = {
    emerald: ["bg-white/5 border-white/10", "bg-emerald-500/20", "text-emerald-400"],
    blue: ["bg-white/5 border-white/10", "bg-blue-500/20", "text-blue-400"],
    amber: ["bg-amber-500/10 border-amber-500/20", "", "text-amber-400"],
  }[tone];
  return (
    <div className={`border rounded-2xl p-5 ${tones[0]}`} data-testid={testId}>
      <div className="flex items-center gap-2 mb-3">
        <div className={`${tones[1]} p-2 rounded-lg`}>
          <Icon className={`w-4 h-4 ${tones[2]}`} />
        </div>
        <span className={`text-xs font-bold uppercase tracking-wider ${tones[2]}`}>{title}</span>
      </div>
      {children}
    </div>
  );
};

// Normalise for loose comparison.
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Pull the quoted target out of an AI recommendation like Select 'Yes'.
const recTarget = (rec) => {
  const m = String(rec || "").match(/['"“”‘’]([^'"“”‘’]+)['"“”‘’]/);
  return m ? m[1] : rec;
};

// Map an AI recommendation to the real form option so we can apply it on the page.
const matchOption = (recommendation, options) => {
  if (!recommendation || !options?.length) return null;
  const target = norm(recTarget(recommendation));
  if (!target) return null;
  const cand = options.map((o) => ({ opt: o, l: norm(o.label), v: norm(o.value) }));
  return (
    cand.find((c) => c.l === target || c.v === target)?.opt ||
    cand.find((c) => c.v && (target === c.v || target.startsWith(c.v)))?.opt ||
    cand.find((c) => c.l && (c.l.startsWith(target) || target.startsWith(c.l)))?.opt ||
    cand.find((c) => c.l && (c.l.includes(target) || target.includes(c.l.split(" ")[0])))?.opt ||
    null
  );
};

const OptionsCard = ({ response, fieldOptions, onApply }) => {
  const [selected, setSelected] = useState(null);
  const [applied, setApplied] = useState(null);
  useEffect(() => {
    setSelected(null);
    setApplied(null);
  }, [response]);

  const matched = selected?.recommendation ? matchOption(selected.recommendation, fieldOptions) : null;

  const handleApply = () => {
    if (!matched) return;
    onApply?.(matched.value, matched.label);
    setApplied(matched.value);
  };

  return (
    <Card tone="emerald" Icon={MessageCircleQuestion} title="Which applies to you?" testId="options-card">
      <p className="text-sm text-white/70 mb-4">{response.clarification_question}</p>
      <div className="space-y-2">
        {response.question_options.map((opt, idx) => {
          const active = selected?.value === opt.value;
          return (
            <button
              key={idx}
              onClick={() => setSelected(opt)}
              data-testid={`option-btn-${idx}`}
              className={`w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-colors ${
                active ? "border-emerald-500/50 bg-emerald-500/10" : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
              }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${active ? "bg-emerald-500 text-white" : "border-2 border-white/20"}`}>
                {active && <CheckCircle2 className="w-3 h-3" />}
              </div>
              <span className={`text-sm ${active ? "text-emerald-400 font-medium" : "text-white/70"}`}>{opt.label}</span>
            </button>
          );
        })}
      </div>
      {selected?.recommendation && (
        <div className="mt-4 p-4 bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 border border-emerald-500/30 rounded-xl" data-testid="recommendation-box">
          <div className="flex items-start gap-3">
            <div className="bg-emerald-500 p-1.5 rounded-lg">
              <ChevronRight className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Select This</span>
              <p className="text-sm font-semibold text-white mt-1">{selected.recommendation}</p>
            </div>
          </div>
          {matched && onApply && (
            <button
              onClick={handleApply}
              disabled={applied === matched.value}
              data-testid="apply-recommendation-btn"
              className={`mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                applied === matched.value
                  ? "bg-emerald-500/20 text-emerald-300 cursor-default"
                  : "bg-emerald-500 text-white hover:bg-emerald-400"
              }`}
            >
              {applied === matched.value ? (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Applied to form
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" /> Apply "{matched.label}"
                </>
              )}
            </button>
          )}
        </div>
      )}
    </Card>
  );
};

export const FieldHelpTab = ({ activeField, activeSection, isLoading, response, error, fieldOptions, onApply }) => (
  <>
    {activeField && (
      <div className="bg-gradient-to-r from-blue-500/10 to-emerald-500/10 border-b border-white/10 px-5 py-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Question</p>
          {activeSection && <p className="text-xs text-white/40 truncate max-w-[55%]" data-testid="panel-section">{activeSection}</p>}
        </div>
        <p className="text-sm font-medium text-white" data-testid="panel-question">{activeField}</p>
      </div>
    )}

    <div className="flex-1 overflow-y-auto p-5">
      {isLoading ? (
        <div className="space-y-4" data-testid="panel-loading">
          <div className="flex items-center gap-3 mb-4">
            <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
            <span className="text-sm text-white/60">Analyzing question...</span>
          </div>
          <div className="h-24 bg-white/5 rounded-xl animate-pulse" />
          <div className="h-20 bg-white/5 rounded-xl animate-pulse" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="panel-error">
          <div className="bg-red-500/10 p-4 rounded-2xl mb-4">
            <AlertTriangle className="w-10 h-10 text-red-400" />
          </div>
          <h4 className="text-lg font-bold text-white mb-2">Something went wrong</h4>
          <p className="text-sm text-white/50">{error}</p>
        </div>
      ) : response ? (
        <div className="space-y-4">
          {response.needs_interaction && response.question_options?.length > 0 ? (
            <OptionsCard response={response} fieldOptions={fieldOptions} onApply={onApply} />
          ) : (
            <Card tone="blue" Icon={Lightbulb} title="Expert Advice" testId="advice-card">
              <p className="text-sm text-white/70 leading-relaxed">{response.advice}</p>
            </Card>
          )}
          {response.warning && (
            <Card tone="amber" Icon={AlertTriangle} title="Important" testId="warning-card">
              <p className="text-sm text-white/70">{response.warning}</p>
            </Card>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="panel-idle">
          <div className="bg-white/5 p-5 rounded-2xl mb-5">
            <Bot className="w-12 h-12 text-white/30" />
          </div>
          <h4 className="text-lg font-bold text-white mb-2">Ready to Help!</h4>
          <p className="text-sm text-white/50 max-w-[240px]">Click on any form field to get guidance.</p>
        </div>
      )}
    </div>
  </>
);
