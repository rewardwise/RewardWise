import os
from openai import OpenAI

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))


async def generate_text(prompt: str) -> str:
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",  # fast + cheap + good enough
            messages=[
                {"role": "system", "content": "You are a helpful travel assistant."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
        )

        return response.choices[0].message.content

    except Exception as e:
        print("LLM ERROR:", str(e))
        return "I'm having trouble responding right now."