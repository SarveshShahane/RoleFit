import re
import json
from groq import Groq
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from core.config import settings
from app.schemas.rag import ParsedQuery
from app.prompts.prompts import SYSTEM_PROMPT, GENERATION_SYSTEM_PROMPT

GENERATION_PROMPT = ChatPromptTemplate.from_messages([
    ("system", GENERATION_SYSTEM_PROMPT),
    ("human", "{prompt_content}"),
])


class LLMClient:
    def __init__(self):
        self.api_key = settings.GROQ_API_KEY
        self.model = settings.LLM_MODEL
        self.groq_client = None
        self.llm = None
        self.generation_chain = None

        if self.api_key:
            try:
                self.groq_client = Groq(api_key=self.api_key)
                self.llm = ChatGroq(
                    api_key=self.api_key,
                    model=self.model,
                    temperature=0.1,
                )
                self.generation_chain = GENERATION_PROMPT | self.llm | StrOutputParser()
            except Exception as e:
                print(f"[LLM WARNING] Failed to initialize Groq client: {e}")

    def parse_query(self, user_query: str) -> ParsedQuery:
        clean_text = user_query.strip()
        if not clean_text:
            return ParsedQuery(rewritten_query="", keywords=[], exclude_keywords=[], limit=10, intent="general")

        is_general = bool(re.match(r'^(hi|hello|hey|help|who are you|what can you do)\b', clean_text, re.I))
        if is_general:
            return ParsedQuery(rewritten_query=clean_text, keywords=[], exclude_keywords=[], limit=10, intent="general")

        if self.groq_client:
            try:
                resp = self.groq_client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": f"Extract search criteria for: \"{clean_text}\""},
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.0,
                )
                data = json.loads(resp.choices[0].message.content)
                target_role = data.get("target_role")
                if target_role and target_role.lower() in ["none", "null", "all", "any"]:
                    target_role = None
                required_skills = [s.strip() for s in (data.get("required_skills") or []) if s and s.strip()]
                keywords = [k.strip() for k in (data.get("keywords") or []) if k and k.strip()]
                exclude_keywords = [w.lower() for w in (data.get("exclude_keywords") or [])]
                rewritten_query = data.get("rewritten_query") or clean_text
                limit = data.get("limit") or 10
                try:
                    limit = max(1, min(int(limit), 50))
                except Exception:
                    limit = 10

                return ParsedQuery(
                    rewritten_query=rewritten_query,
                    target_role=target_role,
                    required_skills=required_skills,
                    keywords=keywords,
                    exclude_keywords=exclude_keywords,
                    limit=limit,
                    intent="search",
                )
            except Exception as e:
                print(f"[LLM WARNING] Groq query parser call failed ({e}). Using fallback parser.")

        return self._fallback_parse(clean_text)

    def _fallback_parse(self, text: str) -> ParsedQuery:
        limit_match = re.search(r'\b(?:top|first|get|find)\s+(\d{1,2})\b', text, re.I) or re.search(
            r'\b(\d{1,2})\s+(?:candidates|resumes|people|devs|engineers)\b', text, re.I
        )
        limit = int(limit_match.group(1)) if limit_match else 10
        limit = max(1, min(limit, 50))

        exclude_match = re.findall(r'\b(?:no|not|without|exclude|excluding)\s+([a-zA-Z0-9+#]+)', text, re.I)
        exclude_keywords = [w.lower() for w in exclude_match]
        is_general = bool(re.match(r'^(hi|hello|hey|help|who are you|what can you do)\b', text.strip(), re.I))

        text_lower = text.lower()
        target_role = None
        if "product manager" in text_lower:
            target_role = "Product Manager"
        elif "project manager" in text_lower:
            target_role = "Project Manager"
        elif "scrum master" in text_lower:
            target_role = "Scrum Master"
        elif "python" in text_lower:
            target_role = "Python Developer"
        elif "java" in text_lower:
            target_role = "Java Developer"
        elif "php" in text_lower:
            target_role = "PHP Developer"

        required_skills = []
        for s in ["python", "node.js", "nodejs", "node", "java", "php", "hadoop", "aws"]:
            if re.search(r'\b' + re.escape(s) + r'\b', text_lower):
                required_skills.append(s)

        stop_words = {
            "give", "find", "top", "best", "candidates", "resumes", "developer", "developers",
            "with", "and", "for", "tell", "me", "their", "work", "exp", "experience", "impact",
            "most", "recent", "education", "skills", "responsibilities", "leadership", "among", "all"
        }
        raw_words = re.findall(r'[a-zA-Z0-9+#]+', text)
        keywords = [
            w for w in raw_words
            if len(w) > 2 and w.lower() not in exclude_keywords and w.lower() not in stop_words
        ]

        return ParsedQuery(
            rewritten_query=text,
            target_role=target_role,
            required_skills=required_skills,
            keywords=keywords,
            exclude_keywords=exclude_keywords,
            limit=limit,
            intent="general" if is_general else "search",
        )

    def stream_answer(self, query: str, candidates: list[dict], intent: str = "search"):
        clean_query = query.strip()
        if intent == "general" or not clean_query:
            yield (
                "Hello! I am your ATS AI assistant. Ask me to find candidates "
                "(e.g., 'Java Developers with AWS' or 'Scrum Masters'), evaluate candidates against a "
                "Job Description, or deep-dive into specific candidate profiles."
            )
            return

        if not candidates:
            yield f"No candidate resumes in the database match your criteria for: **{clean_query}**."
            return

        prompt_content = self._format_context_prompt(clean_query, candidates)

        if self.generation_chain:
            try:
                for chunk in self.generation_chain.stream({"prompt_content": prompt_content}):
                    if chunk:
                        yield chunk
                return
            except Exception as e:
                print(f"[LLM WARNING] LangChain Groq streaming failed ({e}). Using fallback synthesis.")

        yield self._fallback_summary(clean_query, candidates)

    def _format_context_prompt(self, query: str, candidates: list[dict]) -> str:
        context_blocks = []
        for idx, c in enumerate(candidates, 1):
            name = c.get("candidate_name") or c.get("name") or f"Candidate {idx}"
            role = c.get("role") or "Not specified"
            rid = c.get("resume_id", "N/A")
            score = c.get("score", 0.0)

            raw_text = c.get("full_resume") or c.get("top_matched_chunk") or ""
            clean_text = raw_text.strip()
            if len(clean_text) > 3000:
                clean_text = clean_text[:3000] + "\n[... truncated for context length ...]"

            block = (
                f"### [Candidate {idx}]: {name}\n"
                f"- Candidate ID: {rid}\n"
                f"- Role: {role}\n"
                f"- Match Score: {score}\n"
                f"- Resume Text:\n{clean_text}\n"
            )
            context_blocks.append(block)

        context_str = "\n".join(context_blocks)
        return (
            f"User / Recruiter Request:\n{query}\n\n"
            f"--- Qualifying Candidates ({len(candidates)}) ---\n"
            f"{context_str}\n\n"
            "Instructions: Provide a direct, point-to-point response addressing the recruiter's request strictly using the qualifying candidates above. State key skills, roles, and verified project evidence. Keep it concise, factual, and actionable with zero boilerplate."
        )

    def _fallback_summary(self, query: str, candidates: list[dict]) -> str:
        if not candidates:
            return f"No candidate resumes in the database match your criteria for: **{query}**."

        if len(candidates) == 1:
            c = candidates[0]
            name = c.get("candidate_name") or c.get("name") or "Candidate"
            role = c.get("role") or "Applicant"
            rid = c.get("resume_id", "N/A")
            score = c.get("score", 1.0)
            score_display = f"{int(score * 100)}%" if score <= 1.0 else f"{score}"

            text = c.get("full_resume") or c.get("top_matched_chunk") or ""
            preview = text[:600] + ("..." if len(text) > 600 else "")

            return (
                f"### Candidate Profile: **{name}**\n\n"
                f"- **Role**: {role}\n"
                f"- **Candidate ID**: `{rid}`\n"
                f"- **Match Score**: {score_display}\n\n"
                f"#### Resume Summary & Background:\n"
                f"{preview}\n"
            )

        lines = [
            f"### ATS Screening Report: *\"{query}\"*\n",
            f"Found **{len(candidates)}** matching candidate(s):\n",
        ]

        for idx, c in enumerate(candidates, 1):
            name = c.get("candidate_name") or c.get("name") or f"Candidate {idx}"
            role = c.get("role") or "Role not specified"
            score = c.get("score", 0.0)
            score_display = f"{int(score * 100)}%" if score <= 1.0 else f"{score}"

            raw_chunk = c.get("top_matched_chunk") or c.get("full_resume") or ""
            words = raw_chunk.split()
            preview = " ".join(words[:40]) + "..." if words else "No excerpt available."

            lines.append(f"#### {idx}. **{name}** — *{role}* ({score_display})")
            lines.append(f"- **Key Evidence**: {preview}")
            lines.append("")

        return "\n".join(lines)


llm_client = LLMClient()
