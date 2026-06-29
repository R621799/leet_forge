const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function getOpenRouterApiKey() {
    const localKey = localStorage.getItem("api_id");
    if (localKey?.trim()) return localKey.trim();
    return import.meta.env.VITE_OPENROUTER_API_KEY?.trim() || "";
}

export async function evaluateApproach(approach_text) {
    const apiKey = getOpenRouterApiKey();
    if (!apiKey) {
        console.error("OpenRouter API key not set");
        return "Error: API key missing. Save your key in the login screen or set VITE_OPENROUTER_API_KEY.";
    }

    const prompt = `You are an evaluator for coding problem approaches. Given the user's approach text as a approach to solve in vague but detailed , provide:\n- A concise assessment (≤50 words).\n- Points out of 10.\n- Verdict: Correct, Wrong, or Close.\n- Brief explanation why this verdict.\nRespond in a single line formatted as: Assessment | Points/10 | Verdict | Explanation in a new line`;

    try {
        const response = await fetch(OPENROUTER_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: prompt },
                    { role: "user", content: approach_text }
                ],
                temperature: 0.2,
                max_tokens: 400
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("OpenRouter request failed", response.status, errorText);
            return `Error: ${response.status} - ${errorText}`;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        return content || "No evaluation returned.";
    } catch (e) {
        console.error(e);
        return "Evaluation error: " + (e.message || e.toString());
    }
}
