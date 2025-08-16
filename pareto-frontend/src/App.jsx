// src/App.jsx
import React, { useState, useEffect } from 'react';
import Controls from './components/Controls';
import ParetoChart from './components/ParetoChart';

export default function App() {
  const [inputs, setInputs] = useState({
    cEE: 0.05,
    cH2: 0.075,
    cNG: 0.055,
    cbioCH4: 0.07,
    cbiomass: 0.04,
    cCoal: 0.04,
    cMSW: 0.04,
    cCO2: 0.15,
    cCO2TnS: 0.05,
  });
  const [emissionScenario, setEmissionScenario] = useState('RE1');
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const ranges = {
      cEE: [0.01, 0.175],
      cH2: [0.01, 0.1],
      cNG: [0.01, 0.1],
      cbioCH4: [0.03, 0.09],
      cbiomass: [0.01, 0.09],
      cCoal: [0.01, 0.09],
      cMSW: [0.01, 0.09],
      cCO2: [0.075, 0.25],
      cCO2TnS: [0.025, 0.1],
    };
    for (const k in inputs) {
      const v = Number(inputs[k]);
      if (Number.isNaN(v)) return `Invalid input for ${k}`;
      const [min, max] = ranges[k];
      if (v < min || v > max) return `Value for ${k} must be between ${min} and ${max}`;
    }
    return '';
  };

  const API_BASE = import.meta.env.VITE_API_BASE_URL || ""; // same origin by default

  const onGenerate = async () => {
    setError('');
    const maybe = validate();
    if (maybe) { setError(maybe); return; }

    setLoading(true);
    try {
      const payload = {
        ...Object.fromEntries(
          Object.entries(inputs).map(([k, v]) => [k, Number(v)])
        ),
        emission_scenario: emissionScenario
      };
      // const res = await fetch(`${API_BASE}/predict`, {
      const res = await fetch('http://127.0.0.1:8000/predict', {

        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data?.results) setResults(data.results);
      else setError('Unexpected server response.');
    } catch (e) {
      setError('Failed to fetch prediction.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    onGenerate();
  }, []);

  return (
    <div style={{
      height: '100vh',                  // full screen height
      display: 'flex',
      justifyContent: 'center',         // center horizontally
      alignItems: 'center',             // center vertically
      background: '#f5f5f5',            // light page background
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',          // equal height children
        gap: '20px',
        height: '700px',                 // fixed total height
      }}>
        {/* Controls column */}
        <div style={{
          flex: '0 0 300px',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          padding: '15px',
          borderRadius: '8px',
          border: '1px solid #ddd',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}>
          <Controls
            inputs={inputs}
            setInputs={setInputs}
            emissionScenario={emissionScenario}
            setEmissionScenario={setEmissionScenario}
            onGenerate={onGenerate}
            loading={loading}
            error={error}
          />
        </div>

        {/* Chart column */}
        <div style={{
          flex: 1,
          background: '#fff',
          borderRadius: '8px',
          border: '1px solid #ddd',
          padding: '10px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}>
          {loading && !results && <p>Loading default scenario…</p>}
          <ParetoChart results={results} emissionScenario={emissionScenario} />
        </div>
      </div>
    </div>
  );
}
