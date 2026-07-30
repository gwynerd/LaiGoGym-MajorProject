import { useEffect, useMemo, useRef, useState } from "react";
import BottomNav from "../components/BottomNav";
import {
  generateCoachResponse,
} from "../services/geminiService";
import {
  getCurrentUser,
  clearCoachChatHistoryByUserId,
  getCoachChatHistoryByUserId,
  getLatestRecommendationByUserId,
  getTrainingContextByUserId,
  saveCoachChatHistory,
} from "../services/firestoreService";

const QUICK_PROMPTS = [
  "What arm exercises can I do on top of my current plan?",
  "How can I recover better after training?",
  "What should I do if I missed a workout?",
  "Can you suggest a short core finisher?",
];

const INITIAL_ASSISTANT_MESSAGE = {
  id: "starter-message",
  role: "assistant",
  content:
    "Ask me a quick training question. I can suggest extra exercises, recovery ideas, or ways to adjust your current plan.",
  suggestedPrompts: QUICK_PROMPTS,
  confidence: "high",
};

const COACH_SYSTEM_PROMPT = `You are AI Coach, a conversational assistant for SCDF responders.

Your job is different from the Training tab. The Training tab generates full training plans. You answer short, on-the-spot questions, suggest adjustments, and help the user understand what to do next.

Ground yourself only in the provided Firestore context and the user's question.

Rules:
- Use only the supplied user profile, readiness, IPPT history, health data, training plan, meal plan, and latest saved recommendation.
- Use the supplied health context to judge intensity. If recoveryAssessment says recoveryRisk is high or moderate, suggest lighter effort, shorter sessions, and more recovery. If recoveryRisk is low and staminaAssessment indicates good endurance data, you may suggest a slightly more demanding endurance or conditioning option.
- If heart rate is elevated or sleep is low, suggest lighter effort and more recovery. If running distance or run time suggests good stamina, factor that into the recommendation.
- If the question is about exercises, recovery, or adjusting the current plan, answer clearly and practically.
- If the user wants extra work on a muscle group, suggest safe options that fit the context.
- If the data is missing or the request is too vague, ask 1-3 concise follow-up questions instead of guessing.
- If you cannot answer confidently, provide suggested prompts the user can ask next.
- Do not invent medical advice, injuries, or performance numbers.
- Keep the tone helpful, concise, and conversational.
- Return ONLY valid JSON with no markdown, code fences, or extra text.

Return this JSON structure:
{
  "answer": "short conversational answer",
  "followUpQuestions": ["question 1", "question 2"],
  "suggestedPrompts": ["prompt 1", "prompt 2"],
  "confidence": "low|medium|high"
}

If you can answer directly, keep followUpQuestions empty and include practical suggestedPrompts only if they would be useful.`;

const serializeForPrompt = (value) => {
  if (value == null) return null;

  return JSON.parse(
    JSON.stringify(value, (_, currentValue) => {
      if (currentValue?.toDate) {
        try {
          return currentValue.toDate().toISOString();
        } catch {
          return null;
        }
      }

      if (currentValue instanceof Date) {
        return currentValue.toISOString();
      }

      return currentValue;
    })
  );
};

