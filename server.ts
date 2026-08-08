import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

// API route for AI Study Insights
app.post('/api/study-insights', async (req, res) => {
  try {
    const { duration, warnings, awayCount, mode, efficiency, topics } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      const breakMsg = awayCount && awayCount >= 3
        ? `You stepped away ${awayCount} times this hour—try taking a dedicated 5-minute break!`
        : `Recorded ${warnings || 0} gaze warning(s) and ${awayCount || 0} away event(s).`;
      return res.json({
        insight: `Ghibli AI Analysis (${mode} mode): Focus duration ${duration} with ${efficiency} efficiency. ${breakMsg}`,
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    const prompt = `You are a warm, encouraging AI Study Coach in a Ghibli-themed focus application.
Analyze the following student study session metrics:
- Mode: ${mode}
- Duration: ${duration}
- Efficiency: ${efficiency}
- Attention Warnings (gaze away): ${warnings || 0}
- Away/Distraction Count (times left frame for >30s): ${awayCount || 0}
- Topics Covered: ${topics?.length ? topics.join(', ') : 'General Deep Work'}

Provide a concise, friendly 2-sentence study performance summary and 1 key tip for optimal focus retention.
IMPORTANT: If Away/Distraction Count is > 0, provide brief, friendly advice addressing the user stepping away (e.g. if away > 3 times: "You stepped away a few times this hour—try taking a dedicated 5-minute break!"). Keep the tone warm, clear, and encouraging.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
    });

    const text = response.text || 'Focus session completed with strong study metrics.';
    res.json({ insight: text });
  } catch (error) {
    console.error('Error generating AI study insights:', error);
    res.json({
      insight: 'Cozy study telemetry logged. Great effort maintained during your focus session!',
    });
  }
});

// API route for AI Hourly Active Recall Quiz Generation
app.post('/api/hourly-quiz', async (req, res) => {
  try {
    const { topic, notes, hourNumber } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      // Fallback response if GEMINI_API_KEY is not set
      return res.json({
        questions: [
          {
            id: 'q1',
            question: `What was the primary core concept you focused on while studying "${topic || 'your subjects'}" during Hour #${hourNumber || 1}?`,
            options: [
              `The foundational principles of ${topic || 'the topic'}`,
              `Secondary historical context and edge cases`,
              `Unrelated formulas and memorization techniques`,
              `Overview of introductory definitions only`,
            ],
            correctAnswerIndex: 0,
            explanation: `Focusing on the foundational principles of ${topic || 'the subject'} builds long-term active recall memory.`,
          },
          {
            id: 'q2',
            question: `Which active recall strategy is most effective for retaining key details from: "${notes || topic || 'recent session notes'}"?`,
            options: [
              `Passive re-reading of notes 3 times`,
              `Self-testing without looking at source notes`,
              `Highlighting full pages of text`,
              `Copying text verbatim onto flashcards`,
            ],
            correctAnswerIndex: 1,
            explanation: `Self-testing forces the brain to retrieve information, strengthening neural pathways faster than passive reading.`,
          },
          {
            id: 'q3',
            question: `How does applying active recall during study hour #${hourNumber || 1} impact focus efficiency?`,
            options: [
              `It reduces retention rates by causing fatigue`,
              `It reveals knowledge gaps and solidifies long-term memory`,
              `It slows down study speed without benefit`,
              `It only works for mathematics and formulas`,
            ],
            correctAnswerIndex: 1,
            explanation: `Active recall immediately highlights knowledge gaps, allowing targeted review before moving to the next hour.`,
          },
        ],
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const prompt = `You are an AI Tutor creating an active recall quiz for a student who just finished 1 hour of studying.
Topic studied: ${topic || 'General Focus Session'}
Notes submitted: ${notes || 'No detailed notes provided'}
Hour number: #${hourNumber || 1}

Generate exactly 3 multiple choice questions (MCQs) testing active recall of key concepts from this topic/notes.
Return ONLY valid JSON format matching this structure:
{
  "questions": [
    {
      "id": "q1",
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswerIndex": 0,
      "explanation": "Short clear explanation of why option A is correct."
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
    });

    const rawText = response.text || '';
    const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    res.json(parsed);
  } catch (error) {
    console.error('Error generating AI hourly quiz:', error);
    res.json({
      questions: [
        {
          id: 'q1',
          question: `What was the key breakthrough concept you studied in "${req.body.topic || 'this session'}"?`,
          options: [
            `Core conceptual framework and practical applications`,
            `Surface level terminology review`,
            `Historical background context`,
            `Unrelated formula derivations`,
          ],
          correctAnswerIndex: 0,
          explanation: `Mastering practical applications cements conceptual knowledge.`,
        },
        {
          id: 'q2',
          question: `Which technique ensures strongest retention of your notes: "${req.body.notes || 'session notes'}"?`,
          options: [
            `Feynman technique & explaining in simple terms`,
            `Rereading notes multiple times in one sitting`,
            `Relying on passive background audio`,
            `Skimming chapter titles`,
          ],
          correctAnswerIndex: 0,
          explanation: `The Feynman technique identifies gaps by forcing simple explanation.`,
        },
        {
          id: 'q3',
          question: `What is the optimal next step after completing this hourly active recall check?`,
          options: [
            `Review missed concepts for 5 mins, then proceed`,
            `Ignore wrong answers and continue immediately`,
            `Stop studying for the rest of the day`,
            `Delete previous session notes`,
          ],
          correctAnswerIndex: 0,
          explanation: `Targeted 5-minute targeted review prevents compounding knowledge gaps.`,
        },
      ],
    });
  }
});

// API route for AI Next-Hour Adaptive Planner
app.post('/api/next-hour-plan', async (req, res) => {
  try {
    const { efficiency, warnings, awayCount, duration, topic, hourNumber } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      let statusText = 'PEAK FOCUS';
      let title = 'Tackle High-Difficulty Topics';
      let action = `Your focus efficiency is ${efficiency}%. Tackle your hardest problem set or writing block in Hour #${(hourNumber || 1) + 1}.`;
      let breakAdvice = 'Take a 5-minute water break before diving in.';

      if (awayCount > 2 || efficiency < 70 || warnings > 2) {
        statusText = 'ATTENTION & DESK ABSENCE DETECTED';
        title = 'Active Recall or 10-Min Ghibli Tea Break';
        action = `Recorded ${awayCount || 0} away events and ${warnings || 0} gaze warnings. Switch to lighter flashcard review or active recall quizzes for the next hour to prevent burn-out.`;
        breakAdvice = 'You stepped away a few times this hour—try taking a dedicated 5-minute tea break with Rain soundscapes active!';
      } else if (efficiency < 85) {
        statusText = 'STEADY FOCUS MOMENTUM';
        title = '50-Min Pomodoro with Active Summarization';
        action = `Good steady rhythm at ${efficiency}%. Continue with ${topic || 'current topic'} using 25-minute Pomodoro sprints and 5-minute summaries.`;
        breakAdvice = 'Take a short 5-minute breathing break.';
      }

      return res.json({
        plan: {
          statusText,
          title,
          action,
          breakAdvice,
          recommendedMode: efficiency > 80 ? '50min' : '25min',
        },
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const prompt = `You are an AI Adaptive Study Planner.
Current Session Metrics:
- Focus Efficiency: ${efficiency}%
- Attention Warnings: ${warnings || 0}
- Away/Distraction Count (times left frame for >30s): ${awayCount || 0}
- Session Duration: ${duration}
- Current Topic: ${topic || 'General Study'}
- Hour Completed: #${hourNumber || 1}

Provide a smart recommendation for what the student should do in their NEXT hour of study.
Return ONLY valid JSON matching this schema:
{
  "plan": {
    "statusText": "SHORT AGILITY CODE (e.g. PEAK NEURAL FOCUS / MODERATE MOMENTUM / ATTENTION RECOVERY NEEDED)",
    "title": "Action Title (e.g., Attack Complex Calculus II Integration)",
    "action": "2 sentence clear recommendation on what to study next and how",
    "breakAdvice": "1 sentence break recommendation (e.g. 5-min walk or 10-min Ghibli tea break)",
    "recommendedMode": "25min or 50min"
  }
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
    });

    const rawText = response.text || '';
    const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    res.json(parsed);
  } catch (error) {
    console.error('Error generating AI next-hour plan:', error);
    res.json({
      plan: {
        statusText: 'OPTIMAL FOCUS STRATEGY',
        title: 'Targeted Practice & Recall',
        action: 'Maintain focus by breaking down your study material into 25-minute sprints followed by quick active recall reviews.',
        breakAdvice: 'Take a 5-minute tea break and refresh your eyes.',
        recommendedMode: '25min',
      },
    });
  }
});

// API route for AI Study Coach Chat
app.post('/api/study-coach-chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      const msgLower = (message || '').toLowerCase();
      let reply = "I'm your Ghibli AI Study Coach! ";
      if (msgLower.includes('pomodoro') || msgLower.includes('time')) {
        reply += "The Pomodoro Technique breaks work into 25-minute focused sprints followed by 5-minute breaks. After 4 cycles, take a longer 15-30 minute rest to refresh your focus!";
      } else if (msgLower.includes('feynman') || msgLower.includes('technique')) {
        reply += "The Feynman Technique: 1) Choose a concept. 2) Teach it to a 10-year-old in simple terms. 3) Identify gaps where you get stuck. 4) Review source material until clear!";
      } else if (msgLower.includes('procrastinat') || msgLower.includes('focus')) {
        reply += "To beat procrastination, try the '5-Minute Rule': Commit to studying for just 5 minutes without pressure. Once you start, momentum usually takes over!";
      } else if (msgLower.includes('recall') || msgLower.includes('memory')) {
        reply += "Active Recall means testing yourself without looking at notes. It builds 3x stronger neural connections than passive reading!";
      } else {
        reply += "To maximize retention, combine Active Recall (self-testing) with Spaced Repetition across several days!";
      }
      return res.json({ reply });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const systemPrompt = `You are a warm, wise, and encouraging AI Study Coach inside a cozy Ghibli-themed study app.
Your specialty is guiding students on:
1. Time Management: Pomodoro technique, time blocking, energy management, avoiding burnout, 5-minute rule for procrastination.
2. Study Techniques: Feynman Technique, Active Recall, Spaced Repetition, Leitner box method, SQ3R, Cornell note-taking, mind mapping, practice testing.
3. Exam Prep & Focus: Overcoming test anxiety, focus recovery, setting study goals.

Keep your answers structured, encouraging, practical, and clear (use bullet points or bold text where helpful). Keep responses concise (around 2-4 short paragraphs max) so they are easy to read in a sidebar chat widget.`;

    const contents: any[] = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: "Understood! I am ready to coach students on time management and effective study techniques with warm Ghibli enthusiasm." }] },
    ];

    if (Array.isArray(history)) {
      for (const item of history) {
        if (item.text && item.role) {
          contents.push({
            role: item.role === 'user' ? 'user' : 'model',
            parts: [{ text: item.text }],
          });
        }
      }
    }

    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents,
    });

    const text = response.text || 'Keep up the wonderful study effort! Every focused minute counts toward your goals.';
    res.json({ reply: text });
  } catch (error) {
    console.error('Error in Study Coach Chat:', error);
    res.json({
      reply: "I'm right here with you! Try breaking down your study material into small 20-minute chunks and test yourself with active recall questions.",
    });
  }
});

  // Vite middleware for development or static serving in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API route not found' });
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
