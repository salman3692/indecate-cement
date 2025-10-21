import joblib
obj = joblib.load("models/surrogate_BM_CC_MEA_HPs.pkl")
print(type(obj))
print(obj)
