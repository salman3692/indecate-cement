import joblib
import numpy as np
import matplotlib.pyplot as plt

# Re-define the function using the loaded interpolator
def predict_output(input_vector):
    input_array = np.array(input_vector).reshape(1, -1)
    return surrogate_model(input_array)[0]

##############
### inputs ###
##############

# models to choose from
models = [
    "Coal", "Coal_CC_MEA", "Coal_CC_Oxy", "Coal_CC_CaL",
    "NG", "NG_CC_MEA", "NG_CC_Oxy", "NG_CC_CaL",
    "BG", "BG_CC_MEA", "BG_CC_Oxy", "BG_CC_CaL",
    "BM", "BM_CC_MEA", "BM_CC_Oxy", "BM_CC_CaL",
    "MSW", "MSW_CC_MEA", "MSW_CC_Oxy", "MSW_CC_CaL",
    "H2_CC_MEA", "H2_CC_Oxy", "H2_CC_CaL",
    "Plasma", "Hybrid"
]

# choose surrogate model
model = 'Coal_CC_MEA'

# FYI - order of inputs for the input sample
input_data = [
    "cEE", "cH2", "cNG", "cbioCH4", "cbiomass","cCoal", "cMSW", "cCO2", "cCO2TnS"
]

# example sample you want to know the output for
example_sample = np.array([
    0.01,   0.01,   0.1,    0.07,       0.01,     0.1,     0.01,  0.100,  0.050
    # "cEE", "cH2", "cNG", "cbioCH4", "cbiomass","cCoal", "cMSW", "cCO2", "cCO2TnS"

])


# Load the surrogate
surrogate_model = joblib.load('surrogate_%s.pkl' %model)

y = predict_output(example_sample)
print(y)


# impact of changing price coal on the output
price_coal = np.linspace(0.01,0.09,1000)

# Store predictions
predictions = []

# Loop through prices and make predictions
for price in price_coal:
    example_sample = np.array([
        0.014082924, 0.056681595, 0.0327314, 0.079053497,
        0.03539978, price, 0.053672485, 0.097509193, 0.095846367
    ])
    y = predict_output(example_sample)
    predictions.append(y)

# # Plot price vs prediction
plt.figure()
plt.plot(price_coal, predictions)
plt.xlabel('Price coal')
plt.ylabel('output')
plt.show()