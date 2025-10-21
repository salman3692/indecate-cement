from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
import inspect

app = FastAPI()

# CORS (adjust origins if you want to restrict)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
EMISSIONS_FILE = BASE_DIR / "emissions.csv"

config_list = [
    "BM", "BM_CC_CaL", "BM_CC_MEA", "BM_CC_MEA_HPs", "BM_CC_Oxy",
    "BG", "BG_CC_CaL", "BG_CC_MEA", "BG_CC_MEA_HPs", "BG_CC_Oxy",
    "Coal", "Coal_CC_CaL", "Coal_CC_MEA", "Coal_CC_MEA_HPs", "Coal_CC_Oxy",
    "H2", "H2_CC_CaL", "H2_CC_MEA", "H2_CC_MEA_HPs", "H2_CC_Oxy",
    "MSW", "MSW_CC_CaL", "MSW_CC_MEA", "MSW_CC_MEA_HPs", "MSW_CC_Oxy",
    "NG", "NG_CC_CaL", "NG_CC_MEA", "NG_CC_MEA_HPs", "NG_CC_Oxy",
    "Hybrid", "Plasma"
]

# ---------- Deep repair utilities (dtype + contiguity) ----------

def _repair_ndarray(arr: np.ndarray) -> np.ndarray:
    """Cast & copy arrays to match Pythran expectations."""
    if arr.dtype.kind in ("i", "u"):
        # integers -> platform int (intp) + contiguous
        return np.ascontiguousarray(arr, dtype=np.intp)
    elif arr.dtype.kind == "f":
        # floats -> float64 + contiguous
        return np.ascontiguousarray(arr, dtype=np.float64)
    else:
        # others -> just make contiguous
        return np.ascontiguousarray(arr)

def _repair_object_graph(obj, _seen: set):
    """
    Recursively traverse object attributes/lists/tuples/dicts and
    repair any numpy arrays encountered. Avoid infinite loops.
    """
    oid = id(obj)
    if oid in _seen:
        return
    _seen.add(oid)

    # If directly an ndarray
    if isinstance(obj, np.ndarray):
        return  # handled by caller that owns attribute

    # If it's a dict-like
    if isinstance(obj, dict):
        for k, v in list(obj.items()):
            if isinstance(v, np.ndarray):
                obj[k] = _repair_ndarray(v)
            else:
                _repair_object_graph(v, _seen)
        return

    # If it's a list/tuple
    if isinstance(obj, (list, tuple)):
        for i, v in enumerate(list(obj)):
            if isinstance(v, np.ndarray):
                new_v = _repair_ndarray(v)
                try:
                    obj[i] = new_v  # works for lists
                except TypeError:
                    # tuple: rebuild
                    new_tuple = list(obj)
                    new_tuple[i] = new_v
                    obj = type(obj)(new_tuple)
            else:
                _repair_object_graph(v, _seen)
        return

    # If it looks like a user-defined object, walk its attributes
    # Avoid functions/methods/properties
    try:
        members = inspect.getmembers(obj, lambda a: not(inspect.isroutine(a)))
    except Exception:
        members = []

    for name, val in members:
        if name.startswith("__"):
            continue
        # Skip properties that raise on set
        try:
            getattr(obj, name)
        except Exception:
            continue

        if isinstance(val, np.ndarray):
            try:
                setattr(obj, name, _repair_ndarray(val))
            except Exception:
                pass
        else:
            # Recurse into sub-objects (estimators inside pipelines, etc.)
            try:
                _repair_object_graph(val, _seen)
            except Exception:
                continue

def repair_model_arrays(model):
    """Top-level repair entrypoint for a loaded model (and its internals)."""
    try:
        _repair_object_graph(model, set())
    except Exception:
        pass
    return model

# ---------- Model loading & prediction ----------

def smart_load(path: Path):
    """Load a .pkl model, unwrap if it's a tuple, then repair arrays."""
    try:
        m = joblib.load(path)
        if isinstance(m, tuple):
            # Prefer the first callable / predictor-like element
            for part in m:
                if hasattr(part, "predict") or callable(part):
                    m = part
                    break
        # Deep repair: cast all internal arrays to expected dtypes and contiguity
        m = repair_model_arrays(m)
        return m
    except Exception as e:
        print(f" Failed to load {path.name}: {e}")
        return None

