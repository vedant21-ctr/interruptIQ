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
    # Update signals_used list based on triggered rules
    
    # Fast Rule Engine    
    if ctx.get("network") == "offline" and notif != "urgent":
        return {
            "decision": "IGNORE",
            "reason": "Device offline. Dropping non-critical notifications.",
            "confidence": 100,
            "signals_used": ["network"]
        }
        
    if float(ctx.get("battery", 100)) < 15.0 and not ctx.get("charging", False) and notif != "urgent":
        return {
            "decision": "IGNORE",
            "reason": "Battery critical and not charging. Conserving power.",
            "confidence": 99,
            "signals_used": ["battery", "charging"]
        }
        
    if ctx.get("location") == "road" and notif != "urgent":
        return {
            "decision": "DELAY",
            "reason": "User is detected on the road.",
            "confidence": 95,
            "signals_used": ["location", "motion"]
        }

    if ctx.get("time_of_day") == "night" and notif != "urgent":
        return {
            "decision": "DELAY",
            "reason": "Nighttime detected. Batching notifications.",
            "confidence": 90,
            "signals_used": ["time_of_day"]
        }

    if ctx.get("visibility") == "hidden" and notif != "urgent":
        return {
            "decision": "DELAY",
            "reason": "App not in focus. Delaying interruption.",
            "confidence": 85,
            "signals_used": ["visibility"]
        }

    if ctx.get("activity") == "idle" and notif == "social":
        return {
            "decision": "IGNORE",
            "reason": "User is idle. Ignoring low priority.",
            "confidence": 88,
            "signals_used": ["activity"]
        }

    if notif == "urgent":
        return {
            "decision": "NOTIFY NOW",
            "reason": "Urgent notifications bypass rules.",
            "confidence": 100,
            "signals_used": ["notification_type"]
        }
        
    # AI Fallback/Processing
    ai_decision = get_openai_decision(ctx, notif)
    
    # Ensure signals_used is present
    if "signals_used" not in ai_decision:
        ai_decision["signals_used"] = ["time_of_day", "activity", "visibility", "network", "battery", "location"]
        
    return ai_decision
