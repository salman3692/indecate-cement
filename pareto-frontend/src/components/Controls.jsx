// src/components/Controls.jsx
import React, { useMemo } from 'react';

// ✅ Same font family as ParetoChart
const FONT = 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
// sdfsdf
export default function Controls({
  inputs, setInputs,
  emissionScenario, setEmissionScenario,
  onGenerate, loading, error, //sffsd
}) {
  const fields = useMemo(() => ({
    cEE:       { label: 'Electricity', unit: '((€/MWh))', min: 0.01, max: 0.175, step: 0.001 },
    cH2:       { label: 'Hydrogen',   unit: '(€/MWh)', min: 0.01, max: 0.10,  step: 0.001 },
    cNG:       { label: 'Natural Gas',   unit: '(€/MWh)', min: 0.01, max: 0.10,  step: 0.001 },
    cbioCH4:   { label: 'Bio Methane',    unit: '(€/MWh)', min: 0.03, max: 0.09,  step: 0.001 },
    cbiomass:  { label: 'Biomass',    unit: '(€/MWh)', min: 0.01, max: 0.09,  step: 0.001 },
    cCoal:     { label: 'Coal',       unit: '(€/MWh)', min: 0.01, max: 0.09,  step: 0.001 },
    cMSW:      { label: 'Municipal Solid Waste',        unit: '(€/MWh)', min: 0.01, max: 0.09,  step: 0.001 },
    cCO2:      { label: 'CO₂ Emissions Cost',  unit: '(€/t)',  min: 0.075,max: 0.25,  step: 0.001 },
    cCO2TnS:   { label: 'CO₂ Transport & Storage Cost',    unit: '(€/t)',  min: 0.025,max: 0.10,  step: 0.001 },
  }), []);

  const handle = (k, v) => setInputs(p => ({ ...p, [k]: v }));

  return (
    <div
      style={{
        width: 330,
        height: 640,
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #E5E7EB',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        fontFamily: FONT, // ✅ Apply to whole sidebar
      }}
    >
      {/* Scenario buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {['fossil','RE1','RE2'].map(s => {
          const active = emissionScenario === s;
          return (
            <button
              key={s}
              onClick={() => setEmissionScenario(s)}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: active ? '1px solid #1D4ED8' : '1px solid #E5E7EB',
                background: active ? '#1D4ED8' : '#F9FAFB',
                color: active ? '#fff' : '#374151',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: FONT, // ✅
              }}
            >
              {s === 'fossil' ? 'Scenario fossil' : `Scenario ${s}`}
            </button>
          );
        })}
      </div>

      {/* Scrollable controls */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          paddingRight: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {Object.entries(fields).map(([key, meta]) => {
          const val = inputs[key];
          return (
            <div
              key={key}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 78px',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                border: '1px solid #F0F1F3',
                borderRadius: 10,
                maxWidth: '90%',
                background: '#FCFCFD',
                fontFamily: FONT, // ✅
              }}
            >
              <label
                style={{
                  fontSize: 12,
                  color: '#374151',
                  fontWeight: 600,
                  letterSpacing: 0.2,
                  fontFamily: FONT, // ✅
                }}
              >
                {meta.label} <span style={{ color: '#9CA3AF', fontWeight: 500 }}>{meta.unit}</span>
              </label>

              <input
                type="number"
                value={parseFloat((val * 1000).toFixed(3))}
                step={meta.step * 1000}
                min={meta.min * 1000}
                max={meta.max * 1000}
                onChange={e => handle(key, Number(e.target.value) / 1000)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  border: '1px solid #E5E7EB',
                  borderRadius: 8,
                  fontSize: 12,
                  textAlign: 'right',
                  fontFamily: FONT, // ✅
                }}
              />

              <input
                type="range"
                value={val}
                min={meta.min}
                max={meta.max}
                step={meta.step}
                onChange={e => handle(key, Number(e.target.value))}
                style={{
                  gridColumn: '1 / -1',
                  width: '100%',
                  height: 4,
                  accentColor: '#2563EB',
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            fontSize: 12,
            color: '#B91C1C',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 8,
            padding: '8px 10px',
            fontFamily: FONT, // ✅
          }}
        >
          {error}
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={onGenerate}
        disabled={loading}
        style={{
          height: 38,
          borderRadius: 10,
          border: '1px solid #1D4ED8',
          background: '#1D4ED8',
          color: '#fff',
          fontWeight: 700,
          fontSize: 13,
          cursor: 'pointer',
          opacity: loading ? 0.7 : 1,
          fontFamily: FONT, // ✅
        }}
      >
        {loading ? 'Generating…' : 'Generate'}
      </button>
    </div>
  );
}
