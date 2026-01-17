import os
import pandas as pd
import numpy as np
from datetime import datetime, timezone
import faiss
import psycopg2
from dotenv import load_dotenv
from langchain_google_genai import GoogleGenerativeAI
from langchain.memory import ConversationBufferMemory
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.chains import LLMChain
import json
import re
import calendar
import httpx
from urllib.parse import quote_plus


data_root = r"C:\Users\Mit\Desktop\argo project\Argo_Dataset\txt"

DB_CONFIG = {
    "dbname": "all_indian_ocean",
    "user": "postgres",
    "password": "Mit@1010",
    "host": "localhost",
    "port": "5432"
}


load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
GEOCODER_API_KEY = "68d10cacc13ee724221487gvb9f57e8"


GEMINI_MODEL = "gemini-1.5-flash"

llm = GoogleGenerativeAI(
    model=GEMINI_MODEL,
    google_api_key=GOOGLE_API_KEY,
    temperature=0.2
)

# Conversation setup
memory = ConversationBufferMemory(memory_key="history", return_messages=True)

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant specialized in oceanography."),
    MessagesPlaceholder("history"),
    ("human", "{input}")
])

conversation_chain = LLMChain(
    llm=llm,
    prompt=prompt,
    memory=memory
)

# Lightweight in-memory session state for follow-ups
LAST_STATE = {
    "year": None,
    "month": None,
    "start_date": None,
    "end_date": None,
    "lat": None,
    "lon": None,
    "nearest_ids": None,
    "profiles_data": None,
    "measurement_summaries": None,
}

def set_last_state(year, month, start_date, end_date, lat, lon, nearest_ids, profiles_data, measurement_summaries):
    LAST_STATE.update({
        "year": year,
        "month": month,
        "start_date": start_date,
        "end_date": end_date,
        "lat": lat,
        "lon": lon,
        "nearest_ids": nearest_ids,
        "profiles_data": profiles_data,
        "measurement_summaries": measurement_summaries,
    })
    print("[Checkpoint] Updated LAST_STATE for follow-up continuity")


def get_last_state():
    return LAST_STATE if LAST_STATE.get("profiles_data") else None

# UTILITY FUNCTIONS
def detect_visualization(query: str) -> bool:
    """Return True if the user asks for visualization in their query."""
    if not query:
        return False
    keywords = ["visualize", "visualization", "chart", "plot", "graph", "show chart", "display graph"]
    q = query.lower()
    return any(k in q for k in keywords)


def detect_tabular(query: str) -> bool:
    """Return True if the user asks for tabular/table output in their query."""
    if not query:
        return False
    keywords = [
        "table", "tabular", "tabulated", "grid", "rows and columns",
        "table format", "tabular format", "show in table", "render a table"
    ]
    q = query.lower()
    return any(k in q for k in keywords)


def detect_requested_conditions(query: str):
    """Detect which oceanographic condition(s) the user asked for.
    Returns a list subset of ["temperature", "salinity", "pressure"].
    """
    if not query:
        return []
    q = query.lower()
    mapping = {
        "temperature": ["temperature", "temp"],
        "salinity": ["salinity", "saline", "salt"],
        "pressure": ["pressure", "pres"],
    }
    found = []
    for key, kws in mapping.items():
        if any(kw in q for kw in kws):
            found.append(key)
    return found


def load_txt_files(year: str, month: str):
    folder_path = os.path.join(data_root, year)
    if not os.path.exists(folder_path):
        return pd.DataFrame()

    files = [f for f in os.listdir(folder_path) if f.endswith(".txt") and f"in{year}{month}" in f]
    dfs = []
    for file in files:
        file_path = os.path.join(folder_path, file)
        df = pd.read_csv(file_path)
        df.columns = df.columns.str.strip().str.lower()
        df['file_path'] = file_path
        df['date_time_min'] = pd.to_datetime(df['date_time_min'], errors='coerce', utc=True)
        df['date_time_max'] = pd.to_datetime(df['date_time_max'], errors='coerce', utc=True)
        dfs.append(df)
    print(f"[Checkpoint] Loaded {len(dfs)} files for {year}-{month}")
    return pd.concat(dfs, ignore_index=True) if dfs else pd.DataFrame()

