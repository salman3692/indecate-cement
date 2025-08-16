import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

const fillPatternMap = { noCC: null, MEA: 'hatch', Oxy: 'cross', CaL: 'dot' };
const FONT = 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

function getEnergyColor(se, minE, maxE) {
  const colors = ['#0d0887','#2a0593','#41049d','#5d01a6','#6a00a8','#8000a9','#8f0da4','#9c179e','#b12a90','#c23c81','#cc4778','#d35171','#e16462','#ec7853','#f2844b','#f68f44','#fca636'];
  const t = (se - minE) / (maxE - minE || 1);
  const idx = Math.min(colors.length - 1, Math.max(0, Math.floor(t * (colors.length - 1))));
  return colors[idx];
}

function createPatternedSymbol(base, patternType, color) {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d'); ctx.clearRect(0,0,size,size);
  const pad = 4;

  ctx.beginPath();
  if (base === 'circle') {
    ctx.arc(size/2, size/2, (size - pad*2)/2, 0, Math.PI*2);
  } else if (base === 'rect') {
    ctx.rect(pad, pad, size - pad*2, size - pad*2);
  } else if (base === 'triangle') {
    ctx.moveTo(size/2, pad); ctx.lineTo(size - pad, size - pad); ctx.lineTo(pad, size - pad); ctx.closePath();
  } else if (base === 'diamond') {
    ctx.moveTo(size/2, pad); ctx.lineTo(size - pad, size/2); ctx.lineTo(size/2, size - pad); ctx.lineTo(pad, size/2); ctx.closePath();
  } else if (base === 'hexagon') {
    const r = (size - pad*2) / 2, cx = size/2, cy = size/2;
    for (let i = 0; i < 6; i++) {
      const a = Math.PI/3 * i - Math.PI/6;
      const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  } else if (base === 'pentagon') {
    const r = (size - pad*2) / 2, cx = size/2, cy = size/2;
    for (let i = 0; i < 5; i++) {
      const a = (Math.PI*2/5) * i - Math.PI/2;
      const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  } else if (base === 'right-triangle') {
    ctx.moveTo(pad, pad); ctx.lineTo(size - pad, size/2); ctx.lineTo(pad, size - pad); ctx.closePath();
  } else if (base === 'left-triangle') {
    ctx.moveTo(size - pad, pad); ctx.lineTo(pad, size/2); ctx.lineTo(size - pad, size - pad); ctx.closePath();
  } else {
    ctx.arc(size/2, size/2, (size - pad*2)/2, 0, Math.PI*2);
  }

  ctx.save(); ctx.clip();

  if (!patternType) {
    ctx.fillStyle = color; ctx.fillRect(0,0,size,size);
  } else {
    const p = document.createElement('canvas'); p.width = 8; p.height = 8;
    const pc = p.getContext('2d'); pc.strokeStyle = color; pc.fillStyle = color; pc.lineWidth = 1.5;
    if (patternType === 'hatch') { pc.beginPath(); pc.moveTo(4,0); pc.lineTo(4,8); pc.stroke(); }
    else if (patternType === 'cross') { pc.beginPath(); pc.moveTo(4,0); pc.lineTo(4,8); pc.moveTo(0,4); pc.lineTo(8,4); pc.stroke(); }
    else if (patternType === 'dot') { pc.beginPath(); pc.arc(4,4,1.5,0,Math.PI*2); pc.fill(); }
    ctx.fillStyle = ctx.createPattern(p, 'repeat'); ctx.fillRect(0,0,size,size);
  }

  ctx.restore(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
  return `image://${canvas.toDataURL()}`;
}

function getBaseShape(base) {
  switch (base) { 
    case 'Coal': return 'circle'; 
    case 'NG': return 'rect'; 
    case 'BG': return 'triangle'; 
    case 'BM': return 'diamond'; 
    case 'MSW': return 'hexagon';
    case 'H2': return 'pentagon';
    case 'Plasma': return 'right-triangle';
    case 'Hybrid': return 'left-triangle';
    default: return 'circle';
  }
}

export default function ParetoChart({ results, emissionScenario }) {
  const ref = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    chartRef.current = echarts.init(ref.current);
    const resize = () => chartRef.current?.resize();
    const ro = new ResizeObserver(resize);
    ro.observe(ref.current);
    window.addEventListener('resize', resize);
    return () => { ro.disconnect(); window.removeEventListener('resize', resize); chartRef.current?.dispose(); };
  }, []);

  useEffect(() => {
    if (!chartRef.current || !results) return;

    const points = Object.entries(results)
      .map(([config, v]) => {
        if (!v || isNaN(v.cost) || isNaN(v.emissions) || isNaN(v.spec_energy)) return null;
        const base = config.includes('_') ? config.split('_')[0] : config;
        let cc = 'noCC';
        const lc = config.toLowerCase();
        if (lc.includes('mea')) cc = 'MEA';
        else if (lc.includes('oxy')) cc = 'Oxy';
        else if (lc.includes('cal')) cc = 'CaL';
        return { config, base, cc, cost: v.cost, emis: v.emissions, se: v.spec_energy };
      })
      .filter(Boolean);

    if (!points.length) return;

    const minE = Math.min(...points.map(p => p.se));
    const maxE = Math.max(...points.map(p => p.se));
    const minCost = Math.min(...points.map(p => p.cost));
    const maxCost = Math.max(...points.map(p => p.cost));
    const padding = (maxCost - minCost) * 0.05;

    const byBase = points.reduce((acc, p) => ((acc[p.base] ||= []).push(p), acc), {});

    const series = Object.entries(byBase).map(([base, arr]) => ({
      name: base,
      type: 'scatter',
      symbol: createPatternedSymbol(getBaseShape(base), null, '#1f1f20ff'),
      symbolSize: 20,
      data: arr.map(p => {
        const color = getEnergyColor(p.se, minE, maxE);
        const patternType = fillPatternMap[p.cc];
        const shape = getBaseShape(base);
        return {
          value: [p.cost, p.emis, p.se],
          name: p.config,
          symbol: createPatternedSymbol(shape, patternType, color),
        };
      }),
      emphasis: { focus: 'series' },
    }));

    const ccLegendSeries = [
      { name: 'CC_MEA', type: 'scatter', data: [], symbol: createPatternedSymbol('rect', 'hatch', '#111111'), symbolSize: 16, silent: true, tooltip: { show: false } },
      { name: 'OxyCC', type: 'scatter', data: [], symbol: createPatternedSymbol('rect', 'cross', '#111111'), symbolSize: 16, silent: true, tooltip: { show: false } },
      { name: 'CC_CaL', type: 'scatter', data: [], symbol: createPatternedSymbol('rect', 'dot', '#111111'), symbolSize: 16, silent: true, tooltip: { show: false } },
    ];

    const finalSeries = [...series, ...ccLegendSeries];

    const gridTop = 20;

    chartRef.current.setOption({
      backgroundColor: '#fff',
      textStyle: { fontFamily: FONT },
      grid: {
        left: 80, right: 130, top: gridTop, bottom: 140, containLabel: true, show: true,
        borderColor: '#292a2bff', borderWidth: 1
      },
      tooltip: {
        trigger: 'item',
        borderColor: '#e5e7eb',
        backgroundColor: '#ffffff',
        textStyle: { color: '#111827', fontFamily: FONT },
        formatter: ({ value, data }) => {
          const [cost, emis, se] = value;
          const config = data?.name || '';
          return `<div style="min-width:180px"><b>${config}</b><br/>Cost: €${cost.toFixed(1)}/t<br/>Emissions: ${emis.toFixed(2)} tCO₂/t<br/>Spec. Energy: ${se.toFixed(2)} GJ/t</div>`;
        },
      },
      legend: {
        type: 'plain',
        orient: 'vertical',
        right: 20,
        top: 90,
        itemWidth: 20,
        itemHeight: 20,
        symbolKeepAspect: true,
        itemGap: 16,
        textStyle: { fontSize: 12, color: '#374151', fontFamily: FONT },
        data: [...Object.keys(byBase), 'CC_MEA', 'OxyCC', 'CC_CaL'],
      },
      xAxis: {
        name: 'Total Cost (€/t of Clinker)', nameLocation: 'middle', nameGap: 35,
        min: minCost - padding, max: maxCost + padding,
        axisLine: { lineStyle: { color: '#3f3f3fff', width: 0.5 } },
        axisLabel: { color: '#191919ff', fontSize: 14, fontFamily: FONT, formatter: value => Math.round(value) },
        nameTextStyle: { color: '#191919ff', fontSize: 16, fontFamily: FONT },
        axisTick: { show: false },
        splitLine: { show: true, lineStyle: { color: '#e7e7e7ff' } },
      },
      yAxis: {
        name: 'Emissions (t CO₂/t of Clinker)', nameLocation: 'middle', nameGap: 50,
        min: -0.3, max: 1,
        axisLine: { lineStyle: { color: '#3f3f3fff' }, show: false },
        splitLine: { show: true, lineStyle: { color: '#e7e7e7ff' } },
        axisLabel: { color: '#191919ff', fontSize: 14, fontFamily: FONT },
        nameTextStyle: { color: '#191919ff', fontSize: 14, fontFamily: FONT },
        axisTick: { show: false },
      },
      visualMap: {
        min: minE, 
        max: maxE, 
        dimension: 2, 
        orient: 'horizontal',
        bottom: 35, 
        right: 90, 
        left: '180', 
        itemWidth: 30,
        itemHeight: 500,
        calculable: true,
        inRange: { color: ['#0d0887','#2a0593','#41049d','#5d01a6','#6a00a8','#8000a9','#8f0da4','#9c179e','#b12a90','#c23c81','#cc4778','#d35171','#e16462','#ec7853','#f2844b','#f68f44','#fca636']},
        text: ['High', 'Low'],
        textStyle: { fontSize: 12, color: '#374151', fontFamily: FONT },
      },
      graphic: [{
        type: 'text',
        left: 'center',
        bottom: 20,
        style: {
          text: 'Specific Energy Consumption (GJ/t of Clinker)',
          fontSize: 14,
          fontFamily: FONT,
          fill: '#374151'
        }
      }],
      series: finalSeries,
      animationDuration: 300,
    });
  }, [results, emissionScenario]);

  return (
    <div
      className="rounded-2xl bg-white shadow-sm"
      style={{
        width: "900px",
        height: "680px",
        margin: "auto",
        border: "1px solid #d1d5db",
      }}
    >
      <div style={{ width: "100%", height: "100%" }} ref={ref} />
    </div>
  );
}
