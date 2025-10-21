from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from fastapi.staticfiles import StaticFiles
import inspect

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Base directories
BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
EMISSIONS_FILE = BASE_DIR / "emissions.csv"

# Config list (extended with MEA_HPs)
config_list = [
    "BM", "BM_CC_CaL", "BM_CC_MEA", "BM_CC_MEA_HPs", "BM_CC_Oxy",
    "BG", "BG_CC_CaL", "BG_CC_MEA", "BG_CC_MEA_HPs", "BG_CC_Oxy",
    "Coal", "Coal_CC_CaL", "Coal_CC_MEA", "Coal_CC_MEA_HPs", "Coal_CC_Oxy",
    "H2", "H2_CC_CaL", "H2_CC_MEA", "H2_CC_MEA_HPs", "H2_CC_Oxy",
    "MSW", "MSW_CC_CaL", "MSW_CC_MEA", "MSW_CC_MEA_HPs", "MSW_CC_Oxy",
    "NG", "NG_CC_CaL", "NG_CC_MEA", "NG_CC_MEA_HPs", "NG_CC_Oxy",
    "Hybrid", "Plasma"
]

def smart_load_model(path):
    """Try to load any type of model safely and unwrap if needed."""
    try:
        model = joblib.load(path)

        # If it's a tuple like (poly, model) or (scaler, model)
        if isinstance(model, tuple):
            # try to find actual model part inside tuple
            for item in model:
                if callable(item) or hasattr(item, "predict"):
                    model = item
                    break

        # Contiguize known numeric arrays (optional safety)
        for attr in ["xi", "y", "_nodes", "_coeffs", "_norm", "_neighbors"]:
            if hasattr(model, attr):
                arr = getattr(model, attr)
                if isinstance(arr, np.ndarray):
                    setattr(model, attr, np.ascontiguousarray(arr))

        return model

    except Exception as e:
        print(f" Failed to load model {path.name}: {e}")
        return None


# Load surrogate models dynamically
models = {}
for config_name in config_list:
    model_path = MODELS_DIR / f"surrogate_{config_name}.pkl"
    if model_path.exists():
        model = smart_load_model(model_path)
        if model is not None:
            models[config_name] = model
        else:
            print(f"Skipped {config_name} due to load error")
    else:
        print(f" Model not found for {config_name}")


@app.post("/predict")
async def predict(request: Request):
    input_data = await request.json()

    # Extract emission scenario (default to RE1 if not provided)
    scenario_key = input_data.get("emission_scenario", "RE1")
    scenario_map = {
        "fossil": "Emissions_energmix_fossil",
        "RE1": "Emissions_energymix_RE1",
        "RE2": "Emissions_energymix_RE2"
    }
    emissions_column = scenario_map.get(scenario_key)
    if emissions_column is None:
        return {"error": f"Invalid emission_scenario: {scenario_key}"}

    # Load emissions and specific energy data
    emissions_df = pd.read_csv(EMISSIONS_FILE)
    emissions_dict = dict(zip(emissions_df['Case'], emissions_df[emissions_column]))
    energy_dict = dict(zip(emissions_df['Case'], emissions_df['Spec_Energy']))

    # Prepare input vector
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
        return {"error": f"Invalid input vector: {e}"}

    x = np.ascontiguousarray(x, dtype=np.float64)

    # Prediction phase
    results = {}
    for config_name in config_list:
        try:
            model = models.get(config_name)
            if model is None:
                raise ValueError("Model not loaded")

            # sklearn-like model
            if hasattr(model, "predict"):
                y_pred = model.predict(x)

            # callable function (e.g., RBFInterpolator or custom)
            elif callable(model):
                # sometimes model() expects plain ndarray, not (1, n)
                try:
                    y_pred = model(x)
                except Exception:
                    y_pred = model(x.flatten())

            # fallback: evaluate any callable attribute
            else:
                callable_attrs = [
                    getattr(model, a) for a in dir(model)
                    if callable(getattr(model, a)) and not a.startswith("_")
                ]
                if callable_attrs:
                    y_pred = callable_attrs[0](x)
                else:
                    raise ValueError("Model has no callable interface")

            cost = float(np.ascontiguousarray(y_pred).ravel()[0])
            emissions = float(emissions_dict.get(config_name, 0.0))
            spec_energy = float(energy_dict.get(config_name, 0.0))

            results[config_name] = {
                "cost": round(cost, 4),
                "emissions": round(emissions, 4),
                "spec_energy": round(spec_energy, 4)
            }

        except Exception as e:
            # Simplify error message for frontend
            msg = str(e).split("\n")[0][:300]
            results[config_name] = {"error": msg}

    return {"results": results}


# Serve built frontend if it exists
FRONTEND_DIST = BASE_DIR / "pareto-frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="static")
