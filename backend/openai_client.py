import os
from openai import OpenAI
from dotenv import load_dotenv
import json

load_dotenv()

# We expect OPENAI_API_KEY to be present in .env
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def get_openai_decision(context: dict, notification: str):
    prompt_content = f"""
User Context:
- heart_rate: {context.get('heart_rate')}
- motion: {context.get('motion')}
- location: {context.get('location')}
- battery: {context.get('battery')}
- activity: {context.get('activity')}

Notification:
- type: {notification}

Return JSON strictly:
{{
  "decision": "IGNORE" | "DELAY" | "NOTIFY NOW",
  "reason": "short explanation",
  "confidence": <number 0-100>
}}
"""
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are an attention intelligence system. Based on user context and notification type, decide whether to IGNORE, DELAY, or NOTIFY NOW. Respond ONLY with the requested JSON structure."
                },
                {"role": "user", "content": prompt_content}
            ],
            response_format={ "type": "json_object" },
            temperature=0.3
        )
        
        content = response.choices[0].message.content
        return json.loads(content)
    except Exception as e:
        print(f"OpenAI error: {e}")
        return {
            "decision": "NOTIFY NOW",
            "reason": "Fallback due to AI error.",
            "confidence": 50
        }
