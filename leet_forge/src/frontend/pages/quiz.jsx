import './quiz.css';
import { useState, useEffect } from 'react';
import { fetch_recent_solved_problems, fetch_profile, fetch_problem_details } from '../services/fetch_problems.js';
import { evaluateApproach } from '../services/check_approach.js';

const LIMIT = 40;
const STORAGE_KEY_BASE = 'leetForgeMetrics';

function getMetricsStorageKey() {
  const username = localStorage.getItem('username');
  return username ? `${STORAGE_KEY_BASE}-${username}` : STORAGE_KEY_BASE;
}

function shuffleArray(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  const d1 = new Date(a);
  const d2 = new Date(b);
  const diff = Math.floor((d2 - d1) / 86400000);
  return diff;
}

function parseScore(assessment) {
  const match = assessment?.match(/([0-9]+(?:\.[0-9]+)?)\s*\/\s*10/);
  return match ? Number(match[1]) : null;
}

function getProblemKey(problem) {
  return (
    problem?.titleSlug ||
    String(problem?.questionId || problem?.title || 'unknown').trim() ||
    'unknown'
  );
}

function calculateGlobalPoints(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) return 0;
  const totalPoints = sessions.reduce((sum, session) => sum + (session.points || 0), 0);
  return totalPoints / sessions.length;
}

function computeStreak(sessions, todayKey) {
  const dateSet = new Set(sessions.map((session) => session.date));
  let streak = 0;
  const cursor = new Date(todayKey);
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (dateSet.has(key)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    break;
  }
  return streak;
}

function buildHeatmap(sessions) {
  const today = new Date();
  const days = [];
  for (let i = 27; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    const session = sessions.find((item) => item.date === key);
    days.push({
      date: key,
      points: session?.points || 0,
      attended: Boolean(session),
    });
  }
  return days;
}

function loadStoredMetrics() {
  try {
    const raw = localStorage.getItem(getMetricsStorageKey());
    const parsed = raw ? JSON.parse(raw) : {};
    const sessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
    const bestScores = parsed.bestScores || {};
    const today = getTodayKey();
    if (!sessions.some((session) => session.date === today)) {
      sessions.push({
        date: today,
        points: 0,
        evaluations: 0,
        penalties: 0,
        attended: true,
      });
    }
    const currentSession = sessions.find((session) => session.date === today) || {};
    const currentStreak = computeStreak(sessions, today);
    const bestStreak = Math.max(Number(parsed.bestStreak) || 0, currentStreak);
    return {
      sessions,
      currentSessionDate: today,
      currentSessionPoints: currentSession.points || 0,
      currentStreak,
      bestStreak,
      skipStreak: Number(parsed.skipStreak) || 0,
      globalPoints: calculateGlobalPoints(sessions),
      heatmap: buildHeatmap(sessions),
      bestScores,
    };
  } catch (error) {
    console.error('Load metrics error:', error);
    return {
      sessions: [],
      currentSessionDate: getTodayKey(),
      currentSessionPoints: 0,
      currentStreak: 0,
      bestStreak: 0,
      skipStreak: 0,
      globalPoints: 0,
      heatmap: [],
      bestScores: {},
    };
  }
}

function saveStoredMetrics(metrics) {
  try {
    const copy = {
      sessions: metrics.sessions,
      currentStreak: metrics.currentStreak,
      bestStreak: metrics.bestStreak,
      skipStreak: metrics.skipStreak,
      bestScores: metrics.bestScores || {},
    };
    localStorage.setItem(getMetricsStorageKey(), JSON.stringify(copy));
  } catch (error) {
    console.error('Save metrics error:', error);
  }
}

