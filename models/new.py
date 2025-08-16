import joblib
import sys
import pkg_resources
from pathlib import Path

MODELS_DIR = Path("models")  # change if path is different
config_list = [
    "BM", "BM_CC_CaL", "BM_CC_MEA", "BM_CC_Oxy",
    "BG", "BG_CC_CaL", "BG_CC_MEA", "BG_CC_Oxy",
    "Coal", "Coal_CC_CaL", "Coal_CC_MEA", "Coal_CC_Oxy",
    "H2", "H2_CC_CaL", "H2_CC_MEA", "H2_CC_Oxy",
    "MSW", "MSW_CC_CaL", "MSW_CC_MEA", "MSW_CC_Oxy",
    "NG", "NG_CC_CaL", "NG_CC_MEA", "NG_CC_Oxy",
    "Hybrid", "Plasma"
]

loaded_modules = set()

for config_name in config_list:
    file_path = MODELS_DIR / f"surrogate_{config_name}.pkl"
    if file_path.exists():
        model = joblib.load(file_path)
        loaded_modules.add(type(model).__module__)

print("\n Modules used in models:")
for mod in loaded_modules:
    try:
        version = pkg_resources.get_distribution(mod.split('.')[0]).version
        print(f"{mod} == {version}")
    except Exception:
        print(f"{mod} (version unknown)")

print("\n Python version:", sys.version)
