import os
import sys
from typing import Optional
import re

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Ensure we can import sibling module
CURRENT_DIR = os.path.dirname(__file__)
if CURRENT_DIR not in sys.path:
    sys.path.append(CURRENT_DIR)

# Import logic from existing backend code
from final_backend_code import (
    parse_dates_from_query,
    parse_coords_from_query,
    load_txt_files,
    filter_by_date,
    build_and_search,
    fetch_from_postgres,
    to_json,
    to_table_json,
    summarize,
    conversation_chain,
    detect_visualization,
    detect_tabular,
    detect_requested_conditions,
    get_last_state,
    set_last_state,
    geocode_region,
)

app = FastAPI(title="Oceanography Assistant API")

# Allow Next.js dev and any local origins
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    type: str  # 'answer' | 'visualization' | 'table'
    answer: Optional[str] = None
    data: Optional[list] = None


# Utility: Extract best-effort region phrases and clean them for geocoding

def clean_region_query(query: str) -> str:
    """
    Normalize a free-form query into a geocoding-friendly phrase.
    - Strip dates, years, and measurement/task words.
    - Preserve coastal qualifiers like 'coast', 'coastal area'.
    """
    q = (query or "").lower()

    # Remove month-year and standalone years
    q = re.sub(r"\b(january|february|march|april|may|june|july|august|september|october|november|december)\b\s*\d{4}", " ", q, flags=re.I)
    q = re.sub(r"\b\d{4}\b", " ", q)

    # Remove measurement/task words and fillers; keep coastal words
    q = re.sub(r"\b(tell|me|give|show|plot|visualize|table|summary|conditions|temperature|temper|salinity|pressure)\b", " ", q, flags=re.I)

    # Remove leading helper phrases but don't remove 'coast' words
    q = re.sub(r"\b(what(?:'s| is)?|give me|tell me|can you|please|around the|the area of|area near|region near|region of)\b", " ", q, flags=re.I)

    # Remove general prepositions, but keep any 'coast' qualifiers intact
    q = re.sub(r"\b(near|around|close to|by|at|in|on|over|towards)\b", " ", q, flags=re.I)

    q = re.sub(r"\s+", " ", q).strip(", .")
    return q


def extract_region_candidates(query: str) -> list[str]:
    """
    Extract likely place fragments with a strong bias for coastal phrases.
    Returns a list of candidates ordered from most to least specific:
    - First: explicit coastal patterns ("off the coast of {X}", "near {X} coast", "{X} coastal area")
    - Then: generic place fragments + coastal variations
    """
    text = (query or "").strip()
    lower = text.lower()

    # 1) Remove obvious non-location parts: dates, months, numbers with years
    text = re.sub(r"\b(January|February|March|April|May|June|July|August|September|October|November|December)\b\s*\d{4}", " ", text, flags=re.I)
    text = re.sub(r"\b\d{4}\b", " ", text)  # years

    # 1a) Priority: extract coastal-focused phrases directly from the original (lower) text
    priority: list[str] = []

    def add_priority(name: str):
        name = (name or "").strip(" ,.-")
        if not name:
            return
        # Remove common non-geo words around names
        name = re.sub(r"\b(area|region|sea|ocean|water|the)\b", " ", name, flags=re.I)
        name = re.sub(r"\s+", " ", name).strip(" ,.-")
        if not name:
            return
        # Prefer coastal forms
        for cand in [f"coast of {name}", f"{name} coast", f"{name} coastal area"]:
            if cand.lower() not in [c.lower() for c in priority]:
                priority.append(cand)

    coastal_patterns = [
        r"off the coast of\s+([a-zA-Z\s]+)",
        r"near\s+([a-zA-Z\s]+?)\s+coast(?:al)?(?:\s+area)?",
        r"around\s+([a-zA-Z\s]+?)\s+coast(?:al)?(?:\s+area)?",
        r"(?:the\s+)?coast\s+of\s+([a-zA-Z\s]+)",
        r"([a-zA-Z\s]+?)\s+coastal\s+area",
    ]
    for pat in coastal_patterns:
        for m in re.finditer(pat, lower):
            # Extract the matched name slice using original casing and spacing
            start, end = m.start(1), m.end(1)
            add_priority((query or "")[start:end])

    # 2) Split by prepositions that hint at locations; keep segments after these cues
    cues = ["near", "around", "at", "in", "on", "by", "off the coast of", "close to", "towards", "around the", "over"]
    parts = [text]
    for cue in cues:
        new_parts = []
        for p in parts:
            new_parts.extend(p.split(cue))
        parts = new_parts

    # 3) Heuristic cleanup and candidate building
    raw_candidates = []
    for p in parts:
        p = p.strip(" ,.-")
        if not p:
            continue
        # Remove obvious question/task words (keep geographic qualifiers like coast/coastal/area)
        p = re.sub(r"\b(tell|me|give|show|plot|visualize|table|summary|conditions|temperature|temper|salinity|pressure)\b", " ", p, flags=re.I)
        p = re.sub(r"\s+", " ", p).strip(" ,.-")
        if p:
            raw_candidates.append(p)

    # 4) Also try the original cleaned string once
    cleaned = clean_region_query(query)
    if cleaned and cleaned not in raw_candidates:
        raw_candidates.insert(0, cleaned)

    # 5) Build variations with/without "coast" qualifiers for coastal-type asks
    variations = []
    for c in raw_candidates:
        variations.append(c)
        if "coast" not in c.lower():
            variations.append(f"{c} coast")
            variations.append(f"coast of {c}")

    # 6) Deduplicate while preserving order, with priority coastal phrases first
    seen = set()
    ordered = []
    for v in priority + variations:
        v2 = re.sub(r"\s+", " ", v).strip(" ,.-")
        if v2 and v2.lower() not in seen:
            seen.add(v2.lower())
            ordered.append(v2)

    # Reasonable bound to avoid too many calls
    return ordered[:6]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/chat/send", response_model=ChatResponse)
