// Helper to get username consistently.
// The login page stores it via localStorage.setItem("username", username)
const getUsername = () => {
  const stored = localStorage.getItem("username");
  if (stored) return stored;
  console.warn(
    "No username found in localStorage. " +
    "Please log in first, or run: localStorage.setItem('username','YOUR_HANDLE')"
  );
  return null;
};

const API_BASE = "https://alfa-leetcode-api.onrender.com";

/**
 * Fetch LeetCode problems from the global /problems endpoint.
 * The API returns: { totalQuestions, count, problemsetQuestionList: [...] }
 * Each problem has: title, titleSlug, difficulty, acRate, topicTags, etc.
 */
export async function fetch_problems(limit = 10, skip = 0) {
  try {
    const url = `${API_BASE}/problems?limit=${limit}&skip=${skip}`;
    console.log("Fetching problems from:", url);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    console.log("Problems API response:", data);

    // The API returns problemsetQuestionList
    const rawList = data.problemsetQuestionList || [];

    return rawList.map((item) => ({
      title: item.title || "Untitled",
      titleSlug: item.titleSlug || "",
      difficulty: item.difficulty || "Unknown",
      acRate: item.acRate ? item.acRate.toFixed(1) : "N/A",
      topicTags: item.topicTags || [],
      isPaidOnly: item.isPaidOnly || false,
      questionId: item.questionFrontendId || "",
    }));
  } catch (error) {
    console.error("Fetch Problems Error:", error);
    return [];
  }
}

/**
 * Fetch user profile data from /:username/solved
 * Returns: { solvedProblem, easySolved, mediumSolved, hardSolved, ... }
 */
export async function fetch_profile() {
  const username = getUsername();
  if (!username) return null;

  try {
    const url = `${API_BASE}/${username}/solved`;
    console.log("Fetching profile from:", url);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    console.log("Profile API response:", data);

    const solvedProblem = data.solvedProblem ?? data.acSubmissionNum?.[0]?.count ?? 0;
    const easy = data.easySolved ?? data.acSubmissionNum?.find((item) => item.difficulty === "Easy")?.count ?? 0;
    const medium = data.mediumSolved ?? data.acSubmissionNum?.find((item) => item.difficulty === "Medium")?.count ?? 0;
    const hard = data.hardSolved ?? data.acSubmissionNum?.find((item) => item.difficulty === "Hard")?.count ?? 0;

    return {
      username,
      totalSolved: solvedProblem,
      easySolved: easy,
      mediumSolved: medium,
      hardSolved: hard,
    };
  } catch (error) {
    console.error("Fetch Profile Error:", error);
    return null;
  }
}

async function fetch_submission_list(username, endpoint, limit) {
  const url = `${API_BASE}/${username}/${endpoint}?limit=${limit}`;
  console.log(`Fetching ${endpoint} from:`, url);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json();
}

export async function fetch_problem_details(titleSlug) {
  try {
    const url = `${API_BASE}/problem/${titleSlug}`;
    console.log(`Fetching problem details from:`, url);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    return {
      description: data.description || data.content || '',
      title: data.title || '',
      titleSlug: data.titleSlug || titleSlug,
    };
  } catch (error) {
    console.error('Fetch Problem Details Error:', error);
    return { description: '', titleSlug };
  }
}

export async function fetch_recent_solved_problems(limit = 20) {
  const username = getUsername();
  if (!username) return [];

  const endpoints = ['acSubmission', 'submission'];
  let data = null;

  for (const endpoint of endpoints) {
    try {
      data = await fetch_submission_list(username, endpoint, limit * 3);
      if (data && Array.isArray(data.submission) && data.submission.length > 0) {
        break;
      }
    } catch (error) {
      console.warn(`Failed to fetch from ${endpoint}:`, error);
    }
  }

  if (!data || !Array.isArray(data.submission)) {
    return [];
  }

  const submissions = data.submission;
  const unique = [];
  const seenSlugs = new Set();

  for (const item of submissions) {
    if (!item) continue;
    const status = String(item.status || item.statusDisplay || item.status_display || item.state || "").toLowerCase();
    if (!status.includes("accepted") && !status.includes("ac")) continue;

    const titleSlug = item.titleSlug || item.slug || item.title_slug || item.questionTitleSlug || item.questionSlug || item.question_title_slug;
    if (!titleSlug || seenSlugs.has(titleSlug)) continue;
    seenSlugs.add(titleSlug);

    const title = item.title || item.questionTitle || item.question_title || titleSlug.replace(/-/g, ' ') || "Untitled";
    const difficulty = item.difficulty || item.level || item.questionDifficulty || "Unknown";
    const acRate = item.acRate != null ? Number(item.acRate).toFixed(1) : item.acceptRate != null ? String(item.acceptRate) : "N/A";

    unique.push({
      title,
      titleSlug,
      difficulty,
      acRate,
      topicTags: item.topicTags || item.tags || [],
      isPaidOnly: item.isPaidOnly || item.paidOnly || false,
      questionId: item.questionFrontendId || item.questionId || item.id || "",
    });

    if (unique.length >= limit) break;
  }

  return unique;
}

/**
 * Fetch recent submissions from /:username/submission
 * Returns the raw submission data from the API.
 */
export async function fetch_submission() {
  const username = getUsername();
  if (!username) return null;

  try {
    const url = `${API_BASE}/${username}/submission`;
    console.log("Fetching submissions from:", url);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (e) {
    console.error("Fetch Submission Error:", e);
    return null;
  }
}