def filter_by_date(df, start_date, end_date):
    if df.empty:
        print("[Checkpoint] No data to filter")
        return df
    if start_date.tzinfo is None:
        start_date = start_date.replace(tzinfo=timezone.utc)
    if end_date.tzinfo is None:
        end_date = end_date.replace(tzinfo=timezone.utc)
    filtered = df[(df['date_time_min'] <= end_date) & (df['date_time_max'] >= start_date)].reset_index(drop=True)
    print(f"[Checkpoint] Filtered data to {len(filtered)} records between {start_date} and {end_date}")
    return filtered


# FAISS SEARCH FUNCTION (NO TIME)
def build_and_search(df, query_lat, query_lon, k=10):
    if df.empty:
        print("[Checkpoint] No data for FAISS search")
        return [], []

    vectors = np.stack([
        np.array([(row['latitude_min'] + row['latitude_max']) / 2,
                  (row['longitude_min'] + row['longitude_max']) / 2], dtype='float32')
        for _, row in df.iterrows()
    ])
    
    index_to_id = df['floatid'].astype(str).tolist()
    index_to_file = df['file_path'].tolist()
    latitudes = ((df['latitude_min'] + df['latitude_max']) / 2).tolist()
    longitudes = ((df['longitude_min'] + df['longitude_max']) / 2).tolist()

    dimension = 2
    index = faiss.IndexFlatL2(dimension)
    index.add(vectors)

    query_vector = np.array([[query_lat, query_lon]], dtype='float32')
    distances, indices = index.search(query_vector, k=min(k, len(df)))

    closest_files = {}
    closest_coords = []

    for idx in indices[0]:
        fid = index_to_id[idx]
        if fid not in closest_files:
            closest_files[fid] = index_to_file[idx]
            closest_coords.append((latitudes[idx], longitudes[idx]))

    print(f"[Checkpoint] FAISS search found {len(closest_files)} closest floats")
    for i, (lat, lon) in enumerate(closest_coords, 1):
        print(f"   → Closest #{i}: Latitude={lat:.4f}, Longitude={lon:.4f}")

    exact_match = df[
        (np.isclose((df['latitude_min'] + df['latitude_max']) / 2, query_lat, atol=1e-3)) &
        (np.isclose((df['longitude_min'] + df['longitude_max']) / 2, query_lon, atol=1e-3))
    ]
    if not exact_match.empty:
        exact_id = str(exact_match.iloc[0]['floatid'])
        if exact_id not in closest_files:
            print(f"[Checkpoint] Exact coordinate match found → Float ID {exact_id}")
            return [exact_id] + list(closest_files.keys()), [exact_match.iloc[0]['file_path']] + list(closest_files.values())

    return list(closest_files.keys()), list(closest_files.values())


# POSTGRES FETCH FUNCTIONS
def fetch_from_postgres(float_ids, year, start_date=None, end_date=None):
    """Fetch profiles and aggregated measurements for given float_ids within optional time window.

    - Only queries the yearly partition table (profiles_{year}).
    - If start_date/end_date provided, filters by profile_datetime BETWEEN those bounds.
    """
    if not float_ids:
        print("[Checkpoint] No float IDs for DB fetch")
        return [], []

    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    # Convert to integers to match BIGINT column
    float_ids = [int(fid) for fid in float_ids if str(fid).isdigit()]
    partition_table = f"profiles_{year}"

    where_time = " AND profile_datetime BETWEEN %s AND %s" if (start_date and end_date) else ""
    sql_profiles = f"""
        SELECT profile_id, year, month, float_id, latitude, longitude, depth_min, depth_max, file_path, profile_datetime
        FROM {partition_table}
        WHERE float_id = ANY(%s){where_time}
        ORDER BY profile_datetime
    """
    params = [float_ids]
    if start_date and end_date:
        params.extend([start_date, end_date])
    cur.execute(sql_profiles, params)
    profiles_data = cur.fetchall()
    print(f"[Checkpoint] Retrieved {len(profiles_data)} profiles from DB (with date filter: {bool(start_date and end_date)})")

    measurement_summaries = []
    for profile in profiles_data:
        profile_id = profile[0]
        sql_measurements = """
            SELECT MIN(pressure), MAX(pressure), AVG(pressure),
                   MIN(temperature), MAX(temperature), AVG(temperature),
                   MIN(salinity), MAX(salinity), AVG(salinity)
            FROM measurements
            WHERE profile_id = %s
        """
        cur.execute(sql_measurements, (profile_id,))
        stats = cur.fetchone()
        measurement_summaries.append({
            "profile_id": profile_id,
            "pressure_min": stats[0], "pressure_max": stats[1], "pressure_avg": stats[2],
            "temperature_min": stats[3], "temperature_max": stats[4], "temperature_avg": stats[5],
            "salinity_min": stats[6], "salinity_max": stats[7], "salinity_avg": stats[8]
        })

    cur.close()
    conn.close()
    print(f"[Checkpoint] Computed measurement summaries for {len(measurement_summaries)} profiles")
    return profiles_data, measurement_summaries

