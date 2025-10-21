from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from fastapi.staticfiles import StaticFiles
import traceback

app = FastAPI()

# Enable CORS for frontend (so your React app can fetch from it)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories
BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
EMISSIONS_FILE = BASE_DIR / "emissions.csv"

# Configurations
config_list = [
    "BM", "BM_CC_CaL", "BM_CC_MEA", "BM_CC_MEA_HPs", "BM_CC_Oxy",
    "BG", "BG_CC_CaL", "BG_CC_MEA", "BG_CC_MEA_HPs", "BG_CC_Oxy",
    "Coal", "Coal_CC_CaL", "Coal_CC_MEA", "Coal_CC_MEA_HPs", "Coal_CC_Oxy",
    "H2", "H2_CC_CaL", "H2_CC_MEA", "H2_CC_MEA_HPs", "H2_CC_Oxy",
    "MSW", "MSW_CC_CaL", "MSW_CC_MEA", "MSW_CC_MEA_HPs", "MSW_CC_Oxy",
    "NG", "NG_CC_CaL", "NG_CC_MEA", "NG_CC_MEA_HPs", "NG_CC_Oxy",
    "Hybrid", "Plasma"
]

def safe_load_model(file_path):
    """Try loading models safely with multiple patterns."""
    try:
        model = joblib.load(file_path)
        # Unwrap tuples (e.g. (scaler, model))
        if isinstance(model, tuple):
            for part in model:
                if callable(part) or hasattr(part, "predict"):
                    model = part
                    break
        return model
    except Exception as e:
        print(f"⚠️ Could not load model {file_path.name}: {e}")
        return None


def safe_predict(model, x):
    """Try to predict with all possible fallbacks."""
    try:
        # sklearn-like
        if hasattr(model, "predict"):
            return float(model.predict(x)[0])

        # callable (e.g. RBFInterpolator)
        elif callable(model):
            try:
                return float(model(x)[0])
            except Exception:
                # Sometimes RBF models require flattening
                return float(model(np.ascontiguousarray(x.flatten()))[0])

        # If all else fails
        else:
            raise TypeError("Model is not callable or compatible")

    except Exception as e:
        msg = str(e)
        # Detect view/contiguity issues
        if "is a view" in msg or "pythranized" in msg:
            try:
                x2 = np.ascontiguousarray(x, dtype=np.float64)
                return float(model(x2)[0])
            except Exception as inner:
                raise RuntimeError(f"Contiguity retry failed: {inner}")
        # Return the original error if all retries fail
        raise


# Load all models safely
models = {}
for cfg in config_list:
    f = MODELS_DIR / f"surrogate_{cfg}.pkl"
    if f.exists():
        models[cfg] = safe_load_model(f)
    else:
        print(f"❌ Model not found: {cfg}")


@app.post("/predict")
async def predict(request: Request):
    """Main prediction endpoint."""
    try:
        input_data = await request.json()
    except Exception:
        return {"error": "Invalid JSON input"}

    # Select emission scenario
    scenario_map = {
        "fossil": "Emissions_energmix_fossil",
        "RE1": "Emissions_energymix_RE1",
        "RE2": "Emissions_energymix_RE2",
    }
    scenario_key = input_data.get("emission_scenario", "RE1")
    emissions_column = scenario_map.get(scenario_key, "Emissions_energymix_RE1")

    # Load emissions
    try:
        df = pd.read_csv(EMISSIONS_FILE)
        emissions = dict(zip(df["Case"], df[emissions_column]))
        energy = dict(zip(df["Case"], df["Spec_Energy"]))
    except Exception as e:
        return {"error": f"Cannot read emissions file: {e}"}

    # Input vector
    try:
        x = np.array([
            input_data["cEE"],
            input_data["cH2"],
            input_data["cNG"],
            input_data["cbioCH4"],
            input_data["cbiomass"],
            input_data["cCoal"],
            input_data["cMSW"],
            input_data["cCO2"],
            input_data["cCO2TnS"]
        ], dtype=np.float64).reshape(1, -1)
    except Exception as e:
        return {"error": f"Invalid input format: {e}"}

    # Prediction loop
    results = {}
    for cfg in config_list:
        m = models.get(cfg)
        if m is None:
            results[cfg] = {"error": "Model not loaded"}
            continue

        try:
            y = safe_predict(m, x)
            results[cfg] = {
                "cost": round(y, 4),
                "emissions": round(float(emissions.get(cfg, 0.0)), 4),
                "spec_energy": round(float(energy.get(cfg, 0.0)), 4)
            }
        except Exception as e:
            err = str(e).split("\n")[0][:250]
            results[cfg] = {"error": err}

    return {"results": results}


# Serve frontend if exists
FRONTEND_DIST = BASE_DIR / "pareto-frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="static")
