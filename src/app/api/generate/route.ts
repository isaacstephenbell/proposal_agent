import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { brief, currentContent, prompt } = await request.json();

    // Build context for AI generation
    let contextPrompt = `You are a professional proposal writer helping to create high-quality business proposals. 

Current proposal context:
- Goals: ${brief?.goals?.join(', ') || 'Not specified'}
- Audience: ${brief?.audience?.join(', ') || 'Not specified'}
- Constraints: ${brief?.constraints || 'Not specified'}

Current content excerpt:
${currentContent ? currentContent.slice(-500) : 'No content yet'}

User request: ${prompt}

Please provide helpful, professional content that fits the context and maintains consistency with the existing proposal. Be concise and actionable.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: contextPrompt
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const content = completion.choices[0].message.content;

    return NextResponse.json({ content });
  } catch (error) {
    console.error('Error generating content:', error);
    return NextResponse.json(
      { error: 'Failed to generate content' },
      { status: 500 }
    );
  }
} 