def safe_float(val, precision=2):
    try:
        return f"{float(val):.{precision}f}"
    except (TypeError, ValueError):
        return "Unknown"

def to_json(profiles_data, measurement_summaries, conditions=None):
    """Return JSON for visualization. If `conditions` provided, include only those condition keys
    in the measurements dict (min/max/avg for each requested condition)."""
    allowed = set(conditions or [])
    def filter_measurements(stats):
        if not allowed:
            return {
                "pressure_min": stats['pressure_min'], "pressure_max": stats['pressure_max'], "pressure_avg": stats['pressure_avg'],
                "temperature_min": stats['temperature_min'], "temperature_max": stats['temperature_max'], "temperature_avg": stats['temperature_avg'],
                "salinity_min": stats['salinity_min'], "salinity_max": stats['salinity_max'], "salinity_avg": stats['salinity_avg']
            }
        out = {}
        if "pressure" in allowed:
            out.update({
                "pressure_min": stats['pressure_min'], "pressure_max": stats['pressure_max'], "pressure_avg": stats['pressure_avg']
            })
        if "temperature" in allowed:
            out.update({
                "temperature_min": stats['temperature_min'], "temperature_max": stats['temperature_max'], "temperature_avg": stats['temperature_avg']
            })
        if "salinity" in allowed:
            out.update({
                "salinity_min": stats['salinity_min'], "salinity_max": stats['salinity_max'], "salinity_avg": stats['salinity_avg']
            })
        return out

    json_list = []
    for profile, stats in zip(profiles_data, measurement_summaries):
        json_list.append({
            "profile_id": profile[0],
            "float_id": profile[3],
            "datetime": profile[9].strftime('%Y-%m-%dT%H:%M:%SZ') if profile[9] else None,
            "location": {"latitude": profile[4], "longitude": profile[5]},
            "depth_range": {"min": profile[6], "max": profile[7]},
            "measurements": filter_measurements(stats)
        })
    print(f"[Checkpoint] Converted profiles to JSON ({len(json_list)} records) filtered for {', '.join(allowed) if allowed else 'all conditions'}")
    return json_list


def to_table_json(profiles_data, measurement_summaries, conditions=None):
    """Flatten profiles and measurement stats into row-wise JSON suitable for a table.
    If `conditions` is provided (list like ["temperature"]), limit columns to:
    year, month, latitude, longitude + requested condition min/max/avg.
    """
    rows = []
    limit_fields = conditions and len(conditions) > 0
    for profile, stats in zip(profiles_data, measurement_summaries):
        if limit_fields:
            lat = profile[4]
            lon = profile[5]
            row = {
                "float_id": profile[3],
                "latitude": round(lat, 4) if isinstance(lat, (int, float)) and lat is not None else lat,
                "longitude": round(lon, 4) if isinstance(lon, (int, float)) and lon is not None else lon,
                "depth_min": round(profile[6], 3) if isinstance(profile[6], (int, float)) and profile[6] is not None else profile[6],
                "depth_max": round(profile[7], 3) if isinstance(profile[7], (int, float)) and profile[7] is not None else profile[7],
            }
            for cond in conditions:
                if cond == "temperature":
                    row["temperature"] = round(stats['temperature_avg'], 3) if stats['temperature_avg'] is not None else None
                elif cond == "salinity":
                    row["salinity"] = round(stats['salinity_avg'], 3) if stats['salinity_avg'] is not None else None
                elif cond == "pressure":
                    row["pressure"] = round(stats['pressure_avg'], 3) if stats['pressure_avg'] is not None else None
            rows.append(row)
        else:
            # Compact, screen-friendly table: drop profile_id, file_path, datetime, year, month; keep averages only and round to 3 decimals
            lat = profile[4]
            lon = profile[5]
            rows.append({
                "float_id": profile[3],
                "latitude": round(lat, 4) if isinstance(lat, (int, float)) and lat is not None else lat,
                "longitude": round(lon, 4) if isinstance(lon, (int, float)) and lon is not None else lon,
                "depth_min": round(profile[6], 3) if isinstance(profile[6], (int, float)) and profile[6] is not None else profile[6],
                "depth_max": round(profile[7], 3) if isinstance(profile[7], (int, float)) and profile[7] is not None else profile[7],
                "pressure": round(stats['pressure_avg'], 3) if stats['pressure_avg'] is not None else None,
                "temperature": round(stats['temperature_avg'], 3) if stats['temperature_avg'] is not None else None,
                "salinity": round(stats['salinity_avg'], 3) if stats['salinity_avg'] is not None else None,
            })
    print(f"[Checkpoint] Built table JSON ({len(rows)} rows) with {'filtered' if limit_fields else 'all'} columns")
    return rows

