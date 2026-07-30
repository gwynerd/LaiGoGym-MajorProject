/**
 * Gemini API Service with Model Cascade
 *
 * This is the app's AI execution layer.
 * The UI gathers training evidence from Firestore, including healthData/Fitbit-backed
 * metrics such as heart rate, sleep, running distance, and run time, then this service
 * sends that evidence to Gemini with a strict system prompt and a fallback chain of models.
 *
 * Behaviour:
 * - Tries models in priority order instead of relying on one model
 * - Switches models when free-tier limits or service errors occur
 * - Removes XML/HTML tags from model output before parsing
 * - Validates every response shape defensively before returning data
 *
 * Endpoint: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 *
 * To use:
 * 1. Get a free API key from https://aistudio.google.com/app/apikey
 * 2. Store it in environment variable: VITE_GEMINI_API_KEY
 * 3. Add to .env.local: VITE_GEMINI_API_KEY=your_key_here
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// Model cascade in priority order (all verified free tier, no-cost tokens)
const MODEL_CASCADE = [
    "gemini-3.1-flash-lite-preview",
    "gemini-3-flash-preview",
    "gemini-3.5-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash-lite",
    "gemma-4-26b-a4b-it",
    "gemma-4-31b-it",
];

/**
 * Scrubs all XML-like tags from text.
 *
 * Some Gemini/Gemma responses can include <thinking> blocks or other markup-like tags.
 * The app never trusts those tags, so they are stripped before JSON parsing.
 */
function stripXmlTags(text) {
    if (typeof text !== "string") {
        return text;
    }
    // Remove all XML/HTML tags including self-closing ones
    // Pattern: <[anything except > character]+>
    return text.replace(/<[^>]+>/g, "");
}

/**
 * Determines whether a failure is transient enough to try the next model.
 *
 * Fatal errors stop the whole chain immediately because retrying would not help.
 * Transient errors continue the cascade because free-tier APIs commonly return
 * quota, timeout, or service-unavailable responses under load.
 */
function shouldSwitchToNextModel(error) {
    if (!error) {
        return false;
    }

    const statusCode = error.statusCode;
    const message = (error.message || "").toLowerCase();

    // FATAL errors - don't cascade
    if (
        statusCode === 400 || // Bad request
        statusCode === 401 || // Unauthorized
        statusCode === 403 || // Forbidden
        message.includes("api key") ||
        message.includes("invalid") ||
        message.includes("auth")
    ) {
        return false;
    }

    // TRANSIENT errors - cascade to next model
    // These are expected with free tier: timeouts, quota, rate limits, service issues
    return (
        statusCode === 429 || // Quota exceeded
        statusCode === 503 || // Service unavailable
        statusCode === 502 || // Bad gateway
        statusCode === 500 || // Server error
        statusCode === 408 || // Request timeout
        statusCode === 0 || // Network error (statusCode 0 is our marker)
        message.includes("timeout") ||
        message.includes("quota") ||
        message.includes("rate limit") ||
        message.includes("service unavailable") ||
        message.includes("connection") ||
        message.includes("network") ||
        message.includes("econnrefused") ||
        message.includes("econnreset") ||
        message.includes("etimedout")
    );
}

/**
 * Executes a single fetch attempt with timeout.
 *
 * The timeout is intentionally conservative because the free tier can be slow.
 * We keep the timeout handling separate so the retry logic stays easy to follow.
 */
async function executeFetchWithTimeout(url, payload, timeoutMs, attemptNumber) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
    } catch (networkError) {
        clearTimeout(timeoutId);
        let errorMsg = networkError.message || "Unknown network error";
        let isTimeout = false;

        if (networkError.name === "AbortError") {
            errorMsg = `Request timeout after ${timeoutMs}ms`;
            isTimeout = true;
        }

        const error = new Error(errorMsg);
        error.statusCode = 0; // 0 = network error, not HTTP
        error.isNetworkError = true;
        error.isTimeout = isTimeout;
        error.attemptNumber = attemptNumber;
        throw error;
    }
}

