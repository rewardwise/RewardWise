import os
import asyncio
from openai import OpenAI


async def generate_text(prompt: str) -> str:
    try:
        api_key = os.getenv("OPENAI_API_KEY")

        if not api_key:
            print("❌ OPENAI_API_KEY missing")
            return "AI service not configured."

        client = OpenAI(api_key=api_key)

        response = await asyncio.to_thread(
            client.chat.completions.create,
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a helpful travel assistant."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
        )

        return response.choices[0].message.content or "No response"

    except Exception as e:
        print("❌ LLM ERROR:", str(e))
        return "I'm having trouble responding right now."