def summarize(profiles_data, measurement_summaries, user_question, requested_conditions=None):
    if not profiles_data:
        print("[Checkpoint] No profiles to summarize")
        return "No profiles found for the given floats."
    # Build condition lines depending on request
    def build_condition_lines(stats):
        lines = []
        allowed = set([c for c in (requested_conditions or [])])
        include_all = len(allowed) == 0
        if include_all or "pressure" in allowed:
            lines.append(f"   • Pressure: min {safe_float(stats['pressure_min'])}, max {safe_float(stats['pressure_max'])}, avg {safe_float(stats['pressure_avg'])}")
        if include_all or "temperature" in allowed:
            lines.append(f"   • Temperature: min {safe_float(stats['temperature_min'])}, max {safe_float(stats['temperature_max'])}, avg {safe_float(stats['temperature_avg'])}")
        if include_all or "salinity" in allowed:
            lines.append(f"   • Salinity: min {safe_float(stats['salinity_min'])}, max {safe_float(stats['salinity_max'])}, avg {safe_float(stats['salinity_avg'])}")
        return "\n".join(lines)

    all_summaries = "\n\n".join([
        f"""
- Float ID: {profile[3]}
- Date: {profile[9].strftime('%Y-%m-%d %H:%M:%S') if profile[9] else 'Unknown'}
- Location: Latitude {safe_float(profile[4])}, Longitude {safe_float(profile[5])}
- Depth Range: {safe_float(profile[6])} - {safe_float(profile[7])} meters
- Conditions:
{build_condition_lines(stats)}
""" for profile, stats in zip(profiles_data, measurement_summaries)
    ])
    # Add explicit instruction to restrict to requested conditions if provided
    restrict_text = "" if not requested_conditions else (
        "Only report the following conditions and nothing else: " + ", ".join(requested_conditions) + ".\n"
    )
    prompt_text = f"""
You are an expert oceanography assistant.
Use ONLY the information in the profiles below.
Do NOT invent float IDs, dates, or measurements.
Just give the answer related to the oceanographic conditions you were asked about.
If the user asks questions other than ocean then reply I am an oceanographic assistant, please ask me the questions related to it.
{restrict_text}
Profiles retrieved:
{all_summaries}

Question: {user_question}
"""
    print("[Checkpoint] Prepared summary prompt for LLM")
    return prompt_text


# Parse date from user input
def parse_dates_from_query(query):
    match = re.search(r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})", query, re.I)
    if match:
        month_str, year_str = match.groups()
        month = str(list(calendar.month_name).index(month_str.capitalize())).zfill(2)
        year = year_str
        start_date = datetime(int(year), int(month), 1)
        end_date = datetime(int(year), int(month), calendar.monthrange(int(year), int(month))[1], 23, 59, 59)
        print(f" [Checkpoint] Parsed dates: {start_date} → {end_date}")
        return year, month, start_date, end_date
    print("[Checkpoint] No date found, defaulting to Jan 2019")
    return "2019", "01", datetime(2019, 1, 1), datetime(2019, 1, 31, 23, 59, 59)


# Extract coordinates from query
def parse_coords_from_query(query):
    lat_match = re.search(r"lat\s*[-+]?\d*\.?\d+", query, re.I)
    lon_match = re.search(r"lon\s*[-+]?\d*\.?\d+", query, re.I)
    if lat_match and lon_match:
        lat = float(re.search(r"[-+]?\d*\.?\d+", lat_match.group()).group())
        lon = float(re.search(r"[-+]?\d*\.?\d+", lon_match.group()).group())
        print(f"[Checkpoint] Parsed coordinates: lat={lat}, lon={lon}")
        return lat, lon
    print("[Checkpoint] No coordinates found in query")
    return None, None