/**
 * Attempts inference with a single model, with retries.
 *
 * Each model gets multiple chances before the cascade moves on. This makes the
 * AI layer resilient to slow responses, temporary quota issues, and short-lived
 * service interruptions.
 */
async function attemptSingleModel(model, trainingData, systemPrompt) {
    const url = `${GEMINI_API_URL}/${model}:generateContent?key=${GEMINI_API_KEY}`;

    // The system prompt defines the rules; trainingData provides the evidence.
    const payload = {
        contents: [
            {
                parts: [
                    { text: systemPrompt },
                    { text: JSON.stringify(trainingData, null, 2) },
                ],
            },
        ],
        generationConfig: {
            responseMimeType: "application/json",
            temperature: 1,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
        },
    };

    // Per-model retry configuration (accounts for free tier rate limiting)
    const maxRetries = 3;
    const baseTimeoutMs = 45000; // First attempt: 45s
    const timeoutIncrement = 15000; // Each retry: +15s (45s, 60s, 75s)
    const backoffDelayMs = [0, 1000, 3000]; // Delays before retries: 0ms, 1s, 3s

    let lastError = null;

    for (let retryAttempt = 0; retryAttempt < maxRetries; retryAttempt++) {
        const isLastRetry = retryAttempt === maxRetries - 1;
        const timeoutMs = baseTimeoutMs + retryAttempt * timeoutIncrement;

        // Sleep before retry (but not before first attempt)
        if (retryAttempt > 0) {
            const delayMs = backoffDelayMs[retryAttempt];
            console.log(
                `[AI Coach] Retrying model ${model} after ${delayMs}ms backoff (attempt ${retryAttempt + 1}/${maxRetries}, timeout: ${timeoutMs}ms)`
            );
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        } else {
            console.log(
                `[AI Coach] Attempting model ${model} (attempt 1/${maxRetries}, timeout: ${timeoutMs}ms)`
            );
        }

        try {
            // Execute fetch with progressive timeout
            const response = await executeFetchWithTimeout(
                url,
                payload,
                timeoutMs,
                retryAttempt + 1
            );

            // Handle non-OK HTTP response
            if (!response.ok) {
                let errorMessage = response.statusText || `HTTP ${response.status}`;
                let errorData = null;

                try {
                    errorData = await response.json();
                    errorMessage = errorData?.error?.message || errorMessage;
                } catch (parseErr) {
                    // Could not parse error response
                }

                const error = new Error(
                    `Model ${model} responded with ${response.status}: ${errorMessage}`
                );
                error.statusCode = response.status;
                error.errorData = errorData;

                // Fatal errors: stop retrying this model
                if (!shouldSwitchToNextModel(error)) {
                    throw error;
                }

                // Transient errors: retry if not last attempt
                lastError = error;
                if (!isLastRetry) {
                    console.warn(
                        `[AI Coach] Transient error (HTTP ${response.status}), will retry...`
                    );
                    continue;
                }
                throw error;
            }

            // Parse response JSON body
            let responseData;
            try {
                responseData = await response.json();
            } catch (parseErr) {
                const error = new Error(
                    `Failed to parse response JSON from model ${model}: ${parseErr.message}`
                );
                error.statusCode = response.status;
                throw error;
            }

            // Validate response is an object
            if (!responseData || typeof responseData !== "object") {
                throw new Error(
                    `Model ${model} returned non-object response: ${typeof responseData}`
                );
            }

            // Validate candidates array
            if (
                !Array.isArray(responseData.candidates) ||
                responseData.candidates.length === 0
            ) {
                throw new Error(`Model ${model} returned empty candidates array`);
            }

            // Validate content structure
            const candidate = responseData.candidates[0];
            if (!candidate.content || !Array.isArray(candidate.content.parts)) {
                throw new Error(`Model ${model} returned malformed content structure`);
            }

            if (candidate.content.parts.length === 0) {
                throw new Error(`Model ${model} returned empty content parts`);
            }

            // Extract text from first part
            const part = candidate.content.parts[0];
            if (!part.text || typeof part.text !== "string") {
                throw new Error(`Model ${model} returned non-string text content`);
            }

            // Get and validate text content
            let textContent = part.text.trim();

            if (!textContent) {
                throw new Error(`Model ${model} returned empty text content`);
            }

            // SAFETY PASS 1: Strip XML tags (handles <thinking>, </thinking>, etc.)
            textContent = stripXmlTags(textContent);

            // SAFETY CHECK: Verify content exists after stripping
            if (!textContent) {
                throw new Error(
                    `Model ${model} returned only XML tags with no actual content`
                );
            }

            // Extract JSON from potential markdown code fences
            let jsonText = textContent;
            const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/i);

            if (jsonMatch && jsonMatch[1]) {
                jsonText = jsonMatch[1].trim();
            }

            // SAFETY PASS 2: Strip XML tags again after extraction (defensive)
            jsonText = stripXmlTags(jsonText);

            // SAFETY CHECK: Verify content still exists
            if (!jsonText) {
                throw new Error(
                    `Model ${model} returned no usable content after XML scrubbing`
                );
            }

            // Parse JSON
            let result;
            try {
                result = JSON.parse(jsonText);
            } catch (parseErr) {
                const preview = jsonText.substring(0, 200);
                throw new Error(
                    `Model ${model} response was not valid JSON: ${parseErr.message}\n` +
                    `Content (first 200 chars): ${preview}`
                );
            }

            // Validate result is an object (not string, array, primitive)
            if (!result || typeof result !== "object") {
                throw new Error(
                    `Model ${model} returned non-object JSON: ${typeof result}`
                );
            }

            // SUCCESS
            return result;
        } catch (error) {
            lastError = error;

            // Check if this is a transient error worth retrying
            const isTransient = shouldSwitchToNextModel(error);
            const attemptLabel = retryAttempt + 1;

            if (!isTransient) {
                // Fatal error - don't retry
                console.error(
                    `[AI Coach] Fatal error with model ${model} (attempt ${attemptLabel}/${maxRetries}): ${error.message}`
                );
                throw error;
            }

            if (isLastRetry) {
                // Last attempt and it failed
                console.error(
                    `[AI Coach] Model ${model} failed after ${maxRetries} attempts. Last error: ${error.message}`
                );
                throw error;
            }

            // Transient error but more retries available
            console.warn(
                `[AI Coach] Model ${model} attempt ${attemptLabel}/${maxRetries} failed (transient): ${error.message}`
            );
        }
    }

    // Should not reach here, but just in case
    throw (
        lastError ||
        new Error(`Model ${model} exhausted all retry attempts with unknown error`)
    );
}

