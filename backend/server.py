from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
APP_DIR = ROOT_DIR.parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Models
class FormHelpRequest(BaseModel):
    field_label: str
    field_type: Optional[str] = "input"
    field_options: Optional[str] = ""
    section_context: Optional[str] = ""
    help_text: Optional[str] = ""
    form_context: Optional[str] = "Indian Passport Application Form"

class QuestionOption(BaseModel):
    label: str
    value: str
    recommendation: Optional[str] = None

class FormHelpResponse(BaseModel):
    needs_interaction: bool = False
    clarification_question: Optional[str] = None
    question_options: List[QuestionOption] = []
    advice: str
    warning: str
    field_label: str
    recommended_value: Optional[str] = None

class ChatHistory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    field_label: str
    response: dict
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PageContext(BaseModel):
    page_title: Optional[str] = ""
    page_url: Optional[str] = ""
    form_data: Optional[dict] = {}
    page_text: Optional[str] = ""

class ChatMessage(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str
    timestamp: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChatRequest(BaseModel):
    message: str
    page_context: PageContext
    chat_history: List[ChatMessage] = []

class ChatResponse(BaseModel):
    response: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# LLM Chat setup
def get_llm_chat(session_id: str) -> LlmChat:
    api_key = os.environ.get('EMERGENT_LLM_KEY')
    if not api_key:
        raise ValueError("EMERGENT_LLM_KEY not found in environment variables")
    
    system_message = """You are an expert Indian Government document consultant helping users fill the Passport Seva application form.

Your job is to help users understand form questions and advise which option to select based on their situation.

For questions with options (dropdowns, radio buttons like Yes/No), provide:
1. A clarifying question to understand the user's situation
2. Answer options that map to the form options
3. Clear recommendation for each answer

Return JSON with:
- needs_interaction: true (if question needs clarification) or false (for simple text fields)
- clarification_question: Question to ask the user (e.g., "Are you or your parents government employees?")
- question_options: Array of scenarios with recommendations:
  [{"label": "Yes, I/my parents are government employees", "value": "yes", "recommendation": "Select 'Yes'"},
   {"label": "No, neither I nor my parents work for the government", "value": "no", "recommendation": "Select 'No'"}]
- advice: Brief explanation of what this field means
- warning: Important mistake to avoid

Examples:
- For "Is either of your parent a government servant?" → Ask if they/parents work for government → Recommend Yes/No
- For "Is applicant eligible for Non-ECR?" → Ask about education level → Recommend Yes if 10th pass
- For "Employment Type" dropdown → Ask about current occupation → Recommend appropriate option

Always return valid JSON only, no markdown."""
    
    chat = LlmChat(
        api_key=api_key,
        session_id=session_id,
        system_message=system_message
    )
    chat.with_model("gemini", "gemini-2.5-flash")
    return chat

# Routes
@api_router.get("/")
async def root():
    return {"message": "FormWise API"}

@api_router.post("/form-help", response_model=FormHelpResponse)
async def get_form_help(request: FormHelpRequest):
    """Get AI-powered guidance for a specific form field."""
    try:
        session_id = f"form-helper-{uuid.uuid4()}"
        chat = get_llm_chat(session_id)
        
        # Build prompt with detected options if available
        options_info = ""
        if request.field_options:
            options_info = f"\nDetected form options: {request.field_options}"
        if request.section_context:
            options_info += f"\nForm section: {request.section_context}"
        if request.help_text:
            options_info += f"\nHelp text shown next to the field: {request.help_text}"
        
        user_prompt = f"""User needs help with this form question:
Question/Field: "{request.field_label}"
Field type: {request.field_type}{options_info}
Form: {request.form_context}

Provide guidance on how to answer this question. If it's a Yes/No question or dropdown, ask a clarifying question to help them decide which option to select.

Return JSON with needs_interaction, clarification_question, question_options (with label, value, recommendation), advice, and warning."""
        
        user_message = UserMessage(text=user_prompt)
        response = await chat.send_message(user_message)
        
        # Parse the JSON response
        try:
            # Clean up the response - remove markdown code blocks if present
            cleaned_response = response.strip()
            if cleaned_response.startswith("```json"):
                cleaned_response = cleaned_response[7:]
            if cleaned_response.startswith("```"):
                cleaned_response = cleaned_response[3:]
            if cleaned_response.endswith("```"):
                cleaned_response = cleaned_response[:-3]
            cleaned_response = cleaned_response.strip()
            
            parsed = json.loads(cleaned_response)
            
            # Parse question options if present
            question_options = []
            if parsed.get("needs_interaction") and "question_options" in parsed and isinstance(parsed["question_options"], list):
                for opt in parsed["question_options"]:
                    question_options.append(QuestionOption(
                        label=opt.get("label", ""),
                        value=opt.get("value", ""),
                        recommendation=opt.get("recommendation", "")
                    ))
            
            result = FormHelpResponse(
                needs_interaction=parsed.get("needs_interaction", False),
                clarification_question=parsed.get("clarification_question"),
                question_options=question_options,
                advice=parsed.get("advice", "Enter the required information accurately."),
                warning=parsed.get("warning", "Double-check for any typos before submitting."),
                field_label=request.field_label,
                recommended_value=parsed.get("recommended_value")
            )
            
            # Save to history
            history_entry = ChatHistory(
                session_id=session_id,
                field_label=request.field_label,
                response=result.model_dump()
            )
            doc = history_entry.model_dump()
            doc['timestamp'] = doc['timestamp'].isoformat()
            await db.form_help_history.insert_one(doc)
            
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response: {response}, error: {e}")
            # Return fallback response
            return FormHelpResponse(
                needs_interaction=False,
                clarification_question=None,
                question_options=[],
                advice="Enter the required details as per your official documents.",
                warning="Ensure accuracy to avoid application rejection.",
                field_label=request.field_label,
                recommended_value=None
            )
            
    except Exception as e:
        logger.error(f"Error getting form help: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/form-help/history")
async def get_form_help_history(limit: int = 10):
    """Get recent form help queries."""
    history = await db.form_help_history.find(
        {}, 
        {"_id": 0}
    ).sort("timestamp", -1).to_list(limit)
    return history

@api_router.post("/chat", response_model=ChatResponse)
async def chat_with_ai(request: ChatRequest):
    """Chat with AI assistant about the form with full page context."""
    try:
        # Create a unique session ID based on page URL
        session_id = f"chat-{uuid.uuid4()}"
        
        # Build context-aware system message
        system_message = f"""You are an expert assistant helping users fill out the Indian Passport Seva application form and other government forms.

You have access to the current webpage context including:
- Page Title: {request.page_context.page_title}
- Page URL: {request.page_context.page_url}
- Visible form fields and their current values
- All instructions, terms, and help text on the page

Your role:
1. Answer questions about the form fields, requirements, and process
2. Explain what documents are needed
3. Help users understand confusing terminology
4. Guide them through the application process step-by-step
5. Clarify eligibility criteria and requirements
6. Explain consequences of different choices

Use the page context to give accurate, specific answers. Reference specific sections or fields from the page when relevant.
Be concise, helpful, and friendly. If you don't see information on the page about their question, tell them clearly.

Always prioritize accuracy and cite information from official sources when possible."""

        # Create chat instance
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise ValueError("EMERGENT_LLM_KEY not found in environment variables")
        
        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message=system_message
        )
        chat.with_model("gemini", "gemini-2.5-flash")
        
        # Build context string
        context_parts = []
        if request.page_context.page_text:
            # Truncate page text to first 8000 chars to avoid token limits
            page_text_preview = request.page_context.page_text[:8000]
            if len(request.page_context.page_text) > 8000:
                page_text_preview += "... [truncated]"
            context_parts.append(f"PAGE CONTENT:\n{page_text_preview}")
        
        if request.page_context.form_data:
            form_fields = []
            for field_name, field_value in request.page_context.form_data.items():
                if field_value:
                    form_fields.append(f"- {field_name}: {field_value}")
            if form_fields:
                context_parts.append(f"CURRENT FORM VALUES:\n" + "\n".join(form_fields))
        
        # Build user message with context and chat history
        user_prompt_parts = []
        
        # Add conversation history
        if request.chat_history and len(request.chat_history) > 0:
            user_prompt_parts.append("CONVERSATION HISTORY:")
            for msg in request.chat_history[-10:]:  # Last 10 messages
                role_label = "User" if msg.role == "user" else "Assistant"
                user_prompt_parts.append(f"{role_label}: {msg.content}")
            user_prompt_parts.append("")
        
        # Add page context
        if context_parts:
            user_prompt_parts.append("WEBPAGE CONTEXT:")
            user_prompt_parts.extend(context_parts)
            user_prompt_parts.append("")
        
        # Add current user message
        user_prompt_parts.append(f"USER QUESTION:\n{request.message}")
        
        full_prompt = "\n".join(user_prompt_parts)
        
        # Send to Gemini
        user_message = UserMessage(text=full_prompt)
        ai_response = await chat.send_message(user_message)
        
        # Store in database
        chat_log = {
            "id": str(uuid.uuid4()),
            "session_id": session_id,
            "page_url": request.page_context.page_url,
            "user_message": request.message,
            "ai_response": ai_response,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await db.chat_history.insert_one(chat_log)
        
        return ChatResponse(
            response=ai_response.strip(),
            timestamp=datetime.now(timezone.utc)
        )
        
    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/extension/download")
async def download_extension():
    """Download the Chrome extension as a zip file."""
    extension_path = APP_DIR / "formwise-extension.zip"
    if not extension_path.exists():
        raise HTTPException(status_code=404, detail="Extension package not found")
    return FileResponse(
        path=str(extension_path),
        filename="formwise-extension.zip",
        media_type="application/zip"
    )

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
