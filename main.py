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

# Config list (26 configs)
config_list = [
    "BM", "BM_CC_CaL", "BM_CC_MEA", "BM_CC_Oxy",
    "BG", "BG_CC_CaL", "BG_CC_MEA", "BG_CC_Oxy",
    "Coal", "Coal_CC_CaL", "Coal_CC_MEA", "Coal_CC_Oxy",
    "H2", "H2_CC_CaL", "H2_CC_MEA", "H2_CC_Oxy",
    "MSW", "MSW_CC_CaL", "MSW_CC_MEA", "MSW_CC_Oxy",
    "NG", "NG_CC_CaL", "NG_CC_MEA", "NG_CC_Oxy",
    "Hybrid", "Plasma"
]

# Load surrogate models
models = {}
for config_name in config_list:
    file_path = MODELS_DIR / f"surrogate_{config_name}.pkl"
    if file_path.exists():
        try:
            model = joblib.load(file_path)
            # Debug info
            print(f"✅ Loaded model: {config_name}")
            print(f"    Type: {type(model)}, Callable: {callable(model)}, Module: {getattr(model, '__module__', None)}")
            try:
                sig = inspect.signature(model)
                print(f"    Signature: {sig}")
            except Exception as e:
                print(f"    Signature inspect failed: {e}")
            models[config_name] = model
        except Exception as e:
            print(f"❌ Failed to load {config_name}: {e}")
    else:
        print(f"⚠️  Skipped model: {config_name} (file not found)")

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

    # Load emissions and energy data from CSV
    emissions_df = pd.read_csv(EMISSIONS_FILE)
    emissions_dict = dict(zip(emissions_df['Case'], emissions_df[emissions_column]))
    energy_dict = dict(zip(emissions_df['Case'], emissions_df['Spec_Energy']))

    # Create input array
    try:
        input_vector = np.array([
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
        return {"error": f"Invalid input vector: {str(e)}"}

    # Prediction results
    results = {}
    for config_name in config_list:
        try:
            model = models.get(config_name)
            if model is None:
                raise ValueError("Model not loaded.")

            # Try .predict() first
            if hasattr(model, "predict"):
                cost = float(model.predict(input_vector)[0])
            else:
                raise ValueError(
                    f"Model for {config_name} is of type {type(model)} and has no .predict(). "
                    "It may be a raw Pythran function requiring extra args."
                )

            emissions = float(emissions_dict.get(config_name, 0.0))
            spec_energy = float(energy_dict.get(config_name, 0.0))

            results[config_name] = {
                "cost": round(cost, 4),
                "emissions": round(emissions, 4),
                "spec_energy": round(spec_energy, 4)
            }
        except Exception as e:
            results[config_name] = {"error": str(e)}

    return {"results": results}

# Path to built frontend
FRONTEND_DIST = BASE_DIR / "pareto-frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="static")
