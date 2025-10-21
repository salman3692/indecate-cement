from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import joblib
import numpy as np
import pandas as pd
from pathlib import Path

# --------- CRITICAL PATCH for SciPy RBFInterpolator + Pythran ----------
def _patch_scipy_rbf_pythran():
    """
    Monkey-patch SciPy's internal pythran function used by RBFInterpolator
    so that it always receives C-contiguous arrays with the expected dtypes.
    This avoids runtime errors like:
      "Invalid call to pythranized function ... (is a view)"
    """
    try:
        import scipy
        # SciPy 1.11+ keeps this here:
        from scipy.interpolate import _rbfinterp_pythran as _rbf_mod
    except Exception:
        # If SciPy not present or layout different, just skip patch.
        return

    if not hasattr(_rbf_mod, "_build_evaluation_coefficients"):
        return

    _orig = _rbf_mod._build_evaluation_coefficients

    def _patched_build_eval_coeffs(A, B, kernel, epsilon, neighbors, scaling, shifts):
        # Coerce all array-like inputs to the exact layout/types pythran expects
        A2 = np.ascontiguousarray(A, dtype=np.float64)
        B2 = np.ascontiguousarray(B, dtype=np.float64)
        # neighbors must be int32 2D C-contiguous
        N2 = np.ascontiguousarray(neighbors, dtype=np.int32)
        s2 = np.ascontiguousarray(scaling, dtype=np.float64)
        sh2 = np.ascontiguousarray(shifts, dtype=np.float64)
        eps = float(epsilon)
        return _orig(A2, B2, kernel, eps, N2, s2, sh2)

    # Apply the patch
    _rbf_mod._build_evaluation_coefficients = _patched_build_eval_coeffs

_patch_scipy_rbf_pythran()
# -----------------------------------------------------------------------

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten later if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Paths
BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
EMISSIONS_FILE = BASE_DIR / "emissions.csv"

# All configurations
config_list = [
    "BM", "BM_CC_CaL", "BM_CC_MEA", "BM_CC_MEA_HPs", "BM_CC_Oxy",
    "BG", "BG_CC_CaL", "BG_CC_MEA", "BG_CC_MEA_HPs", "BG_CC_Oxy",
    "Coal", "Coal_CC_CaL", "Coal_CC_MEA", "Coal_CC_MEA_HPs", "Coal_CC_Oxy",
    "H2", "H2_CC_CaL", "H2_CC_MEA", "H2_CC_MEA_HPs", "H2_CC_Oxy",
    "MSW", "MSW_CC_CaL", "MSW_CC_MEA", "MSW_CC_MEA_HPs", "MSW_CC_Oxy",
    "NG", "NG_CC_CaL", "NG_CC_MEA", "NG_CC_MEA_HPs", "NG_CC_Oxy",
    "Hybrid", "Plasma"
]

def smart_load_model(path: Path):
    """Load a model and unwrap common tuple formats like (preproc, model)."""
    try:
        m = joblib.load(path)
        if isinstance(m, tuple):
            # pick the first callable/.predict item
            for part in m:
                if hasattr(part, "predict") or callable(part):
                    m = part
                    break
        return m
    except Exception as e:
        print(f" Could not load {path.name}: {e}")
        return None

# Load all models
models = {}
for name in config_list:
    fp = MODELS_DIR / f"surrogate_{name}.pkl"
    if fp.exists():
        mdl = smart_load_model(fp)
        if mdl is not None:
            models[name] = mdl
        else:
            print(f" Skipped {name} due to load error")
    else:
        print(f" Missing model file: surrogate_{name}.pkl")

@app.post("/predict")
async def predict(request: Request):
    try:
        payload = await request.json()
    except Exception:
        return {"error": "Invalid JSON"}

    # Emission scenario mapping
    scen = payload.get("emission_scenario", "RE1")
    scen_map = {
        "fossil": "Emissions_energmix_fossil",
        "RE1": "Emissions_energymix_RE1",
        "RE2": "Emissions_energymix_RE2"
    }
    col = scen_map.get(scen)
    if col is None:
        return {"error": f"Invalid emission_scenario: {scen}"}

    # Emissions/spec energy
    try:
        df = pd.read_csv(EMISSIONS_FILE)
        emap = dict(zip(df["Case"], df[col]))
        smap = dict(zip(df["Case"], df["Spec_Energy"]))
    except Exception as e:
        return {"error": f"Failed to read emissions file: {e}"}

    # Input vector
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
        x = np.ascontiguousarray(x, dtype=np.float64)
    except Exception as e:
        return {"error": f"Invalid input vector: {e}"}

    results = {}
    for name in config_list:
        m = models.get(name)
        if m is None:
            results[name] = {"error": "Model not loaded"}
            continue

        try:
            if hasattr(m, "predict"):
                y = m.predict(x)
            else:
                # callable model (e.g., RBFInterpolator)
                try:
                    y = m(x)
                except Exception:
                    # Some expect (n_features,) not (1, n_features)
                    y = m(np.ascontiguousarray(x.ravel(), dtype=np.float64))
            # y may be array-like; take first scalar
            cost = float(np.ascontiguousarray(y).ravel()[0])

            results[name] = {
                "cost": round(cost, 4),
                "emissions": round(float(emap.get(name, 0.0)), 4),
                "spec_energy": round(float(smap.get(name, 0.0)), 4),
            }

        except Exception as e:
            # Short, clean message back to UI
            msg = str(e).split("\n")[0][:250]
            results[name] = {"error": msg}

    return {"results": results}

# Serve built frontend (optional)
FRONTEND_DIST = BASE_DIR / "pareto-frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="static")