/**
 * Main entry point: Generates training recommendation with model cascade + retries.
 *
 * The caller is responsible for supplying a rich evidence payload from Firestore.
 * That payload should include the user's historical records plus healthData context
 * such as heart rate, sleep amount, running distance, and run time so the model can
 * tailor workout intensity, recovery advice, and stamina guidance appropriately.
 * The caller can also provide derived recovery and stamina hints so the model can
 * make more consistent decisions when fatigue or endurance signals are present.
 *
 * This is the agentic loop for the responder coach:
 * 1. observe Firestore training context
 * 2. reason over the user's history and benchmarks
 * 3. act by calling Gemini
 * 4. store the result back in Firestore for later review
 */
export const generateTrainingRecommendation = async (
    trainingData,
    systemPrompt
) => {
    // Validate API key
    if (!GEMINI_API_KEY) {
        throw new Error(
            "Gemini API key not configured. Add VITE_GEMINI_API_KEY to .env.local\n" +
            "Get free key from: https://aistudio.google.com/app/apikey"
        );
    }

    // Validate inputs
    if (!trainingData || typeof trainingData !== "object") {
        throw new Error("trainingData must be a non-null object");
    }

    if (!systemPrompt || typeof systemPrompt !== "string") {
        throw new Error("systemPrompt must be a non-empty string");
    }

    if (MODEL_CASCADE.length === 0) {
        throw new Error(
            "No models available in cascade (critical configuration error)"
        );
    }

    const attemptLog = [];
    const startTime = Date.now();

    console.log(
        `[AI Coach] Starting recommendation generation with ${MODEL_CASCADE.length} models in cascade`
    );

    // Try each model in cascade order
    for (let modelIndex = 0; modelIndex < MODEL_CASCADE.length; modelIndex++) {
        const model = MODEL_CASCADE[modelIndex];
        const modelNumber = modelIndex + 1;
        const totalModels = MODEL_CASCADE.length;

        try {
            console.log(
                `[AI Coach] Model ${modelNumber}/${totalModels}: ${model}`
            );

            const result = await attemptSingleModel(model, trainingData, systemPrompt);

            const elapsedMs = Date.now() - startTime;
            console.log(
                `[AI Coach] SUCCESS with model: ${model} (${elapsedMs}ms elapsed)`
            );
            return result;
        } catch (error) {
            const elapsedMs = Date.now() - startTime;

            attemptLog.push({
                model,
                modelNumber,
                totalModels,
                statusCode: error.statusCode,
                message: error.message,
                elapsedMs,
            });

            const isLastModel = modelIndex === MODEL_CASCADE.length - 1;
            const shouldSwitch = shouldSwitchToNextModel(error);

            console.error(
                `[AI Coach] Model ${modelNumber}/${totalModels} (${model}) exhausted: ${error.message}`
            );

            if (isLastModel) {
                // All models exhausted
                console.error(
                    `[AI Coach] ALL ${totalModels} MODELS EXHAUSTED`
                );
                break; // Exit loop to throw comprehensive error
            }

            if (!shouldSwitch) {
                // Fatal error - stop entire cascade
                console.error(
                    `[AI Coach] FATAL ERROR - stopping cascade (not trying remaining ${totalModels - modelNumber} models)`
                );
                throw error;
            }

            // Transient error - try next model
            console.log(
                `[AI Coach] Transient error - trying next model (${totalModels - modelNumber} remaining)`
            );
        }
    }

    // All models exhausted - build comprehensive error report
    const attemptSummary = attemptLog
        .map((log) => {
            const statusLabel =
                log.statusCode === 0
                    ? "(network)"
                    : `(HTTP ${log.statusCode})`;
            return `   ${log.modelNumber}. ${log.model} ${statusLabel}: ${log.message} [${log.elapsedMs}ms]`;
        })
        .join("\n");

    const totalElapsed = Date.now() - startTime;

    const errorMessage =
        `\n${"=".repeat(70)}\n` +
        `ALL ${MODEL_CASCADE.length} MODELS FAILED AFTER ${totalElapsed}ms\n` +
        `${"=".repeat(70)}\n\n` +
        `Attempts:\n${attemptSummary}\n\n` +
        `TROUBLESHOOTING:\n` +
        `1. API Key:\n` +
        `   - Verify VITE_GEMINI_API_KEY is set in .env.local\n` +
        `   - Get new key: https://aistudio.google.com/app/apikey\n\n` +
        `2. Free Tier Quotas:\n` +
        `   - Free tier resets daily\n` +
        `   - If exceeded, try again later (usually after 24h)\n\n` +
        `3. Network/Connectivity:\n` +
        `   - Check internet connection\n` +
        `   - Try a different network if possible\n` +
        `   - Check firewall/proxy settings\n\n` +
        `4. Browser Console:\n` +
        `   - Open DevTools (F12)\n` +
        `   - Check for additional error details\n` +
        `${"=".repeat(70)}`;

    throw new Error(errorMessage);
};