def geocode_region(query: str):
    """
    Geocode a natural language region/place name using https://geocode.maps.co.
    Returns (lat, lon) as floats, or (None, None) if not found.
    """
    try:
        if not query or not query.strip():
            return None, None
        # Build URL exactly like: https://geocode.maps.co/search?q=...&api_key=YOUR_SECRET_API_KEY
        q_enc = quote_plus(query.strip())
        url = f"https://geocode.maps.co/search?q={q_enc}&api_key={GEOCODER_API_KEY}"
        # Short timeout to keep requests snappy
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(url)
            if resp.status_code != 200:
                print(f"[Geocode] HTTP {resp.status_code} for query='{query}'")
                return None, None
            results = resp.json() or []
            if not results:
                print(f"[Geocode] No results for query='{query}'")
                return None, None
            item = results[0]
            lat = float(item.get("lat")) if item.get("lat") is not None else None
            lon = float(item.get("lon")) if item.get("lon") is not None else None
            if lat is None or lon is None:
                print(f"[Geocode] Missing lat/lon in first result for query='{query}'")
                return None, None
            print(f"[Geocode] '{query}' -> lat={lat}, lon={lon}")
            return lat, lon
    except Exception as e:
        print(f"[Geocode] Error geocoding '{query}': {e}")
        return None, None

def extract_last_coords_from_memory():
    history_messages = memory.load_memory_variables({})["history"]
    for msg in reversed(history_messages):
        match = re.search(r"lat\s*([-+]?\d*\.?\d*)\s*.lon\s([-+]?\d*\.?\d*)", msg.content, re.I)
        if match:
            print(f"[Checkpoint] Extracted last coords from memory: lat={match.group(1)}, lon={match.group(2)}")
            return float(match.group(1)), float(match.group(2))
    print("[Checkpoint] No previous coordinates in memory")
    return None, None


# CHATBOT LOOP
if __name__ == "__main__":
    print(f" Oceanography Chatbot is ready! (using {GEMINI_MODEL}) Type 'exit' to quit.\n")

    while True:
        user_input = input("You: ")
        if user_input.lower() in ["exit", "quit"]:
            print("Goodbye!")
            break

        try:
            is_visualization = any(x in user_input.lower() for x in ["visualize", "chart", "plot", "graph", "show chart", "display graph"])
            is_tabular = detect_tabular(user_input)
            query_summary = "summary" in user_input.lower() or (not is_visualization and not is_tabular)

            year, month, start_date, end_date = parse_dates_from_query(user_input)
            df = load_txt_files(year, month)
            df_filtered = filter_by_date(df, start_date, end_date)

            query_lat, query_lon = parse_coords_from_query(user_input)
            if query_lat is None or query_lon is None:
                query_lat, query_lon = extract_last_coords_from_memory()

            json_data = None
            answer = ""

            state = get_last_state()

            if query_lat is None or query_lon is None:
                # Try to reuse last context if user asks follow-up like "give me in table"
                if state:
                    year, month, start_date, end_date = state["year"], state["month"], state["start_date"], state["end_date"]
                    query_lat, query_lon = state["lat"], state["lon"]
                else:
                    query_lat, query_lon = extract_last_coords_from_memory()

            if query_lat is not None and query_lon is not None:
                if state and state["lat"] == query_lat and state["lon"] == query_lon and state["start_date"] == start_date and state["end_date"] == end_date:
                    # Reuse last query results
                    profiles_data, measurement_summaries, nearest_ids = state["profiles_data"], state["measurement_summaries"], state["nearest_ids"]
                else:
                    nearest_ids, _ = build_and_search(df_filtered, query_lat, query_lon)
                    profiles_data, measurement_summaries = fetch_from_postgres(nearest_ids, int(year), start_date, end_date)
                    set_last_state(year, month, start_date, end_date, query_lat, query_lon, nearest_ids, profiles_data, measurement_summaries)

                if is_visualization:
                    json_data = to_json(profiles_data, measurement_summaries)
                elif is_tabular:
                    json_data = to_table_json(profiles_data, measurement_summaries)

                if query_summary:
                    prompt_text = summarize(profiles_data, measurement_summaries, "Summarize ocean conditions near these coordinates.")
                    answer = conversation_chain.predict(input=prompt_text)
                elif json_data is not None:
                    answer = "Structured data ready for frontend."
                else:
                    answer = "Visualization data ready. Use the JSON provided to render the graph."
            else:
                answer = conversation_chain.predict(input=user_input)

        except Exception as e:
            answer = f"Error: {e}"
            json_data = None

        print(f"Assistant: {answer}\n")
        if json_data:
            print("JSON Visualization Data:")
            print(json.dumps(json_data, indent=2))