const formatDateLabel = (value) => {
  if (!value) return "No date available";

  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "No date available";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const buildHealthContextPayload = (latestHealth) => {
  if (!latestHealth || typeof latestHealth !== "object") {
    return null;
  }

  const parsedSleep = Number.isFinite(Number(latestHealth.sleep))
    ? Number(latestHealth.sleep)
    : null;
  const parsedSleepMinutes = Number.isFinite(Number(latestHealth.sleepMinutes))
    ? Number(latestHealth.sleepMinutes)
    : 0;
  const normalizedSleepHours =
    latestHealth.sleepHours != null
      ? Number(latestHealth.sleepHours)
      : parsedSleep != null
        ? parsedSleep + parsedSleepMinutes / 60
        : null;
  const heartRate = latestHealth.heartRate ?? latestHealth.restingHeartRate ?? null;
  const runningDistance = latestHealth.runningDistance ?? latestHealth.distance ?? null;
  const runTime = latestHealth.runTime ?? latestHealth.runtime ?? null;

  const lowSleep = normalizedSleepHours != null && normalizedSleepHours < 6.5;
  const elevatedHeartRate = heartRate != null && heartRate >= 85;
  const staminaDataAvailable = runningDistance != null || runTime != null;

  const recoveryRisk = lowSleep && elevatedHeartRate
    ? "high"
    : lowSleep || elevatedHeartRate
      ? "moderate"
      : "low";

  const recoveryInstruction = recoveryRisk === "high"
    ? "Recovery looks poor; keep the session light, reduce volume, and prioritise rest."
    : recoveryRisk === "moderate"
      ? "Recovery is mixed; keep intensity moderate and avoid extra hard conditioning."
      : "Recovery looks acceptable; normal training intensity is suitable.";

  const staminaInstruction = staminaDataAvailable
    ? "Recent running context is available and should be used to judge endurance capacity."
    : "No recent running context is available; keep stamina advice conservative.";

  return {
    heartRate,
    sleepHours: normalizedSleepHours,
    sleepMinutes: parsedSleepMinutes || latestHealth.sleepMinutes || null,
    runningDistance,
    runTime,
    distance: latestHealth.distance ?? null,
    notes: latestHealth.notes ?? null,
    injury: latestHealth.injury ?? latestHealth.pain ?? null,
    recoveryAssessment: {
      recoveryRisk,
      instruction: recoveryInstruction,
    },
    staminaAssessment: {
      available: staminaDataAvailable,
      instruction: staminaInstruction,
    },
  };
};

const buildContextSummary = (trainingContext, latestRecommendation, currentUser) => {
  const currentPlan = trainingContext?.latestTrainingPlan || null;
  const latestIppt = trainingContext?.latestIppt || null;
  const latestHealth = trainingContext?.latestHealth || null;

  return {
    profile: {
      name: currentUser?.name || "Unknown",
      rank: currentUser?.rank || trainingContext?.user?.rank || "N/A",
      readiness: trainingContext?.user?.readiness ?? currentUser?.readiness ?? null,
      age: trainingContext?.user?.age ?? currentUser?.age ?? null,
      vocation: trainingContext?.user?.vocation || currentUser?.vocation || "N/A",
    },
    latestIppt: latestIppt
      ? {
          result: latestIppt.result || latestIppt.ippt || "N/A",
          date: latestIppt.date || latestIppt.createdAt || null,
          score: latestIppt.score || latestIppt.totalScore || null,
          pushUps: latestIppt.pushUps || latestIppt.pushups || null,
          sitUps: latestIppt.sitUps || latestIppt.situps || null,
          run: latestIppt.run || latestIppt.twokRun || latestIppt.runTime || null,
        }
      : null,
    latestHealth: buildHealthContextPayload(latestHealth),
    latestTrainingPlan: currentPlan
      ? {
          title: currentPlan.title || currentPlan.name || "Latest training plan",
          date: currentPlan.date || currentPlan.createdAt || null,
          focus: currentPlan.focus || currentPlan.goal || null,
          summary: currentPlan.summary || null,
        }
      : null,
    latestMealPlan: trainingContext?.latestMealPlan
      ? {
          title: trainingContext.latestMealPlan.title || trainingContext.latestMealPlan.name || "Meal plan",
          date: trainingContext.latestMealPlan.date || trainingContext.latestMealPlan.createdAt || null,
        }
      : null,
    benchmarks: trainingContext?.benchmarks || null,
    latestRecommendation: latestRecommendation
      ? {
          generatedAt: latestRecommendation.generatedAt || null,
          summary: latestRecommendation.summary || null,
          weakAreasIdentified: latestRecommendation.weakAreasIdentified || [],
        }
      : null,
  };
};

const createMessageId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const hydrateMessages = (messages = []) =>
  messages.map((message, index) => ({
    id: message.id || `${message.role || "message"}-${index}-${createMessageId()}`,
    role: message.role,
    content: message.content,
    followUpQuestions: Array.isArray(message.followUpQuestions)
      ? message.followUpQuestions
      : [],
    suggestedPrompts: Array.isArray(message.suggestedPrompts)
      ? message.suggestedPrompts
      : [],
    confidence: message.confidence || "",
  }));

function AICoach() {
  const [currentUser, setCurrentUser] = useState(null);
  const [trainingContext, setTrainingContext] = useState(null);
  const [latestRecommendation, setLatestRecommendation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [collapsedPromptMessageIds, setCollapsedPromptMessageIds] = useState([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);

  const currentContextSummary = useMemo(
    () => buildContextSummary(trainingContext, latestRecommendation, currentUser),
    [trainingContext, latestRecommendation, currentUser]
  );

  useEffect(() => {
    const loadCoachContext = async () => {
      setLoading(true);
      setError("");

      try {
        const user = getCurrentUser();
        if (!user) {
          setCurrentUser(null);
          setTrainingContext(null);
          setLatestRecommendation(null);
          setMessages([]);
          setError("Please sign in to use AI Coach.");
          return;
        }

        setCurrentUser(user);
        const userID = user.userID || user.id;

        const [context, recommendation] = await Promise.all([
          getTrainingContextByUserId(userID),
          getLatestRecommendationByUserId(userID),
        ]);

        setTrainingContext(context);
        setLatestRecommendation(recommendation);

        const chatHistory = await getCoachChatHistoryByUserId(userID);
        const hydratedMessages =
          chatHistory.length > 0 ? hydrateMessages(chatHistory) : [INITIAL_ASSISTANT_MESSAGE];

        setMessages(hydratedMessages);
        setCollapsedPromptMessageIds([]);
      } catch (err) {
        console.error(err);
        setError(err.message || "Unable to load your coaching context right now.");
      } finally {
        setLoading(false);
      }
    };

    loadCoachContext();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  const sendQuestion = async (value) => {
    const trimmedQuestion = value.trim();
    if (!trimmedQuestion || !currentUser) return;

    const userID = currentUser.userID || currentUser.id;
    const sourcePromptIds = messages
      .filter((message) => message.suggestedPrompts && message.suggestedPrompts.length > 0)
      .map((message) => message.id)
      .filter(Boolean);
    const conversationMessages = [
      ...messages,
      { id: createMessageId(), role: "user", content: trimmedQuestion },
    ];

    setQuestion("");
    setError("");
    setMessages(conversationMessages);
    if (sourcePromptIds.length > 0) {
      setCollapsedPromptMessageIds(sourcePromptIds);
    }
    setSending(true);

    try {
      const [freshContext, freshRecommendation] = await Promise.all([
        getTrainingContextByUserId(userID),
        getLatestRecommendationByUserId(userID),
      ]);

      setTrainingContext(freshContext);
      setLatestRecommendation(freshRecommendation);

      const coachPayload = {
        userQuestion: trimmedQuestion,
        conversationHistory: conversationMessages.slice(-6).map((message) => ({
          role: message.role,
          content: message.content,
        })),
        userContext: serializeForPrompt(
          buildContextSummary(freshContext, freshRecommendation, currentUser)
        ),
      };

      const response = await generateCoachResponse(coachPayload, COACH_SYSTEM_PROMPT);
      const answer = typeof response?.answer === "string" && response.answer.trim()
        ? response.answer.trim()
        : "I need a bit more detail to answer that confidently.";
      const followUpQuestions = Array.isArray(response?.followUpQuestions)
        ? response.followUpQuestions.filter(Boolean)
        : [];
      const suggestedPrompts = Array.isArray(response?.suggestedPrompts)
        ? response.suggestedPrompts.filter(Boolean)
        : [];
      const confidence = response?.confidence || "medium";

      const assistantMessage = {
        id: createMessageId(),
        role: "assistant",
        content: answer,
        followUpQuestions,
        suggestedPrompts,
        confidence,
      };

      const finalMessages = [...conversationMessages, assistantMessage];

      setMessages(finalMessages);
      await saveCoachChatHistory(userID, finalMessages);
    } catch (err) {
      console.error(err);
      setError(err.message || "AI Coach could not answer that request right now.");

      const fallbackMessage = {
        id: createMessageId(),
        role: "assistant",
        content:
          "I could not finish that answer. Try adding more detail, such as which muscle group, how much time you have, or whether you want a beginner or harder option.",
        suggestedPrompts: [
          "Suggest a 10-minute arm finisher",
          "What exercises help triceps the most?",
          "How can I make my current plan harder without overdoing it?",
        ],
        confidence: "low",
      };

      const finalMessages = [...conversationMessages, fallbackMessage];
      setMessages(finalMessages);
      await saveCoachChatHistory(userID, finalMessages);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await sendQuestion(question);
  };

  const handleQuickPrompt = async (prompt) => {
    await sendQuestion(prompt);
  };

  const handleResetChat = () => {
    setMessages([INITIAL_ASSISTANT_MESSAGE]);
    setCollapsedPromptMessageIds([]);
    setError("");
  };

  const handleResetChatHistory = async () => {
    if (!currentUser) return;

    const userID = currentUser.userID || currentUser.id;

    try {
      await clearCoachChatHistoryByUserId(userID);
      handleResetChat();
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to reset chat history right now.");
    }
  };

  const togglePromptVisibility = (messageId) => {
    setCollapsedPromptMessageIds((previous) => {
      if (previous.includes(messageId)) {
        return previous.filter((id) => id !== messageId);
      }

      return [...previous, messageId];
    });
  };

  return (
    <main className="app">
      <section className="phone">
        <div className="phone-content ai-coach-page">
          <div className="dashboard-header">
            <div className="header-left">
              <h1>AI Coach</h1>
              <p>Ask about exercises, recovery, or how to adjust your current plan</p>
            </div>
            <div className="profile-chip">Chat</div>
          </div>

          <div className="ai-coach-card coach-chat-panel">
            <div className="coach-title-row">
              <div>
                <p className="goal-text">AI Coach</p>
                <h2>{currentUser?.name || "Your profile"}</h2>
              </div>
              <div className="coach-header-actions">
                <button className="coach-btn coach-btn-secondary" onClick={handleResetChatHistory}>
                  Reset history
                </button>
              </div>
            </div>

            {error && <p className="ai-error">{error}</p>}

            <details className="coach-context-details">
              <summary>Current context</summary>
              <div className="coach-context-body">
                {loading ? (
                  <p className="ai-muted">Loading your coach context...</p>
                ) : (
                  <>
                    <div className="coach-grid">
                      <div className="coach-metric">
                        <span>Readiness</span>
                        <strong>{currentContextSummary.profile.readiness ?? "—"}</strong>
                      </div>
                      <div className="coach-metric">
                        <span>Latest IPPT</span>
                        <strong>{currentContextSummary.latestIppt?.result || "—"}</strong>
                      </div>
                      <div className="coach-metric">
                        <span>Latest plan</span>
                        <strong>{currentContextSummary.latestTrainingPlan?.title || "—"}</strong>
                      </div>
                      <div className="coach-metric">
                        <span>Heart rate</span>
                        <strong>{currentContextSummary.latestHealth?.heartRate || "—"}</strong>
                      </div>
                    </div>

                    <p className="ai-muted coach-context-note">
                      I use Firestore profile data, IPPT history, health notes, and your latest saved training plan before answering.
                    </p>
                  </>
                )}
              </div>
            </details>

            <div className="coach-chat-log" aria-live="polite">
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`coach-message ${message.role}`}>
                  <div className="coach-message-bubble">
                    <p>{message.content}</p>

                    {message.followUpQuestions?.length > 0 && (
                      <div className="coach-followup-box">
                        <strong>To answer better, I need:</strong>
                        <ul>
                          {message.followUpQuestions.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {message.suggestedPrompts?.length > 0 && !collapsedPromptMessageIds.includes(message.id) && (
                      <div className="coach-suggestions-inline">
                        <strong>Suggested prompts</strong>
                        <div className="coach-chip-row">
                          {message.suggestedPrompts.map((item) => (
                            <button
                              key={item}
                              type="button"
                              className="coach-chip"
                              onClick={() => handleQuickPrompt(item)}
                              disabled={sending}
                            >
                              {item}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {message.suggestedPrompts?.length > 0 && collapsedPromptMessageIds.includes(message.id) && (
                      <button
                        type="button"
                        className="coach-prompt-toggle"
                        onClick={() => togglePromptVisibility(message.id)}
                      >
                        Show prompts
                      </button>
                    )}

                    {message.confidence && (
                      <div className="coach-confidence">Confidence: {message.confidence}</div>
                    )}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="coach-message assistant">
                  <div className="coach-message-bubble coach-typing">Thinking...</div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form className="coach-input-shell" onSubmit={handleSubmit}>
              <textarea
                className="coach-input"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask something like: what arm exercises can I do?"
                rows={3}
                disabled={loading || sending}
              />
              <button className="coach-btn coach-send-btn" type="submit" disabled={loading || sending || !question.trim()}>
                {sending ? "Sending..." : "Ask Coach"}
              </button>
            </form>
          </div>
        </div>

        <BottomNav activePage="ai-coach" />
      </section>
    </main>
  );
}

export default AICoach;
