// lib/ai.ts
// === DeepSeek API Call ===
export async function queryDeepSeek(prompt: string): Promise<string> {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://nimc-bot.vercel.app/',
            'X-Title': 'HR AI Assistant',
        },
        body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: 'You are a helpful AI assistant.' },
                { role: 'user', content: prompt },
            ],
            max_tokens: 2000,
            temperature: 0.7,
            top_p: 0.9,
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        console.error('DeepSeek API error:', err);
        throw new Error(`DeepSeek failed: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
}

// === Response Processing (Exact port of Python) ===
const EMPTY_RESPONSE = "I apologize, but I couldn't generate a proper response. Can you send that message again?";

// lib/ai.ts
export function processDeepSeekResponse(response: string): string {
    if (!response || !response.trim()) {
        return "I apologize, but I couldn't generate a proper response. Can you send that message again?";
    }

    let answer = response.trim();

    // Remove code blocks
    if (answer.startsWith('```')) {
        const lines = answer.split('\n');
        answer = lines.slice(1, -1).join('\n').trim();
    }

    // === CRITICAL: Parse JSON if present (with multiple attempts for nested encoding) ===
    let maxAttempts = 5; // Prevent infinite loops
    let attempts = 0;

    while (attempts < maxAttempts) {
        attempts++;

        try {
            const parsed = JSON.parse(answer);

            if (parsed && typeof parsed === 'object') {
                // Extract the answer field if it exists
                if ('answer' in parsed) {
                    const extracted = parsed.answer;

                    // If answer is a string, use it
                    if (typeof extracted === 'string') {
                        answer = extracted.trim();
                        // Check if this is another JSON string that needs parsing
                        if ((answer.startsWith('{') && answer.endsWith('}')) ||
                            (answer.startsWith('[') && answer.endsWith(']'))) {
                            continue; // Try parsing again
                        }
                        break;
                    }
                    // If answer is an object/array, stringify and try again
                    else if (typeof extracted === 'object') {
                        answer = JSON.stringify(extracted);
                        continue;
                    }
                }
                // Handle case where the entire object might be the answer
                else if (Object.keys(parsed).length === 1) {
                    const firstValue = Object.values(parsed)[0];
                    if (typeof firstValue === 'string') {
                        answer = firstValue.trim();
                        // Check if this is another JSON string
                        if ((answer.startsWith('{') && answer.endsWith('}')) ||
                            (answer.startsWith('[') && answer.endsWith(']'))) {
                            continue;
                        }
                        break;
                    } else if (typeof firstValue === 'object') {
                        answer = JSON.stringify(firstValue);
                        continue;
                    }
                }
            }
            // If parsed is a string, it might be double-encoded
            else if (typeof parsed === 'string') {
                answer = parsed.trim();
                // Check if this is another JSON string
                if ((answer.startsWith('{') && answer.endsWith('}')) ||
                    (answer.startsWith('[') && answer.endsWith(']'))) {
                    continue;
                }
            }

            break; // Successfully processed or no more parsing needed

        } catch (e) {
            // Not JSON — exit the loop
            break;
        }
    }

    // Remove markdown
    answer = answer.replace(/\*\*/g, '').replace(/\*/g, '');

    // Remove DeepSeek artifacts
    const artifacts = [
        '<｜begin▁of▁sentence｜>',
        '<|begin_of_sentence|>',
        '<｜end▁of▁sentence｜>',
        '<|end_of_sentence|>',
    ];
    artifacts.forEach(art => {
        answer = answer.replace(new RegExp(art, 'g'), '');
    });

    answer = answer.trim();

    if (!answer || ['""', "''", '{}', '[]', 'null', 'undefined'].includes(answer)) {
        return "I apologize, but I couldn't generate a proper response. Can you send that message again?";
    }

    return answer;
}