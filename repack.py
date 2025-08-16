import joblib, pathlib
p = pathlib.Path("models")
for f in p.glob("surrogate_*.pkl"):
    m = joblib.load(f)
    out = f.with_name(f.stem + "_linux.pkl")
    joblib.dump(m, out)
    print("repacked:", f.name, "->", out.name)