/**
 * Exported utilities for testing and debugging
 */
export const getModelCascade = () => MODEL_CASCADE;
export const testStripXmlTags = (text) => stripXmlTags(text);


/**
 * Commander unit planning + Passing Probability
 *
 * This reuses the same AI execution layer, but the prompt and input change:
 * instead of a single responder, the model clusters multiple responders into
 * groups and proposes a shared training focus for the commander view.
 */
export const generateCommanderGroupPlan = async (
  personnel,
  officialHistory
) => {
  const trainingData = {
    personnel: personnel.map((p) => {
      const userID = p.userID || p.id;
      const records = officialHistory[userID] || [];
      const latestOfficial = records[records.length - 1];

      return {
        name:
          p.name ||
          `${p.firstName || ""} ${p.lastName || ""}`.trim(),
        rank: p.rank || "N/A",
        unit: p.unit || "N/A",
        latestOfficialResult: latestOfficial?.result || "N/A",
        latestOfficialScore:
          latestOfficial?.totalScore ??
          latestOfficial?.totalscore ??
          0,
        pastOfficialRecords: records.map((record) => ({
          totalScore:
            record.totalScore ??
            record.totalscore ??
            0,
          result: record.result || "N/A",
          pushups: record.pushups || 0,
          situps: record.situps || 0,
          runtime: record.runtime || "N/A",
        })),
      };
    }),
  };

  const systemPrompt = `
You are an AI training assistant for an SCDF commander.

Classify personnel into suitable training groups based only on:
- latest official IPPT score
- latest official IPPT result
- past official IPPT score trends
- push-up performance
- sit-up performance
- 2.4km run performance
- consistency and improvement across available records

Do not mention injuries, medical conditions, or injury status.

Return ONLY valid JSON in this format:

{
  "summary": "short overall summary",
  "groups": [
    {
      "groupName": "Group name",
      "personnel": ["Name 1", "Name 2"],
      "classificationReason": "Why they are grouped together based on official IPPT performance",
      "trainingFocus": "Main official IPPT training focus",
      "recommendedPlan": [
        "Action 1",
        "Action 2",
        "Action 3"
      ]
    }
  ]
}

Rules:
- Use only the supplied official IPPT data.
- Do not invent missing results.
- If a personnel has no official IPPT record, state that there is insufficient official IPPT data.
- Do not include markdown.
- Do not include extra text.
`;

  return await generateTrainingRecommendation(
    trainingData,
    systemPrompt
  );
};

