// api/generate.js

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, userSpeech, audioData, mimeType, step, totalSteps, chatHistory, customNotes, excludedQuestions } = req.body;
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI_API_KEY environment variable is missing.' });

  const maxSteps = totalSteps || 6;

  let historyExclusionText = '';
  if (excludedQuestions && Array.isArray(excludedQuestions) && excludedQuestions.length > 0) {
    historyExclusionText = `\n[PREVIOUSLY ASKED QUESTIONS FROM PAST SESSIONS - AVOID IF POSSIBLE]:\n${JSON.stringify(excludedQuestions)}\n`;
  }

  // CRITICAL: Custom teacher/admin instructions are placed last so they explicitly override general rules
  const teacherGuidance = customNotes ? `\n[CRITICAL ADMIN / TEACHER OVERRIDE INSTRUCTIONS - PRIORITY ONE]:\n${customNotes}\n(If the teacher explicitly requested a specific topic or question above, you MUST prioritize and include it, overriding general exclusion rules if necessary.)\n` : '';
  
  const combinedCustomNotes = historyExclusionText + teacherGuidance;

  const privacyDirective = `
[STRICT PRIVACY & PII RULE]:
NEVER ask the student for personally identifiable information (PII) under any circumstances.
Prohibited topics: Full name, student ID numbers, street address, specific school name, phone numbers, or passwords.
Keep questions focused on general topics like hobbies, daily routines, weekend plans, school subjects, sports, food, movies, or weather.
`;

  const questionStyleDirective = `
[STRICT BARE-BONES OPEN-ENDED QUESTION RULE]:
1. EVERY SINGLE QUESTION MUST BE OPEN-ENDED: Start every question with "What", "Where", "Why", "When", "Who", or "How". You are strictly forbidden from asking closed Yes/No questions ("Do you...", "Are you...", "Can you...", "Is it...", "Did you...").
2. NO FREQUENCY ADVERBS: Strictly forbid words like "usually", "always", "often", "sometimes", "typically", or "frequently". Keep sentences bare-bones and direct.
3. NO REPETITION WITHIN SESSION: Look closely at the conversation history below. You MUST NOT repeat any question that has already been asked in this session.
4. FOLLOW-UP CONTINUITY: Except for the first question ("Hello! How are you?"), ask one short open-ended follow-up question to each questionbefore stirctly moving on to a totally different topic.
5. MAXIMUM SIMPLICITY (CEFR-J A1.1): Keep every question under 10 words using basic present simple or past simple tense. 
`;

  const pronunciationLenience = `\n[PRONUNCIATION TOLERANCE INSTRUCTION]:\nThe student is a Japanese high school learner. Be extremely forgiving of Japanese-accented English, phonetic slips, or imperfect pronunciation in the audio. Transcribe and interpret what they meant at the CEFR-J A1.1 level, looking past minor phonetic transcription variations.\n`;

  let parts = [];

  if (audioData) {
    let cleanMime = (mimeType || 'audio/webm').split(';')[0].trim();
    if (!cleanMime.startsWith('audio/')) {
      cleanMime = 'audio/webm';
    }

    parts.push({
      inline_data: {
        mime_type: cleanMime,
        data: audioData
      }
    });
  }

  let prompt = '';
  let generationConfig = {
    responseMimeType: "application/json",
    temperature: 0.7,
    maxOutputTokens: 1024
  };

  if (action === 'transcribe_audio') {
    prompt = `You are an expert English audio transcriber for Japanese high school learners at the CEFR-J A1.1 level.
${pronunciationLenience}
Listen to the attached audio recording. Transcribe the spoken English accurately into text, being extremely forgiving of Japanese accents, phonetic slips, or minor variations.`;

    generationConfig.responseSchema = {
      type: "OBJECT",
      properties: {
        transcribedText: { type: "STRING" }
      },
      required: ["transcribedText"]
    };
  } else if (action === 'start_chat') {
    prompt = `You are a warm, supportive English chat partner conducting a ${maxSteps}-step conversation with a Japanese high school student at the STRICT CEFR-J A1.1 level (absolute beginner).
${combinedCustomNotes}
${privacyDirective}
${questionStyleDirective}
CRITICAL RULES:
- Use only basic, high-frequency CEFR-J A1.1 vocabulary (food, sports, hobbies, school, family, weather, movies, Youtube).
- Keep questions under 6 words with zero frequency adverbs.
- For step 1 (the opening message), follow any admin instructions above if provided; otherwise start with: "Hello! How are you?"`;

    generationConfig.responseSchema = {
      type: "OBJECT",
      properties: {
        nextQuestion: { type: "STRING" }
      },
      required: ["nextQuestion"]
    };
  } else if (action === 'chat_turn') {
    const contextHistory = (chatHistory || []).map(t => `Step ${t.step} AI Question: "${t.aiQuestion || 'N/A'}" | Student: "${t.userSpeech}"`).join('\n');

    prompt = `You are a warm, supportive English chat partner conducting a casual conversation with a Japanese high school student at the STRICT CEFR-J A1.1 level (absolute beginner).
Current Step completed: ${step} of ${maxSteps}.
${combinedCustomNotes}
${privacyDirective}
${questionStyleDirective}
Conversation History:
${contextHistory}

Latest Student Text: "${userSpeech}"

CRITICAL RULES:
1. Provide 1–2 sentences of brief, encouraging coaching feedback in simple JAPANESE regarding their response.
2. ASK EXACTLY ONE SINGLE OPEN-ENDED QUESTION starting with What, Where, Why, When, Who, or How.
3. Keep the question under 10 words at the strict CEFR-J A1.1 level with NO frequency adverbs (never use "usually", "always", "often", etc.).
4. Follow any specific topic instructions in [CRITICAL ADMIN / TEACHER OVERRIDE INSTRUCTIONS] if provided.`;

    generationConfig.responseSchema = {
      type: "OBJECT",
      properties: {
        feedback: { type: "STRING" },
        nextQuestion: { type: "STRING" }
      },
      required: ["feedback", "nextQuestion"]
    };
  } else if (action === 'generate_summary_report') {
    const transcriptText = (chatHistory || []).map((t, idx) => `Turn ${idx + 1}:\n  AI Question: ${t.aiQuestion || 'N/A'}\n  Student Answer: ${t.userSpeech}`).join('\n');

    prompt = `You are an expert English language teacher evaluating a Japanese high school student's ${maxSteps}-turn general chat exercise at the STRICT CEFR-J A1.1 level (absolute beginner).
Evaluate the student's overall performance fairly according to the official Japanese High School English Curriculum Standards (高等学校学習指導要領 観点別学習状況の評価), calibrated for CEFR-J A1.1 beginners:
${combinedCustomNotes}
${pronunciationLenience}

Student Transcripts:
${transcriptText}

CRITICAL EVALUATION CRITERIA (3 CATEGORIES & WEIGHTED POINTS):
1. 知識・技能 (Knowledge & Skills - 50 points max / 50% Weight): Accuracy of basic vocabulary, grammar, spelling/transcription accuracy, and structural correctness at CEFR-J A1.1 level.
2. 思考・判断・表現 (Thinking, Judgment & Expression - 30 points max / 30% Weight): Relevancy, logical response to questions asked, and ability to express simple thoughts and opinions.
3. 表現の工夫・主体的に学習に取り組む態度 (Expression & Proactive Attitude - 20 points max / 20% Weight): Communicative engagement, effort to express thoughts naturally, and willingness to participate.
4. overallScore: The exact integer sum of the 3 category points (0 to 100).

INSTRUCTIONS:
1. Write a supportive 2-3 sentence overall evaluation summary strictly in JAPANESE in "subheading".
2. Provide integer scores for each of the 3 official Japanese high school criteria:
   - "knowledgeSkills": integer (0-50)
   - "knowledgeSkillsComment": concise Japanese comment (1-2 sentences)
   - "thinkingJudgment": integer (0-30)
   - "thinkingJudgmentComment": concise Japanese comment (1-2 sentences)
   - "expressionAttitude": integer (0-20)
   - "expressionAttitudeComment": concise Japanese comment (1-2 sentences)
   - "overallScore": integer (0-100, equal to knowledgeSkills + thinkingJudgment + expressionAttitude)
3. Summarize up to 3 genuine grammar/vocabulary corrections in Japanese in "keyCorrections", keeping the "cleaner" phrasing simple and accessible at the CEFR-J A1.1 level.`;

    generationConfig.temperature = 0.2;
    generationConfig.maxOutputTokens = 2048;
    generationConfig.responseSchema = {
      type: "OBJECT",
      properties: {
        subheading: { type: "STRING" },
        overallScore: { type: "INTEGER" },
        scores: {
          type: "OBJECT",
          properties: {
            knowledgeSkills: { type: "INTEGER" },
            knowledgeSkillsComment: { type: "STRING" },
            thinkingJudgment: { type: "INTEGER" },
            thinkingJudgmentComment: { type: "STRING" },
            expressionAttitude: { type: "INTEGER" },
            expressionAttitudeComment: { type: "STRING" }
          },
          required: [
            "knowledgeSkills",
            "knowledgeSkillsComment",
            "thinkingJudgment",
            "thinkingJudgmentComment",
            "expressionAttitude",
            "expressionAttitudeComment"
          ]
        },
        keyCorrections: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              youSaid: { type: "STRING" },
              cleaner: { type: "STRING" },
              explanation: { type: "STRING" }
            },
            required: ["youSaid", "cleaner", "explanation"]
          }
        }
      },
      required: ["subheading", "overallScore", "scores", "keyCorrections"]
    };
  } else {
    return res.status(400).json({ error: 'Invalid action provided.' });
  }

  parts.push({ text: prompt });

  const cleanKey = encodeURIComponent(apiKey.trim());
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=' + cleanKey;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: parts }],
        generationConfig: generationConfig
      })
    });

    const rawBody = await response.text();
    let data;
    try {
      data = JSON.parse(rawBody);
    } catch (e) {
      return res.status(502).json({
        error: `[Upstream Non-JSON Response ${response.status}]: ${rawBody.substring(0, 200)}`
      });
    }

    if (!response.ok) {
      const detailMsg = data.error?.message || JSON.stringify(data.error) || 'Google AI API request failed.';
      return res.status(response.status).json({ 
        error: `[API Error ${response.status}]: ${detailMsg}` 
      });
    }

    const candidate = data.candidates?.[0];
    const generatedText = candidate?.content?.parts?.[0]?.text;
    if (!generatedText) {
      const finishReason = candidate?.finishReason || 'UNKNOWN';
      return res.status(500).json({ error: `AI returned an empty response (finishReason: ${finishReason}).` });
    }

    let cleanJson;
    try {
      cleanJson = JSON.parse(generatedText.trim());
    } catch (parseErr) {
      try {
        let cleanedText = generatedText.trim()
          .replace(/^```(?:json)?/i, '')
          .replace(/```$/i, '')
          .trim();

        const firstBrace = cleanedText.indexOf('{');
        const lastBrace = cleanedText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          cleanedText = cleanedText.substring(firstBrace, lastBrace + 1);
        }

        // Remove trailing commas before closing braces/brackets without corrupting structural newlines
        cleanedText = cleanedText.replace(/,\s*([}\]])/g, '$1');
        cleanJson = JSON.parse(cleanedText);
      } catch (innerErr) {
        return res.status(500).json({ 
          error: `[JSON Parsing Error - finishReason: ${candidate?.finishReason || 'N/A'}]: ${innerErr.message}. Raw snippet: ${generatedText.substring(0, 250)}` 
        });
      }
    }

    if (action === 'generate_summary_report') {
      if (!cleanJson.scores) cleanJson.scores = {};
      const ks = parseInt(cleanJson.scores.knowledgeSkills, 10) || 0;
      const tj = parseInt(cleanJson.scores.thinkingJudgment, 10) || 0;
      const ea = parseInt(cleanJson.scores.expressionAttitude, 10) || 0;

      cleanJson.scores.knowledgeSkills = ks;
      cleanJson.scores.thinkingJudgment = tj;
      cleanJson.scores.expressionAttitude = ea;

      const parsedOverall = parseInt(cleanJson.overallScore, 10);
      cleanJson.overallScore = (!isNaN(parsedOverall) && parsedOverall > 0) ? parsedOverall : (ks + tj + ea);
    }

    return res.status(200).json(cleanJson);
  } catch (err) {
    return res.status(500).json({ error: `[Server Exception]: ${err.stack || err.message}` });
  }
};