models = {}
for cfg in config_list:
    p = MODELS_DIR / f"surrogate_{cfg}.pkl"
    if p.exists():
        mdl = smart_load(p)
        if mdl is not None:
            models[cfg] = mdl
        else:
            print(f" Skipped {cfg} due to load error")
    else:
        print(f" Missing model file for {cfg}")

def run_predict(model, x: np.ndarray) -> float:
    """
    Predict with maximal compatibility:
    - sklearn-like: .predict
    - callable: model(x) or model(x.ravel())
    Also retries with contiguous input if needed.
    """
    # Ensure input is float64, contiguous, 2D
    x2 = np.ascontiguousarray(x, dtype=np.float64)
    if x2.ndim == 1:
        x2 = x2.reshape(1, -1)

    # Some models (RBF) cache neighbor arrays per call; ensure post-load repair is enough.
    # First attempt: sklearn predict
    if hasattr(model, "predict"):
        try:
            y = model.predict(x2)
            return float(np.ascontiguousarray(y, dtype=np.float64).ravel()[0])
        except Exception:
            pass

    # Second: callable
    if callable(model):
        # try 2D then 1D (some callables accept 1D)
        for candidate in (x2, x2.ravel()):
            try:
                y = model(candidate)
                return float(np.ascontiguousarray(y, dtype=np.float64).ravel()[0])
            except Exception as e:
                # If the failure smells like view/dtype mismatch, try another pass:
                msg = str(e)
                if "pythranized" in msg or "is a view" in msg:
                    # Re-repair model internals once more (some callables build caches lazily)
                    repair_model_arrays(model)
                    try:
                        y = model(candidate)
                        return float(np.ascontiguousarray(y, dtype=np.float64).ravel()[0])
                    except Exception:
                        continue
                # else keep trying next candidate
        # If still not working, bubble up last exception
        raise

    # No usable interface
    raise TypeError("Model is neither sklearn-like nor callable")

# ---------- API ----------

@app.post("/predict")
async def predict(request: Request):
    try:
        payload = await request.json()
    except Exception:
        return {"error": "Invalid JSON body"}

    scenario_key = payload.get("emission_scenario", "RE1")
    col_map = {
        "fossil": "Emissions_energmix_fossil",
        "RE1": "Emissions_energymix_RE1",
        "RE2": "Emissions_energymix_RE2",
    }
    col = col_map.get(scenario_key, "Emissions_energymix_RE1")

    # Load emissions/spec energy
    try:
        df = pd.read_csv(EMISSIONS_FILE)
        em_map = dict(zip(df["Case"], df[col]))
        se_map = dict(zip(df["Case"], df["Spec_Energy"]))
    except Exception as e:
        return {"error": f"Failed to read emissions.csv: {e}"}

    # Build input vector
    try:
        x = np.array([
            payload["cEE"],
            payload["cH2"],
            payload["cNG"],
            payload["cbioCH4"],
            payload["cbiomass"],
            payload["cCoal"],
            payload["cMSW"],
            payload["cCO2"],
            payload["cCO2TnS"],
        ], dtype=np.float64).reshape(1, -1)
    except Exception as e:
        return {"error": f"Invalid inputs: {e}"}

    results = {}
    for cfg in config_list:
        mdl = models.get(cfg)
        if mdl is None:
            results[cfg] = {"error": "Model not loaded"}
            continue
        try:
            y = run_predict(mdl, x)
            results[cfg] = {
                "cost": round(float(y), 4),
                "emissions": round(float(em_map.get(cfg, 0.0)), 4),
                "spec_energy": round(float(se_map.get(cfg, 0.0)), 4),
            }
        except Exception as e:
            # short, clean message
            msg = str(e).split("\n")[0][:300]
            results[cfg] = {"error": msg}

    return {"results": results}

# Serve built React frontend if present (optional)
FRONTEND_DIST = BASE_DIR / "pareto-frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="static")
