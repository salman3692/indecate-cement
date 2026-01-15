// src/App.jsx
import React, { useState, useEffect } from 'react';
import Controls from './components/Controls';
import ParetoChart from './components/ParetoChart';

export default function App() {
  /**
   * ============================================================
   * Layout + Controls styling + Chart internals (legend/colorbar/markers/grid/fonts)
   * Everything else (Controls.jsx, ParetoChart.jsx) reads from this object.
   */
  const UI = {
    // ----------------
    // Layout geometry
    // ----------------
    layout: {
      dashboardWidth: 1050,
      dashboardHeight: 620,
      sidebarWidth: 250,
      gap: 10,
      sidebarPadding: 8,
      chartPadding: 10,
      bg: '#f5f5f5',
      cardBg: '#ffffff',
      cardBorder: '#dddddd',
      cardRadius: 8,
      cardShadow: '0 2px 8px rgba(0,0,0,0.05)',
    },

    // ----------------
    // Controls styling
    // ----------------
    controls: {
      fontFamily: 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      container: {
        borderRadius: 10,
        border: '0px solid #E5E7EB',
        // shadow: '0 2px 8px rgba(0,0,0,0.06)',
        bg: '#fff',
      },
      scenarioBtn: {
        fontSize: 10,
        padY: 6,
        padX: 10,
        radius: 10,
        align: 'center',      // 'left' | 'center' | 'right'
        gap: 8,             // space between buttons
        activeBorder: '1px solid #1D4ED8',
        activeBg: '#1D4ED8',
        activeColor: '#fff',
        inactiveBorder: '1px solid #E5E7EB',
        inactiveBg: '#F9FAFB',
        inactiveColor: '#374151',
      },
      row: {
        gap: 5,
        padY: 6,
        padX: 8,
        radius: 20,
        border: '1px solid #F0F1F3',
        bg: '#FCFCFD',
      },
      label: {
        fontSize: 10.5,
        color: '#374151',
        weight: 600,
        unitColor: '#9CA3AF',
        unitWeight: 500,
        letterSpacing: 0.2,
      },
      input: {
        fontSize: 10,
        padY: 6,
        padX: 8,
        radius: 8,
        border: '1px solid #E5E7EB',
        rightColPx: 78,
      },
      slider: {
        height: 4,
        accentColor: '#2563EB',
      },
      error: {
        fontSize: 10,
        color: '#B91C1C',
        bg: '#FEF2F2',
        border: '1px solid #FECACA',
        radius: 8,
        padY: 8,
        padX: 10,
      },
      generateBtn: {
        height: 30,
        fontSize: 10.5,
        radius: 10,
        border: '1px solid #1D4ED8',
        bg: '#1D4ED8',
        color: '#fff',
        weight: 700,
      },
    },

    // ----------------
    // Chart styling
    // ----------------
    chart: {
      fontFamily: 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',

      markers: {
        size: 16,
        borderWidth: 2,
        legendKeySize: 13, // symbol size for CC legend "dummy" entries
      },

      grid: {
        left: 45,
        right: 130,
        top: 20,
        bottom: 130,
        borderColor: '#292a2bff',
        borderWidth: 1,
      },

      axis: {
        x: { labelSize: 14, titleSize: 14, nameGap: 35 },
        y: { labelSize: 14, titleSize: 14, nameGap: 40 },
      },

      legend: {
        right: 10,
        top: 45,
        itemSize: 15,
        itemGap: 18,
        fontSize: 12,
        color: '#374151',
      },

      tooltip: {
        fontSize: 12,
        borderColor: '#e5e7eb',
        bg: '#ffffff',
        color: '#111827',
        minWidth: 180,
      },

      colorbar: {
        left: 110,
        right: 90,
        bottom: 65,
        itemWidth: 15,
        itemHeight: 450,
        textSize: 12,
        label: 'Specific Energy Consumption (GJ/t of Clinker)',
        labelFont: 14,
        labelBottom: 50,
      },

      colors: [
        '#0d0887','#2a0593','#41049d','#5d01a6','#6a00a8','#8000a9','#8f0da4',
        '#9c179e','#b12a90','#c23c81','#cc4778','#d35171','#e16462','#ec7853',
        '#f2844b','#f68f44','#fca636'
      ],
    },
  };

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

  const onGenerate = async () => {
    setError('');
    const maybe = validate();
    if (maybe) { setError(maybe); return; }

    setLoading(true);
    try {
      const payload = {
        ...Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, Number(v)])),
        emission_scenario: emissionScenario
      };

      // Local deployment
      const res = await fetch('https://indecate-cement-244035f6986c.herokuapp.com/predict', { // for online deployment
      // const res = await fetch('http://127.0.0.1:8000/predict', { // for local deployment
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const L = UI.layout;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: L.bg,
      padding: 16,
      boxSizing: 'border-box',
    }}>
      {/* Dashboard shell */}
      <div style={{
        width: L.dashboardWidth,
        height: L.dashboardHeight,
        maxWidth: '100vw',
        maxHeight: '100vh',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: `${L.gap}px`,
      }}>
        {/* Sidebar */}
        <div style={{
          flex: `0 0 ${L.sidebarWidth}px`,
          height: '100%',
          minWidth: 0,
          background: L.cardBg,
          padding: `${L.sidebarPadding}px`,
          borderRadius: `${L.cardRadius}px`,
          border: `1px solid ${L.cardBorder}`,
          boxShadow: L.cardShadow,
          boxSizing: 'border-box',
        }}>
          <Controls
            ui={UI}
            inputs={inputs}
            setInputs={setInputs}
            emissionScenario={emissionScenario}
            setEmissionScenario={setEmissionScenario}
            onGenerate={onGenerate}
            loading={loading}
            error={error}
          />
        </div>

        {/* Chart */}
        <div style={{
          flex: 1,
          height: '100%',
          minWidth: 0,
          background: L.cardBg,
          padding: `${L.chartPadding}px`,
          borderRadius: `${L.cardRadius}px`,
          border: `1px solid ${L.cardBorder}`,
          boxShadow: L.cardShadow,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {loading && !results && <p style={{ margin: 0, padding: 8 }}>Loading default scenario…</p>}
          <div style={{ flex: 1, minHeight: 0 }}>
            <ParetoChart ui={UI} results={results} emissionScenario={emissionScenario} />
          </div>
        </div>
      </div>
    </div>
  );
}