export const generatePassingProbability = async (
  personnel,
  officialHistory
) => {
  const trainingData = {
    personnel: personnel.map((p) => {
      const userID = p.userID || p.id;
      const records = officialHistory[userID] || [];
      const latestOfficial = records[records.length - 1];

      return {
        name:
          p.name ||
          `${p.firstName || ""} ${p.lastName || ""}`.trim(),
        rank: p.rank || "N/A",
        unit: p.unit || "N/A",
        latestOfficialScore:
          latestOfficial?.totalScore ??
          latestOfficial?.totalscore ??
          0,
        latestOfficialResult:
          latestOfficial?.result || "N/A",
        pastOfficialRecords: records.map((record) => ({
          totalScore:
            record.totalScore ??
            record.totalscore ??
            0,
          result: record.result || "N/A",
          pushups: record.pushups || 0,
          situps: record.situps || 0,
          runtime: record.runtime || "N/A",
        })),
      };
    }),
  };

  const systemPrompt = `
You are an AI assistant for an SCDF commander.

Estimate each personnel's probability of passing their next official IPPT based only on:
- latest official IPPT score
- latest official IPPT result
- past official IPPT score trend
- push-up performance trend
- sit-up performance trend
- 2.4km run performance trend
- consistency and improvement across available records

Do not mention injuries, medical conditions, or injury status.

Return ONLY valid JSON in this format:

{
  "summary": "short overall summary",
  "predictions": [
    {
      "name": "Personnel name",
      "passingProbability": 85,
      "riskLevel": "Low",
      "reason": "Short reason based only on official IPPT performance and trends",
      "recommendedAction": "Short official IPPT training action"
    }
  ]
}

Rules:
- passingProbability must be a whole number from 0 to 100.
- riskLevel must be "Low", "Moderate", or "High".
- A higher passingProbability should normally correspond to a lower riskLevel.
- Use only the supplied official IPPT data.
- Do not invent missing results.
- If there is no official IPPT history, use a cautious estimate and clearly state that the available evidence is limited.
- Do not include markdown.
- Do not include extra text.
`;

  return await generateTrainingRecommendation(
    trainingData,
    systemPrompt
  );
};

