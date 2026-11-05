import re
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from core.config import settings
from app.schemas.rag import ParsedQuery


SYSTEM_PROMPT = """Analyze the input query for candidate search. Return a JSON object with:
- rewritten_query: focused technical search string without boilerplate.
- keywords: 3-8 key technical tools or skills for keyword matching.
- exclude_keywords: skills or roles explicitly excluded.
- limit: requested candidate count (1-50, default 10).
- intent: "general" for greetings/chitchat, otherwise "search".
"""

GENERATION_SYSTEM_PROMPT = """You are RoleFit AI, an ATS technical recruiter assistant.
Evaluate candidate resumes and answer questions strictly using the provided context.

Guidelines:
- Only use facts present in the provided resume context.
- If information is not mentioned in the resume (such as salary or relocation), explicitly state "Not mentioned in resume".
- Provide a concise summary, per-candidate assessment with match rating and evidence, and recommendation.
- Keep responses objective and formatted in markdown.
"""

QUERY_ANALYSIS_PROMPT = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),
    ("human", "{query}"),
])

GENERATION_PROMPT = ChatPromptTemplate.from_messages([
    ("system", GENERATION_SYSTEM_PROMPT),
    ("human", "{prompt_content}"),
])


class LLMClient:
    def __init__(self):
        self.api_key = settings.GROQ_API_KEY
        self.model = settings.LLM_MODEL
        self.llm = None
        self.structured_chain = None
        self.generation_chain = None

        # Initialize LangChain Groq model and prompt chains.
        if self.api_key:
            try:
                self.llm = ChatGroq(
                    api_key=self.api_key,
                    model=self.model,
                    temperature=0.1,
                )
                self.structured_chain = QUERY_ANALYSIS_PROMPT | self.llm.with_structured_output(ParsedQuery)
                self.generation_chain = GENERATION_PROMPT | self.llm | StrOutputParser()
            except Exception as e:
                print(f"[LLM WARNING] Failed to initialize LangChain ChatGroq: {e}")

    def parse_query(self, user_query: str) -> ParsedQuery:
        clean_text = user_query.strip()
        if not clean_text:
            return ParsedQuery(rewritten_query="", keywords=[], exclude_keywords=[], limit=10, intent="general")

        # Parse query using LangChain structured output chain.
        if self.structured_chain:
            try:
                parsed = self.structured_chain.invoke({"query": clean_text})
                if isinstance(parsed, ParsedQuery):
                    parsed.exclude_keywords = [w.lower() for w in (parsed.exclude_keywords or [])]
                    parsed.limit = max(1, min(parsed.limit or 10, 50))
                    return parsed
            except Exception as e:
                print(f"[LLM WARNING] LangChain structured query call failed ({e}). Using fallback parser.")

        # Fall back to regex parser if model is unavailable.
        return self._fallback_parse(clean_text)

    def _fallback_parse(self, text: str) -> ParsedQuery:
        # Extract candidate count from query.
        limit_match = re.search(r'\b(?:top|first|get|find)\s+(\d{1,2})\b', text, re.I) or re.search(
            r'\b(\d{1,2})\s+(?:candidates|resumes|people|devs|engineers)\b', text, re.I
        )
        limit = int(limit_match.group(1)) if limit_match else 10
        limit = max(1, min(limit, 50))

        # Extract negative keyword exclusions.
        exclude_match = re.findall(r'\b(?:no|not|without|exclude|excluding)\s+([a-zA-Z0-9+#]+)', text, re.I)
        exclude_keywords = [w.lower() for w in exclude_match]

        # Identify conversational greetings.
        is_general = bool(re.match(r'^(hi|hello|hey|help|who are you|what can you do)\b', text.strip(), re.I))

        # Extract technical keywords for BM25 matching.
        raw_words = re.findall(r'[a-zA-Z0-9+#]+', text)
        stop_words = {"give", "find", "top", "candidates", "resumes", "developer", "developers", "with", "and", "for"}
        keywords = [
            w for w in raw_words
            if len(w) > 2 and w.lower() not in exclude_keywords and w.lower() not in stop_words
        ]

        return ParsedQuery(
            rewritten_query=text,
            keywords=keywords,
            exclude_keywords=exclude_keywords,
            limit=limit,
            intent="general" if is_general else "search",
        )

    def generate_answer(self, query: str, candidates: list[dict], intent: str = "search") -> str:
        clean_query = query.strip()
        # Return greeting response without LLM call.
        if intent == "general" or not clean_query:
            return (
                "Hello! I am your ATS AI assistant. Ask me to find candidates "
                "(e.g., 'Top 5 Python Backend Engineers with FastAPI'), evaluate candidates against a "
                "Job Description, or deep-dive into specific candidate profiles."
            )

        # Return message if no candidates matched search.
        if not candidates:
            return f"No candidate resumes in the database matched your search query: '{clean_query}'."

        prompt_content = self._format_context_prompt(clean_query, candidates)

        # Generate response using LangChain generation chain.
        if self.generation_chain:
            try:
                response = self.generation_chain.invoke({"prompt_content": prompt_content})
                return response.strip()
            except Exception as e:
                print(f"[LLM WARNING] LangChain Groq generation failed ({e}). Using fallback synthesis.")

        # Fall back to structured synthesis if model is unavailable.
        return self._fallback_generate(clean_query, candidates, intent)

    def _format_context_prompt(self, query: str, candidates: list[dict]) -> str:
        # Build structured context block for each candidate.
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
            f"--- Candidate Context ({len(candidates)} candidate(s)) ---\n"
            f"{context_str}\n\n"
            "Instructions: Synthesize a professional ATS candidate evaluation and answer the user's request based strictly on the context above."
        )

    def _fallback_generate(self, query: str, candidates: list[dict], intent: str = "search") -> str:
        if not candidates:
            return f"No candidate resumes matched your search criteria for: '{query}'."

        # Build single candidate profile.
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
                f"{preview}\n\n"
                f"> **Note**: Detailed LLM natural language synthesis will activate when a live `GROQ_API_KEY` is provided in `.env`."
            )

        # Build multi-candidate screening report.
        lines = [
            f"### ATS Screening Report: *\"{query}\"*\n",
            f"Found **{len(candidates)}** candidate(s) matching your criteria:\n",
        ]

        for idx, c in enumerate(candidates, 1):
            name = c.get("candidate_name") or c.get("name") or f"Candidate {idx}"
            role = c.get("role") or "Role not specified"
            rid = c.get("resume_id", "N/A")
            score = c.get("score", 0.0)
            score_display = f"{int(score * 100)}%" if score <= 1.0 else f"{score}"

            raw_chunk = c.get("top_matched_chunk") or c.get("full_resume") or ""
            words = raw_chunk.split()
            preview = " ".join(words[:40]) + "..." if words else "No excerpt available."

            lines.append(f"#### {idx}. **{name}** — *{role}* (Match: {score_display})")
            lines.append(f"- **Candidate ID**: `{rid}`")
            if c.get("filename"):
                lines.append(f"- **Filename**: `{c.get('filename')}`")
            lines.append(f"- **Key Evidence**: {preview}")
            lines.append("")

        lines.append("---")
        lines.append(
            "**Recruiter Recommendation**: The candidates above are ranked using hybrid vector similarity and BM25 keyword matching."
        )
        return "\n".join(lines)


llm_client = LLMClient()

