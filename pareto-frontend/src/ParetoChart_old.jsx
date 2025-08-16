import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";

const shapeMap = {
  BM: "triangle-down",
  BG: "triangle",
  Coal: "circle",
  H2: "rect",
  MSW: "roundRect",
  NG: "square",
  Hybrid: "diamond",
  Plasma: "diamond",
};

const borderStyleMap = {
  noCC: "solid",
  MEA: "dashed",
  Oxy: "dotted",
  CaL: "dashdot",
};

const ccLabels = {
  noCC: "Without CC",
  MEA: "CC-MEA",
  Oxy: "CC-Oxy",
  CaL: "CC-CaL",
};

const ParetoChart = ({ results, scenario }) => {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!results || Object.keys(results).length === 0) return;

    const chart = echarts.init(chartRef.current, null, {
      width: 1000,
      height: 600,
    });

    const configs = Object.keys(results);
    const validPoints = configs
      .map((config) => {
        const point = results[config];
        if (!point || isNaN(point.cost) || isNaN(point.emissions) || isNaN(point.spec_energy)) return null;

        const base = config.includes("_") ? config.split("_")[0] : config;
        const shape = shapeMap[base] || "circle";

        let ccType = "noCC";
        if (config.toLowerCase().includes("mea")) ccType = "MEA";
        else if (config.toLowerCase().includes("oxy")) ccType = "Oxy";
        else if (config.toLowerCase().includes("cal")) ccType = "CaL";

        return {
          config,
          cost: point.cost,
          emissions: point.emissions,
          energy: point.spec_energy,
          shape,
          base,
          ccType,
        };
      })
      .filter((d) => d);

    const energyValues = validPoints.map((d) => d.energy);
    const minE = Math.min(...energyValues);
    const maxE = Math.max(...energyValues);

    const colorScale = (energy) => {
      const t = (energy - minE) / (maxE - minE);
      const color = echarts.color.lerp(t, ["#fef0d9", "#f03b20"]);
      return color;
    };

    const series = validPoints.map((d) => ({
      name: d.base,
      type: "scatter",
      symbol: d.shape,
      symbolSize: 16,
      itemStyle: {
        color: colorScale(d.energy),
        borderColor: "#333",
        borderWidth: 2,
        borderType: borderStyleMap[d.ccType],
      },
      label: {
        show: false,
      },
      tooltip: {
        formatter: () =>
          `<b>${d.config}</b><br/>Cost: €${d.cost.toFixed(1)}/t<br/>Emissions: ${d.emissions.toFixed(
            2
          )} tCO₂/t<br/>Spec. Energy: ${d.energy.toFixed(2)} GJ/t`,
      },
      data: [[d.cost, d.emissions]],
    }));

    chart.setOption({
      backgroundColor: "#fff",
      title: {
        text: `Pareto Front – ${scenario} Scenario`,
        left: "center",
        top: 10,
        textStyle: { fontSize: 18 },
      },
      tooltip: { trigger: "item" },
      legend: {
        type: "scroll",
        orient: "vertical",
        right: 10,
        top: 50,
        bottom: 30,
        data: [...new Set(validPoints.map((d) => d.base))],
        textStyle: { fontSize: 12 },
      },
      xAxis: {
        name: "Cost (€/t of Cement)",
        nameLocation: "middle",
        nameGap: 35,
        nameTextStyle: { fontSize: 14 },
        axisLine: { lineStyle: { color: "#999" } },
      },
      yAxis: {
        name: "Emissions (t CO₂/t of Cement)",
        nameLocation: "middle",
        nameGap: 50,
        nameTextStyle: { fontSize: 14 },
        axisLine: { lineStyle: { color: "#999" } },
      },
      visualMap: {
        min: minE,
        max: maxE,
        dimension: 2,
        orient: "vertical",
        right: 50,
        top: "middle",
        calculable: true,
        inRange: { color: ["#fef0d9", "#f03b20"] },
        text: ["High Spec. Energy", "Low"],
        textStyle: { fontSize: 12 },
      },
      series,
    });

    return () => chart.dispose();
  }, [results, scenario]);

  return (
    <div
      style={{
        background: "#fff",
        padding: "30px",
        borderRadius: "10px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
        maxWidth: "1100px",
        margin: "0 auto",
      }}
    >
      <div ref={chartRef} />
    </div>
  );
};

export default ParetoChart;