/**
 * Commander Training Brief
 *
 * This uses the same model cascade and JSON validation as the
 * existing AI Coach, Commander Group Plan and Passing Probability.
 */
export const generateCommanderTrainingBrief = async (
  personnelAnalysis
) => {
  if (
    !Array.isArray(personnelAnalysis) ||
    personnelAnalysis.length === 0
  ) {
    throw new Error(
      "Personnel analysis is required to generate a commander training brief."
    );
  }

  const trainingData = {
    personnel: personnelAnalysis.map((person) => ({
      name: person.name || "Unknown",
      rank: person.rank || "N/A",

      latestPractice: person.latestPractice || null,
      previousPractice: person.previousPractice || null,
      latestOfficial: person.latestOfficial || null,

      trend: person.trend || "Insufficient data",
      scoreChange: Number(person.scoreChange || 0),

      strongestComponent:
        person.strongestComponent || "Insufficient data",

      weakestComponent:
        person.weakestComponent || "Insufficient data",

      priorityLevel: person.priorityLevel || "Low",
      priorityReasons: Array.isArray(person.priorityReasons)
        ? person.priorityReasons
        : [],

      suggestedAction:
        person.suggestedAction || "Continue monitoring",
    })),
  };

  const systemPrompt = `
You are an AI decision-support assistant for a commander using an IPPT management application.

This feature is called Commander Training.

It must not repeat the AI Unit Recommendation.

The AI Unit Recommendation separates personnel into training groups.
The Commander Training feature instead analyses:
- individual practice IPPT progress
- changes between recent practice attempts
- latest official IPPT performance
- strongest and weakest IPPT components
- personnel requiring commander attention
- practical follow-up actions

Return ONLY valid JSON in this exact format:

{
  "summary": "A concise section-level training summary",
  "mainConcern": "The most important current section-level concern",
  "positiveObservation": "The most important positive development",
  "attentionCount": 0,
  "actions": [
    {
      "title": "Short action title",
      "description": "Clear practical action for the commander"
    }
  ]
}

Rules:
- Do not divide personnel into groups.
- Do not create a weekly training programme.
- Do not repeat the Unit page's grouping recommendation.
- Use only the supplied data.
- Do not invent missing IPPT records.
- Clearly acknowledge insufficient data where applicable.
- Do not mention injuries or medical conditions.
- Do not make guaranteed predictions.
- attentionCount must be a whole number.
- Provide between 2 and 4 actions.
- Keep the summary concise and professional.
- Do not include markdown.
- Do not include any text outside the JSON object.
`;

  const result = await generateTrainingRecommendation(
    trainingData,
    systemPrompt
  );

  if (!result || typeof result !== "object") {
    throw new Error(
      "Gemini returned an invalid Commander Training response."
    );
  }

  return {
    summary:
      typeof result.summary === "string"
        ? result.summary
        : "No unit summary was generated.",

    mainConcern:
      typeof result.mainConcern === "string"
        ? result.mainConcern
        : "No main concern was identified.",

    positiveObservation:
      typeof result.positiveObservation === "string"
        ? result.positiveObservation
        : "No positive observation was identified.",

    attentionCount: Number.isFinite(
      Number(result.attentionCount)
    )
      ? Math.max(0, Math.round(Number(result.attentionCount)))
      : 0,

    actions: Array.isArray(result.actions)
      ? result.actions
          .filter(
            (action) =>
              action &&
              typeof action.title === "string" &&
              typeof action.description === "string"
          )
          .slice(0, 4)
      : [],
  };
};

/**
 * Conversational coach path.
 *
 * This reuses the same AI execution layer as the training planner, but the
 * prompt is tuned for short answers, follow-up questions, and prompt ideas.
 */
export const generateCoachResponse = async (coachData, systemPrompt) => {
    return await generateTrainingRecommendation(coachData, systemPrompt);
};
