// src/components/Controls.jsx
import React, { useMemo } from 'react';

export default function Controls({
  ui,
  inputs, setInputs,
  emissionScenario, setEmissionScenario,
  onGenerate, loading, error,
}) {
  const C = ui.controls;
  const FONT = C.fontFamily;

  const fields = useMemo(() => ({
    cEE:       { label: 'Electricity', unit: '(€/MWh)', min: 0.01,  max: 0.175, step: 0.001 },
    cH2:       { label: 'Hydrogen', unit: '(€/MWh)', min: 0.01,  max: 0.10,  step: 0.001 },
    cNG:       { label: 'Natural Gas', unit: '(€/MWh)', min: 0.01,  max: 0.10,  step: 0.001 },
    cbioCH4:   { label: 'Bio Methane', unit: '(€/MWh)', min: 0.03,  max: 0.09,  step: 0.001 },
    cbiomass:  { label: 'Biomass', unit: '(€/MWh)', min: 0.01,  max: 0.09,  step: 0.001 },
    cCoal:     { label: 'Coal', unit: '(€/MWh)', min: 0.01,  max: 0.09,  step: 0.001 },
    cMSW:      { label: 'Municipal Solid Waste', unit: '(€/MWh)', min: 0.01,  max: 0.09,  step: 0.001 },
    cCO2:      { label: 'CO₂ Emissions Cost', unit: '(€/t)', min: 0.075, max: 0.25, step: 0.001 },
    cCO2TnS:   { label: 'CO₂ Transport & Storage Cost', unit: '(€/t)', min: 0.025, max: 0.10, step: 0.001 },
  }), []);

  const handle = (k, v) => setInputs(p => ({ ...p, [k]: v }));

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: C.container.bg,
        borderRadius: C.container.borderRadius,
        border: C.container.border,
        boxShadow: C.container.shadow,
        padding: 0, // parent already pads; keep this clean
        display: 'flex',
        flexDirection: 'column',
        gap: C.row.gap,
        fontFamily: FONT,
        boxSizing: 'border-box',
        minHeight: 0,
      }}
    >
      {/* Scenario buttons */}
        <div
          style={{
            display: 'flex',
            gap: C.scenarioBtn.gap,
            flexWrap: 'wrap',
            justifyContent:
              C.scenarioBtn.align === 'center'
                ? 'center'
                : C.scenarioBtn.align === 'right'
                ? 'flex-end'
                : 'flex-start',
          }}
        >
        {['fossil', 'RE1', 'RE2'].map(s => {
          const active = emissionScenario === s;
          return (
            <button
              key={s}
              onClick={() => setEmissionScenario(s)}
              style={{
                padding: `${C.scenarioBtn.padY}px ${C.scenarioBtn.padX}px`,
                borderRadius: C.scenarioBtn.radius,
                border: active ? C.scenarioBtn.activeBorder : C.scenarioBtn.inactiveBorder,
                background: active ? C.scenarioBtn.activeBg : C.scenarioBtn.inactiveBg,
                color: active ? C.scenarioBtn.activeColor : C.scenarioBtn.inactiveColor,
                fontSize: C.scenarioBtn.fontSize,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: FONT,
              }}
            >
              {s === 'fossil' ? 'Scn fossil' : `Scn ${s}`}
            </button>
          );
        })}
      </div>

      {/* Scrollable controls */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          paddingRight: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: C.row.gap,
        }}
      >
        {Object.entries(fields).map(([key, meta]) => {
          const val = inputs[key];
          return (
            <div
              key={key}
              style={{
                display: 'grid',
                gridTemplateColumns: `1fr ${C.input.rightColPx}px`,
                alignItems: 'center',
                gap: 8,
                padding: `${C.row.padY}px ${C.row.padX}px`,
                border: C.row.border,
                borderRadius: C.row.radius,
                background: C.row.bg,
                boxSizing: 'border-box',
              }}
            >
              <label
                style={{
                  fontSize: C.label.fontSize,
                  color: C.label.color,
                  fontWeight: C.label.weight,
                  letterSpacing: C.label.letterSpacing,
                  lineHeight: 1.2,
                }}
              >
                {meta.label}{' '}
                <span style={{ color: C.label.unitColor, fontWeight: C.label.unitWeight }}>
                  {meta.unit}
                </span>
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
                  padding: `${C.input.padY}px ${C.input.padX}px`,
                  border: C.input.border,
                  borderRadius: C.input.radius,
                  fontSize: C.input.fontSize,
                  textAlign: 'right',
                  fontFamily: FONT,
                  boxSizing: 'border-box',
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
                  height: C.slider.height,
                  accentColor: C.slider.accentColor,
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
            fontSize: C.error.fontSize,
            color: C.error.color,
            background: C.error.bg,
            border: C.error.border,
            borderRadius: C.error.radius,
            padding: `${C.error.padY}px ${C.error.padX}px`,
            fontFamily: FONT,
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
          height: C.generateBtn.height,
          borderRadius: C.generateBtn.radius,
          border: C.generateBtn.border,
          background: C.generateBtn.bg,
          color: C.generateBtn.color,
          fontWeight: C.generateBtn.weight,
          fontSize: C.generateBtn.fontSize,
          cursor: 'pointer',
          opacity: loading ? 0.7 : 1,
          fontFamily: FONT,
        }}
      >
        {loading ? 'Generating…' : 'Generate'}
      </button>
    </div>
  );
}
