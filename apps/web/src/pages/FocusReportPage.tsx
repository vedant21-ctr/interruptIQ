import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  HelpCircle,
  RefreshCw,
  ShieldCheck,
  ZapOff,
  XCircle,
} from 'lucide-react';

const API_BASE = 'http://localhost:3001/api/v1';

interface FocusReportPageProps {
  token: string | null;
  apiBase?: string;
  report?: any | null;
  onRefreshReport?: () => void;
  loading?: boolean;
}

export function FocusReportPage({
  token,
  apiBase = API_BASE,
  report: initialReport,
  onRefreshReport: externalRefresh,
  loading: externalLoading = false,
}: FocusReportPageProps) {
  const [internalReport, setInternalReport] = useState<any | null>(initialReport || null);
  const [internalLoading, setInternalLoading] = useState<boolean>(false);
  const [submittingReviewId, setSubmittingReviewId] = useState<string | null>(null);
  const [userReviews, setUserReviews] = useState<Record<string, 'AGREE' | 'UNSURE' | 'DISAGREE'>>({});

  const report = initialReport ?? internalReport;
  const loading = externalLoading || internalLoading;

  const fetchReport = async () => {
    if (!token) return;
    setInternalLoading(true);
    try {
      const res = await axios.post(
        `${apiBase}/focus-report/generate`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setInternalReport(res.data.report);
    } catch (err) {
      console.error('Failed to generate Focus Report:', err);
    } finally {
      setInternalLoading(false);
    }
  };

  const handleRefresh = () => {
    if (externalRefresh) {
      externalRefresh();
    } else {
      fetchReport();
    }
  };

  const handleReviewSubmit = async (
    interruptionId: string,
    verdict: 'AGREE' | 'UNSURE' | 'DISAGREE'
  ) => {
    if (!token || !report) return;

    setSubmittingReviewId(interruptionId);
    try {
      await axios.post(
        `${apiBase}/focus-report/reviews`,
        {
          reportId: report.id,
          interruptionId,
          verdict,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Update local review state
      setUserReviews((prev) => ({
        ...prev,
        [interruptionId]: verdict,
      }));
    } catch (err: any) {
      console.error('Failed to submit decision review:', err);
    } finally {
      setSubmittingReviewId(null);
    }
  };

  useEffect(() => {
    if (!report && token && !loading) {
      fetchReport();
    }
  }, [token]);

  if (loading && !report) {
    return (
      <div className="p-12 text-center bg-zinc-900/40 border border-zinc-800 rounded-2xl space-y-4">
        <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin mx-auto" />
        <p className="text-xs font-semibold text-zinc-400">Evaluating Shadow Policy & Focus State Timelines...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-12 text-center bg-zinc-900/40 border border-zinc-800 rounded-2xl space-y-4">
        <Clock className="w-10 h-10 text-zinc-600 mx-auto" />
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">No Focus Report Generated</h3>
        <p className="text-xs text-zinc-500 max-w-md mx-auto">
          Click below to generate a read-only Focus Report evaluating your historical Slack and Google Calendar data against the pure Shadow Policy.
        </p>
        <button
          onClick={handleRefresh}
          className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all"
        >
          Generate Focus Report
        </button>
      </div>
    );
  }

  const metrics = report.metrics || {};
  const total = metrics.totalInterruptions?.value || 0;
  const stateCounts = metrics.interruptionsByState?.value || {
    ooo: 0,
    meeting: 0,
    focus_block: 0,
    quiet_window: 0,
    available: 0,
  };
  const outcomes = metrics.outcomeBreakdown?.value || {
    DELIVER: 0,
    DELAY_TO_MEETING_END: 0,
    DELAY_TO_BOUNDARY: 0,
    BATCH: 0,
  };

  const totalDelayed = (outcomes.DELAY_TO_MEETING_END || 0) + (outcomes.DELAY_TO_BOUNDARY || 0);
  const totalBatched = outcomes.BATCH || 0;
  const avoidableSharePct = Math.round((metrics.estimatedAvoidableShare?.value || 0) * 100);

  const startDateStr = new Date(report.periodStart).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const endDateStr = new Date(report.periodEnd).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Period */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-violet-400" />
            <h2 className="text-lg font-black tracking-tight text-white">
              Focus Report <span className="text-xs px-2 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 text-violet-400 font-mono">v0 Shadow Mode</span>
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-zinc-500" />
            Reporting Period: <span className="font-semibold text-zinc-200">{startDateStr} – {endDateStr}</span>
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={loading}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-xs font-bold uppercase tracking-wider text-zinc-200 rounded-xl flex items-center gap-2 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Report
        </button>
      </div>

      {/* 2. Key High-Level Metrics Matrix */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-zinc-900/40 border border-zinc-800/80 p-4 rounded-xl">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Total pings</p>
          <p className="text-xl font-black text-white mt-1">{total}</p>
          <p className="text-[9px] text-zinc-600 mt-0.5">Notification candidates</p>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-800/80 p-4 rounded-xl">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Delivered</p>
          <p className="text-xl font-black text-emerald-400 mt-1">{outcomes.DELIVER || 0}</p>
          <p className="text-[9px] text-zinc-600 mt-0.5">Immediate delivery</p>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-800/80 p-4 rounded-xl">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Delayed</p>
          <p className="text-xl font-black text-violet-400 mt-1">{totalDelayed}</p>
          <p className="text-[9px] text-zinc-600 mt-0.5">Meeting / boundary delay</p>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-800/80 p-4 rounded-xl">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Batched</p>
          <p className="text-xl font-black text-amber-400 mt-1">{totalBatched}</p>
          <p className="text-[9px] text-zinc-600 mt-0.5">Next batch window</p>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-800/80 p-4 rounded-xl col-span-2 md:col-span-1">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Avoidable Share</p>
          <p className="text-xl font-black text-fuchsia-400 mt-1">{avoidableSharePct}%</p>
          <p className="text-[9px] text-zinc-600 mt-0.5">Potential flow protection</p>
        </div>
      </div>

      {/* 3. Breakdown Grids: Focus State & Shadow Outcome */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Focus State Distribution */}
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5">
          <h3 className="text-xs font-bold uppercase text-zinc-400 tracking-widest mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-violet-400" />
            Interruptions by Focus State
          </h3>
          <div className="space-y-2.5">
            {[
              { label: 'Meeting', count: stateCounts.meeting, color: 'bg-red-500/15 border-red-500/30 text-red-400' },
              { label: 'Focus Block', count: stateCounts.focus_block, color: 'bg-violet-500/15 border-violet-500/30 text-violet-400' },
              { label: 'Quiet Window (Proxy)', count: stateCounts.quiet_window, color: 'bg-amber-500/15 border-amber-500/30 text-amber-400' },
              { label: 'Available', count: stateCounts.available, color: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' },
              { label: 'Out of Office (OOO)', count: stateCounts.ooo, color: 'bg-zinc-800 border-zinc-700 text-zinc-400' },
            ].map((item) => (
              <div key={item.label} className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl flex justify-between items-center">
                <span className="text-xs font-semibold text-zinc-300">{item.label}</span>
                <span className={`text-xs font-black px-2.5 py-0.5 rounded border ${item.color}`}>
                  {item.count || 0}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Counterfactual Policy Outcomes */}
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5">
          <h3 className="text-xs font-bold uppercase text-zinc-400 tracking-widest mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-fuchsia-400" />
            Counterfactual Shadow Outcomes
          </h3>
          <div className="space-y-2.5">
            {[
              { label: 'Delivered Immediately', code: 'DELIVER', count: outcomes.DELIVER, color: 'text-emerald-400' },
              { label: 'Delayed to Meeting End', code: 'DELAY_TO_MEETING_END', count: outcomes.DELAY_TO_MEETING_END, color: 'text-violet-400' },
              { label: 'Delayed to Focus Boundary', code: 'DELAY_TO_BOUNDARY', count: outcomes.DELAY_TO_BOUNDARY, color: 'text-fuchsia-400' },
              { label: 'Batched into Batch Window', code: 'BATCH', count: outcomes.BATCH, color: 'text-amber-400' },
            ].map((item) => (
              <div key={item.code} className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl flex justify-between items-center">
                <div>
                  <span className="text-xs font-semibold text-zinc-300">{item.label}</span>
                  <span className="block text-[9px] font-mono text-zinc-500 mt-0.5">{item.code}</span>
                </div>
                <span className={`text-sm font-black ${item.color}`}>
                  {item.count || 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Primary Dogfooding Research Interface: Sampled Review Queue */}
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 pb-4 border-b border-zinc-800">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ZapOff className="w-4 h-4 text-amber-400" />
              Sampled Policy Decisions Review Queue
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Review counterfactual delays to validate whether the Shadow Policy decision was reasonable.
            </p>
          </div>
          <div className="text-xs px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 font-semibold rounded-lg flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5" />
            Evaluation Prompt: "Would this decision have been reasonable?"
          </div>
        </div>

        {report.sampledReviewQueue && report.sampledReviewQueue.length > 0 ? (
          <div className="space-y-4 pt-2">
            {report.sampledReviewQueue.map((item: any, idx: number) => {
              const record = item.interruption;
              const decision = item.decision;
              const existingReview = item.existingReview;

              const activeVerdict =
                userReviews[record.id] ||
                (existingReview
                  ? existingReview.verdict === 'hurt'
                    ? 'DISAGREE'
                    : existingReview.verdict === 'fine'
                    ? 'AGREE'
                    : 'UNSURE'
                  : null);

              const timeStr = new Date(record.receivedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={record.id || idx}
                  className="p-5 bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 rounded-xl space-y-4 transition-all"
                >
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
                        #{idx + 1}
                      </span>
                      <span className="text-xs font-bold text-white">
                        Slack ping ({record.channelType || 'public'})
                      </span>
                      <span className="text-[10px] text-zinc-500">at {timeStr}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold text-zinc-400 px-2 py-0.5 bg-zinc-800 rounded">
                        State: {record.stateAtArrival || 'meeting'}
                      </span>
                      {record.slackPermalink && (
                        <a
                          href={record.slackPermalink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1 hover:underline"
                        >
                          Open in Slack <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="p-3 bg-zinc-950/60 border border-zinc-850 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                    <div>
                      <p className="text-xs font-semibold text-zinc-300">
                        Suggested Shadow Outcome:{' '}
                        <span className="font-bold text-violet-400">{decision.outcome}</span>
                      </p>
                      <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                        Reason: {decision.reasonCode}
                      </p>
                    </div>

                    {record.hasUrgencySignal && (
                      <span className="text-[10px] font-bold text-amber-400 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded">
                        Urgency Signal Detected
                      </span>
                    )}
                  </div>

                  {/* Structured Feedback Buttons */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-zinc-400 font-medium">
                      Would this delay have been reasonable?
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleReviewSubmit(record.id, 'AGREE')}
                        disabled={submittingReviewId === record.id}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                          activeVerdict === 'AGREE'
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'bg-zinc-800 hover:bg-zinc-750 text-zinc-300 border border-zinc-700'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Agree
                      </button>

                      <button
                        onClick={() => handleReviewSubmit(record.id, 'UNSURE')}
                        disabled={submittingReviewId === record.id}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                          activeVerdict === 'UNSURE'
                            ? 'bg-amber-600 text-white shadow-md'
                            : 'bg-zinc-800 hover:bg-zinc-750 text-zinc-300 border border-zinc-700'
                        }`}
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        Unsure
                      </button>

                      <button
                        onClick={() => handleReviewSubmit(record.id, 'DISAGREE')}
                        disabled={submittingReviewId === record.id}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                          activeVerdict === 'DISAGREE'
                            ? 'bg-rose-600 text-white shadow-md'
                            : 'bg-zinc-800 hover:bg-zinc-750 text-zinc-300 border border-zinc-700'
                        }`}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Disagree
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center bg-zinc-950/40 rounded-xl border border-zinc-850">
            <p className="text-xs text-zinc-500">
              No counterfactual delays sampled in this report period (or 0 total interruptions observed).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