export default function Quiz() {
  const [problems, setProblems] = useState([]);
  const [availableProblems, setAvailableProblems] = useState([]);
  const [currentProblem, setCurrentProblem] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loadingProblems, setLoadingProblems] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [approach_text, approach_text_setter] = useState('');
  const [assessment, setAssessment] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  const [loadingDescription, setLoadingDescription] = useState(false);
  const [problemCountMessage, setProblemCountMessage] = useState('');
  const [metrics, setMetrics] = useState(loadStoredMetrics());

  const persistMetrics = (nextMetrics) => {
    setMetrics(nextMetrics);
    saveStoredMetrics(nextMetrics);
  };

  const updateCurrentSession = (modifier) => {
    setMetrics((prev) => {
      const sessions = prev.sessions.map((session) =>
        session.date === prev.currentSessionDate ? modifier(session) : session
      );
      const currentSession = sessions.find((session) => session.date === prev.currentSessionDate) || {};
      const nextMetrics = {
        ...prev,
        sessions,
        currentSessionPoints: currentSession.points || 0,
        globalPoints: calculateGlobalPoints(sessions),
        heatmap: buildHeatmap(sessions),
      };
      saveStoredMetrics(nextMetrics);
      return nextMetrics;
    });
  };

  const applySkipPenalty = () => {
    setMetrics((prev) => {
      const penalty = 2 * (prev.skipStreak + 1);
      const sessions = prev.sessions.map((session) =>
        session.date === prev.currentSessionDate
          ? {
              ...session,
              points: (session.points || 0) - penalty,
              penalties: (session.penalties || 0) + penalty,
            }
          : session
      );
      const nextMetrics = {
        ...prev,
        sessions,
        skipStreak: prev.skipStreak + 1,
        currentSessionPoints: sessions.find((session) => session.date === prev.currentSessionDate)?.points || 0,
        globalPoints: calculateGlobalPoints(sessions),
        heatmap: buildHeatmap(sessions),
      };
      saveStoredMetrics(nextMetrics);
      return nextMetrics;
    });
  };

  const addEvaluationPoints = (points) => {
    if (!currentProblem) return;
    const problemKey = getProblemKey(currentProblem);

    setMetrics((prev) => {
      const previousBest = Number(prev.bestScores?.[problemKey] || 0);
      const improvedPoints = Math.max(0, points - previousBest);
      const nextBestScores = {
        ...(prev.bestScores || {}),
        ...(points > previousBest ? { [problemKey]: points } : {}),
      };

      const sessions = prev.sessions.map((session) =>
        session.date === prev.currentSessionDate
          ? {
              ...session,
              points: (session.points || 0) + improvedPoints,
              evaluations: (session.evaluations || 0) + 1,
              attended: true,
            }
          : session
      );

      const updatedCurrentStreak = computeStreak(sessions, prev.currentSessionDate);
      const nextMetrics = {
        ...prev,
        sessions,
        bestScores: nextBestScores,
        skipStreak: 0,
        currentStreak: updatedCurrentStreak,
        bestStreak: Math.max(prev.bestStreak, updatedCurrentStreak),
        currentSessionPoints: sessions.find((session) => session.date === prev.currentSessionDate)?.points || 0,
        globalPoints: calculateGlobalPoints(sessions),
        heatmap: buildHeatmap(sessions),
      };
      saveStoredMetrics(nextMetrics);
      return nextMetrics;
    });
  };

  const loadProblems = async () => {
    setLoadingProblems(true);
    try {
      const recentProblems = await fetch_recent_solved_problems(LIMIT);
      const shuffledProblems = shuffleArray(recentProblems);
      const firstProblem = shuffledProblems[0] || null;
      setProblems(shuffledProblems);
      setAvailableProblems(shuffledProblems.slice(1));
      setCurrentProblem(firstProblem);
      setHasMore(shuffledProblems.length > 1);
      setProblemCountMessage(
        shuffledProblems.length > 0
          ? `${shuffledProblems.length} unique solved problems loaded.`
          : 'No recent accepted solved submissions found.'
      );
    } catch (err) {
      console.error('loadProblems failed:', err);
      setProblems([]);
      setAvailableProblems([]);
      setCurrentProblem(null);
      setHasMore(false);
      setProblemCountMessage('Failed to load solved problems.');
    }
    setLoadingProblems(false);
  };

  const loadProfile = async () => {
    setLoadingProfile(true);
    try {
      const data = await fetch_profile();
      setProfile(data);
    } catch (err) {
      console.error('loadProfile failed:', err);
    }
    setLoadingProfile(false);
  };

  const update_text_box = (e) => {
    approach_text_setter(e.target.value);
  };

  const loadProblemDescription = async (titleSlug) => {
    if (!titleSlug) {
      setProblemDescription('');
      return;
    }
    setLoadingDescription(true);
    try {
      const details = await fetch_problem_details(titleSlug);
      setProblemDescription(details.description || 'No statement available.');
    } catch (err) {
      console.error('loadProblemDescription failed:', err);
      setProblemDescription('Failed to load problem statement.');
    }
    setLoadingDescription(false);
  };

  const handleEvaluate = async () => {
    const result = await evaluateApproach(approach_text);
    if (result) {
      setAssessment(result);
      const score = parseScore(result);
      if (score !== null) {
        addEvaluationPoints(score);
      }
    }
  };

  const showNextProblem = () => {
    if (availableProblems.length === 0) {
      return;
    }
    applySkipPenalty();
    const [nextProblem, ...remaining] = availableProblems;
    setCurrentProblem(nextProblem);
    setAvailableProblems(remaining);
    setHasMore(remaining.length > 0);
    approach_text_setter('');
    setAssessment('');
  };

  useEffect(() => {
    loadProblems();
    loadProfile();
  }, []);

  useEffect(() => {
    if (currentProblem?.titleSlug) {
      loadProblemDescription(currentProblem.titleSlug);
    } else {
      setProblemDescription('');
    }
  }, [currentProblem]);

  const currentSession = metrics.sessions.find((session) => session.date === metrics.currentSessionDate) || {};

  const formatDayLabel = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const heatmapClass = (day) => {
    if (!day.attended) return 'heatmap-day level-0';
    if (day.points >= 18) return 'heatmap-day level-4';
    if (day.points >= 12) return 'heatmap-day level-3';
    if (day.points >= 6) return 'heatmap-day level-2';
    return 'heatmap-day level-1';
  };

  return (
    <div className="quiz-dashboard-container">
      <div className="left-main-panel">
        <div className="problem_details_box">
          {currentProblem ? (
            <div className="problem-item">
              <h2 className="problem-title">#{currentProblem.questionId} — {currentProblem.title}</h2>
              {currentProblem.topicTags?.length > 0 && (
                <p className="problem-meta">
                  <strong>Topics:</strong>{' '}
                  {currentProblem.topicTags.map((t) => t.name).join(', ')}
                </p>
              )}
              <div className="problem-description-box">
                <div className="section-title">Problem Statement</div>
                {loadingDescription ? (
                  <p>Loading statement...</p>
                ) : problemDescription ? (
                  <div
                    className="problem-description"
                    dangerouslySetInnerHTML={{ __html: problemDescription }}
                  />
                ) : (
                  <p>No problem statement available.</p>
                )}
              </div>
              {currentProblem.isPaidOnly && <p className="problem-meta premium-note">🔒 Premium Problem</p>}
              <a
                className="problem-link"
                href={`https://leetcode.com/problems/${currentProblem.titleSlug}/`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open on LeetCode →
              </a>
            </div>
          ) : (
            <div className="problem-empty-state">{loadingProblems ? 'Loading problem...' : 'No problem loaded.'}</div>
          )}

          <div className="controls-row">
            <button className="primary-button" onClick={showNextProblem} disabled={!currentProblem || !hasMore}>
              Next Solved Problem
            </button>
          </div>

          <div className="status-line">{problemCountMessage}</div>

          <div className="approach-panel">
            <label className="section-label" htmlFor="approach-box">Your Approach</label>
            <textarea
              id="approach-box"
              className="problem_approach_box"
              value={approach_text}
              onChange={update_text_box}
              placeholder="Summarize how you would solve this problem..."
            />
          </div>

          <div className="button_for_eval">
            <button id="eval" className="primary-button" onClick={handleEvaluate} disabled={!approach_text.trim()}>
              Get Feedback
            </button>
          </div>

          <div className="assessment-panel">
            <div className="section-title">Approach Feedback</div>
            <div className="assessment-result">
              {assessment
                ? assessment
                : 'Write your approach above and tap Get Feedback to see the score and notes.'}
            </div>
          </div>
        </div>
      </div>

      <div className="stats">
        <div className="metrics-card">
          <div className="section-title">Session Metrics</div>
          <div className="metric-grid">
            <div className="metric-item">
              <span>Session Points</span>
              <strong>{metrics.currentSessionPoints.toFixed(1)}</strong>
            </div>
            <div className="metric-item">
              <span>Current Streak</span>
              <strong>{metrics.currentStreak}</strong>
            </div>
            <div className="metric-item">
              <span>Best Streak</span>
              <strong>{metrics.bestStreak}</strong>
            </div>
            <div className="metric-item">
              <span>Global Avg Points</span>
              <strong>{metrics.globalPoints.toFixed(1)}</strong>
            </div>
          </div>
          <div className="penalty-row">
            <span>Skip Penalty</span>
            <strong>{2 * (metrics.skipStreak + 1)} pts next</strong>
          </div>
        </div>

        <div className="heatmap-card">
          <div className="section-title">Practice Calendar</div>
          <div className="heatmap-grid">
            {metrics.heatmap.map((day) => (
              <div
                key={day.date}
                className={heatmapClass(day)}
                title={`${formatDayLabel(day.date)} — ${day.attended ? `${day.points.toFixed(1)} pts` : 'No session'}`}
              />
            ))}
          </div>
        </div>

        {loadingProfile ? (
          <div className="profile-panel">Loading profile...</div>
        ) : profile ? (
          <div className="profile-card">
            <h2>👤 {profile.username}</h2>
            <p><strong>Total Solved:</strong> {profile.totalSolved}</p>
            <p className="profile-easy">Easy: {profile.easySolved}</p>
            <p className="profile-medium">Medium: {profile.mediumSolved}</p>
            <p className="profile-hard">Hard: {profile.hardSolved}</p>
          </div>
        ) : (
          <div className="profile-panel">No profile data. Please log in first.</div>
        )}
      </div>
    </div>
  );
}
