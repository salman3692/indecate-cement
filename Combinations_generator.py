import csv
import itertools

# Define the values for cEE, cH2, cNG, and cCO2
cEE_values  = [0.01, 0.025, 0.05, 0.075, 0.1, 0.125, 0.15, 0.175]
cH2_values  = [0.01, 0.025, 0.05, 0.075, 0.1]
cNG_values  = [0.01, 0.035, 0.055, 0.075, 0.1]
cbioCH4_values = [0.03, 0.05, 0.07, 0.09]
cbiomass_values = [0.01, 0.04, 0.07, 0.09]
cCoal = [0.01, 0.04, 0.07, 0.09] 
cMSW = [0.01, 0.04, 0.07, 0.09]
cCO2_values = [0.075, 0.100, 0.150, 0.200, 0.250]
cCO2TnS_values = [0.025, 0.05, 0.075, 0.100]

# Generate combinations using itertools.product
combinations = list(itertools.product(cEE_values, cH2_values, cNG_values, cbioCH4_values, cbiomass_values, cCoal, cMSW, cCO2_values, cCO2TnS_values))
# ok
# Write the combinations to a CSV file
with open('combinations_V220625.csv', 'w', newline='') as csvfile:
    fieldnames = ['cEE', 'cH2', 'cNG','cBioCH4','cBiomass', 'cCoal', 'cMSW', 'cCO2','cTnS']
    writer = csv.writer(csvfile)
    writer.writerow(fieldnames)

    for row in combinations:
        writer.writerow(row)
print ('combinations generated suuccessfully')