def chat_send(req: ChatRequest):
    user_input = req.message or ""
    is_visualization = detect_visualization(user_input)
    is_tabular = detect_tabular(user_input)
    requested_conditions = detect_requested_conditions(user_input)
    query_summary = ("summary" in user_input.lower()) or (not is_visualization and not is_tabular)

    # Parse time window
    year, month, start_date, end_date = parse_dates_from_query(user_input)

    # Load and filter data
    df = load_txt_files(year, month)
    df_filtered = filter_by_date(df, start_date, end_date)

    # Parse coordinates first
    query_lat, query_lon = parse_coords_from_query(user_input)

    # If no coords, try progressively extracting multiple candidates and geocoding them
    if query_lat is None or query_lon is None:
        candidates = extract_region_candidates(user_input)
        for cand in candidates:
            geo_lat, geo_lon = geocode_region(cand)
            if geo_lat is not None and geo_lon is not None:
                query_lat, query_lon = geo_lat, geo_lon
                break

    json_data = None
    answer = ""

    # Try reusing last known context for follow-ups (e.g., "give me in table")
    state = get_last_state()
    if (query_lat is None or query_lon is None) and state:
        year, month, start_date, end_date = state["year"], state["month"], state["start_date"], state["end_date"]
        query_lat, query_lon = state["lat"], state["lon"]

    if query_lat is not None and query_lon is not None:
        if state and state["lat"] == query_lat and state["lon"] == query_lon and state["start_date"] == start_date and state["end_date"] == end_date:
            profiles_data = state["profiles_data"]
            measurement_summaries = state["measurement_summaries"]
            nearest_ids = state["nearest_ids"]
        else:
            nearest_ids, _ = build_and_search(df_filtered, query_lat, query_lon)
            # Pass start/end date to ensure we only return the requested month window
            profiles_data, measurement_summaries = fetch_from_postgres(nearest_ids, int(year), start_date, end_date)
            set_last_state(year, month, start_date, end_date, query_lat, query_lon, nearest_ids, profiles_data, measurement_summaries)

        if is_visualization:
            # Build both text answer and visualization data, filtered to requested conditions only
            prompt_text = summarize(
                profiles_data,
                measurement_summaries,
                "Summarize the requested conditions and provide a concise description.",
                requested_conditions,
            )
            answer = conversation_chain.predict(input=prompt_text)
            json_data = to_json(profiles_data, measurement_summaries, requested_conditions)
            return ChatResponse(type="visualization", data=json_data, answer=answer)

        if is_tabular:
            # If user asked for specific conditions, only include those columns
            json_data = to_table_json(profiles_data, measurement_summaries, requested_conditions)
            return ChatResponse(type="table", data=json_data)

        if query_summary:
            prompt_text = summarize(
                profiles_data,
                measurement_summaries,
                "Summarize ocean conditions near these coordinates.",
                requested_conditions,
            )
            answer = conversation_chain.predict(input=prompt_text)
            return ChatResponse(type="answer", answer=answer)

        # Fallback
        return ChatResponse(type="answer", answer="No specific request detected.")
    else:
        # Could not determine a location
        return ChatResponse(type="answer", answer="Could not determine location. Please provide lat/lon or a valid region.")