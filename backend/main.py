from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai_client import get_openai_decision

app = FastAPI(title="Interrupt IQ Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class DecisionInput(BaseModel):
    context: dict
    notification: str

@app.post("/decision")
def decide(input_data: DecisionInput):
    ctx = input_data.context
    notif = input_data.notification
    
    # Fast Rule Engine
    if ctx.get("location") == "road" and notif != "urgent":
        return {
            "decision": "DELAY",
            "reason": "User is detected on the road.",
            "confidence": 95
        }
        
    if float(ctx.get("battery", 100)) < 10.0 and notif != "urgent":
        return {
            "decision": "IGNORE",
            "reason": "Critical battery mode. Blocked non-urgent.",
            "confidence": 99
        }
        
    if notif == "urgent":
        return {
            "decision": "NOTIFY NOW",
            "reason": "Urgent notifications bypass rules.",
            "confidence": 100
        }
        
    # AI Fallback/Processing
    ai_decision = get_openai_decision(ctx, notif)
    return ai_decision
