import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';

// ── Palette ───────────────────────────────────────────────────────────────────
export const COLORS = {
  primary:   '#6366f1',
  pending:   '#f59e0b',
  disposed:  '#10b981',
  compare:   '#818cf8',
  compare2:  '#34d399',
  danger:    '#f87171',
  muted:     '#475569',
  grid:      'rgba(255,255,255,0.05)',
  tooltip:   '#0f172a',
  text:      '#94a3b8',
  textBright:'#e2e8f0',
};

const PALETTE = ['#6366f1','#10b981','#f59e0b','#f87171','#60a5fa','#a78bfa','#2dd4bf','#fb923c','#e879f9','#34d399'];

// ── Shared tooltip/grid defaults ──────────────────────────────────────────────
const tooltip = (formatter?: string) => ({
  trigger: 'axis' as const,
  backgroundColor: COLORS.tooltip,
  borderColor: 'rgba(255,255,255,0.08)',
  borderWidth: 1,
  textStyle: { color: COLORS.textBright, fontSize: 12 },
  extraCssText: 'box-shadow:0 8px 32px rgba(0,0,0,0.5);border-radius:8px;padding:10px 14px;',
  ...(formatter ? { formatter } : {}),
});

const legend = (data: string[]) => ({
  data,
  bottom: 4,
  textStyle: { color: COLORS.text, fontSize: 11 },
  itemWidth: 10,
  itemHeight: 10,
  borderRadius: 2,
  icon: 'roundRect',
});

const xAxisCat = (data: string[], rotate = 30) => ({
  type: 'category' as const,
  data,
  axisLabel: { rotate, fontSize: 10, color: COLORS.text, interval: 0 },
  axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
  axisTick: { show: false },
});

const yAxisVal = (name = '') => ({
  type: 'value' as const,
  name,
  nameTextStyle: { color: COLORS.text, fontSize: 10 },
  axisLabel: { color: COLORS.text, fontSize: 10, formatter: (v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v) },
  splitLine: { lineStyle: { color: COLORS.grid } },
  axisLine: { show: false },
});

// ── BaseChart component ───────────────────────────────────────────────────────
export const BaseChart = ({ option, height = '400px', width = '100%' }: {
  option: EChartsOption; height?: string; width?: string;
}) => (
  <ReactECharts
    option={option}
    notMerge={true}
    style={{ height, width }}
    opts={{ renderer: 'canvas' }}
  />
);

// ── 1. Stacked Bar (District / Branch etc.) ───────────────────────────────────
export const getDistrictBarOptions = (
  data: { district: string; total: number; pending: number; disposed: number }[],
  opts?: { horizontal?: boolean }
): EChartsOption => {
  const labels = data.map(d => d.district);
  const pending = data.map(d => d.pending);
  const disposed = data.map(d => d.disposed);

  if (opts?.horizontal) {
    return {
      tooltip: { ...tooltip(), trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: legend(['Pending', 'Disposed']),
      grid: { left: '2%', right: '6%', bottom: '10%', top: '4%', containLabel: true },
      xAxis: { ...yAxisVal() },
      yAxis: { type: 'category', data: labels, axisLabel: { fontSize: 10, color: COLORS.text }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisTick: { show: false } },
      series: [
        { name: 'Pending',  type: 'bar', stack: 'total', data: pending,  itemStyle: { color: COLORS.pending,  borderRadius: [0,0,0,0] }, barMaxWidth: 22 },
        { name: 'Disposed', type: 'bar', stack: 'total', data: disposed, itemStyle: { color: COLORS.disposed, borderRadius: [0,3,3,0] }, barMaxWidth: 22 },
      ],
    };
  }

  return {
    tooltip: { ...tooltip(), trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: legend(['Pending', 'Disposed']),
    grid: { left: '2%', right: '2%', bottom: '14%', top: '4%', containLabel: true },
    xAxis: xAxisCat(labels),
    yAxis: yAxisVal(),
    series: [
      { name: 'Pending',  type: 'bar', stack: 'total', data: pending,  itemStyle: { color: COLORS.pending,  borderRadius: [3,3,0,0] }, barMaxWidth: 28, emphasis: { focus: 'series' } },
      { name: 'Disposed', type: 'bar', stack: 'total', data: disposed, itemStyle: { color: COLORS.disposed, borderRadius: [3,3,0,0] }, barMaxWidth: 28, emphasis: { focus: 'series' } },
    ],
  };
};

// ── 2. YoY Comparison Grouped Bar ────────────────────────────────────────────
export const getYoYBarOptions = (
  data: { district: string; total: number; prevTotal: number }[],
  currentYear: number,
): EChartsOption => ({
  tooltip: { ...tooltip(), trigger: 'axis', axisPointer: { type: 'shadow' } },
  legend: legend([String(currentYear), String(currentYear - 1)]),
  grid: { left: '2%', right: '2%', bottom: '14%', top: '4%', containLabel: true },
  xAxis: xAxisCat(data.map(d => d.district)),
  yAxis: yAxisVal(),
  series: [
    {
      name: String(currentYear),
      type: 'bar',
      data: data.map(d => d.total),
      itemStyle: { color: COLORS.primary, borderRadius: [3,3,0,0] },
      barMaxWidth: 22,
      emphasis: { focus: 'series' },
    },
    {
      name: String(currentYear - 1),
      type: 'bar',
      data: data.map(d => d.prevTotal),
      itemStyle: { color: COLORS.compare, borderRadius: [3,3,0,0], opacity: 0.75 },
      barMaxWidth: 22,
      emphasis: { focus: 'series' },
    },
  ],
});

// ── 3. Line / Area trend ──────────────────────────────────────────────────────
export const getDurationLineOptions = (
  data: { month: string; total: number; pending: number; disposed: number; prevTotal?: number }[],
  year: number
): EChartsOption => ({
  tooltip: {
    ...tooltip(),
    trigger: 'axis',
    formatter: (params: any) => {
      let out = `<b>${params[0].axisValue}</b><br/>`;
      params.forEach((p: any) => {
        out += `${p.marker} ${p.seriesName}: <b>${p.value.toLocaleString()}</b>`;
        if (p.seriesName === 'Pending' || p.seriesName === 'Disposed') {
          const t = params.find((x:any) => x.seriesName === `Total ${year}`)?.value || 1;
          out += ` (${((p.value / t) * 100).toFixed(1)}%)`;
        }
        out += '<br/>';
      });
      return out;
    }
  },
  legend: legend([`Total ${year}`, `Total ${year-1}`, 'Pending', 'Disposed']),
  grid: { left: '2%', right: '2%', bottom: '14%', top: '4%', containLabel: true },
  xAxis: { type: 'category', data: data.map(d => d.month), axisLabel: { color: COLORS.text, fontSize: 10 }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisTick: { show: false }, boundaryGap: false },
  yAxis: yAxisVal(),
  series: [
    {
      name: `Total ${year}`,
      type: 'line',
      data: data.map(d => d.total),
      smooth: 0.4,
      symbol: 'circle', symbolSize: 5,
      lineStyle: { color: COLORS.primary, width: 2.5 },
      itemStyle: { color: COLORS.primary },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(99,102,241,0.25)' }, { offset: 1, color: 'rgba(99,102,241,0)' }] } },
    },
    {
      name: `Total ${year-1}`,
      type: 'line',
      data: data.map(d => d.prevTotal || 0),
      smooth: 0.4,
      symbol: 'circle', symbolSize: 5,
      lineStyle: { color: COLORS.compare, width: 2.5, type: 'dashed' },
      itemStyle: { color: COLORS.compare },
    },
    {
      name: 'Pending',
      type: 'line',
      data: data.map(d => d.pending),
      smooth: 0.4,
      symbol: 'circle', symbolSize: 4,
      lineStyle: { color: COLORS.pending, width: 2 },
      itemStyle: { color: COLORS.pending },
    },
    {
      name: 'Disposed',
      type: 'line',
      data: data.map(d => d.disposed),
      smooth: 0.4,
      symbol: 'circle', symbolSize: 4,
      lineStyle: { color: COLORS.disposed, width: 2 },
      itemStyle: { color: COLORS.disposed },
    },
  ],
});

// ── 4. Donut / Pie ────────────────────────────────────────────────────────────
export const getPieOptions = (data: { name: string; value: number }[]): EChartsOption => {
  const total = data.reduce((s, d) => s + d.value, 0);
  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: COLORS.tooltip,
      borderColor: 'rgba(255,255,255,0.08)',
      textStyle: { color: COLORS.textBright, fontSize: 12 },
      formatter: (p: any) =>
        `<b>${p.name}</b><br/>Count: <b>${p.value.toLocaleString()}</b> (${p.percent?.toFixed(1)}%)`,
      extraCssText: 'box-shadow:0 8px 32px rgba(0,0,0,0.5);border-radius:8px;',
    },
    legend: { orient: 'vertical', right: 8, top: 'center', textStyle: { color: COLORS.text, fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
    color: PALETTE,
    title: {
      text: total >= 1000 ? `${(total/1000).toFixed(1)}k` : String(total),
      subtext: 'Total',
      left: '29%',
      top: '41%',
      textAlign: 'center',
      textStyle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
      subtextStyle: { color: COLORS.text, fontSize: 11 },
      itemGap: 4
    },
    series: [{
      type: 'pie',
      radius: ['40%', '68%'],
      center: ['30%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 4, borderColor: '#0f172a', borderWidth: 2 },
      label: { show: false },
      labelLine: { show: false },
      data: data.map(d => ({ name: d.name, value: d.value })),
      emphasis: { scale: true, scaleSize: 6 },
    }],
  };
};

// ── 5. Horizontal Grouped Bar (categories) ────────────────────────────────────
export const getGroupedBarOptions = (
  data: { category: string; total: number; pending: number; disposed: number }[]
): EChartsOption => ({
  tooltip: { ...tooltip(), trigger: 'axis', axisPointer: { type: 'shadow' } },
  legend: legend(['Pending', 'Disposed']),
  grid: { left: '2%', right: '6%', bottom: '10%', top: '4%', containLabel: true },
  xAxis: { type: 'value', axisLabel: { color: COLORS.text, fontSize: 10 }, splitLine: { lineStyle: { color: COLORS.grid } }, axisLine: { show: false } },
  yAxis: { type: 'category', data: data.map(d => d.category), axisLabel: { color: COLORS.text, fontSize: 10 }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisTick: { show: false } },
  series: [
    { name: 'Pending',  type: 'bar', data: data.map(d => d.pending),  itemStyle: { color: COLORS.pending,  borderRadius: [0,3,3,0] }, barMaxWidth: 20, emphasis: { focus: 'series' } },
    { name: 'Disposed', type: 'bar', data: data.map(d => d.disposed), itemStyle: { color: COLORS.disposed, borderRadius: [0,3,3,0] }, barMaxWidth: 20, emphasis: { focus: 'series' } },
  ],
});

export const getHorizontalSingleBarOptions = (data: { name: string; value: number }[]): EChartsOption => ({
  tooltip: { ...tooltip(), trigger: 'axis', axisPointer: { type: 'shadow' } },
  grid: { left: '2%', right: '6%', bottom: '10%', top: '4%', containLabel: true },
  xAxis: { type: 'value', axisLabel: { color: COLORS.text, fontSize: 10 }, splitLine: { lineStyle: { color: COLORS.grid } }, axisLine: { show: false } },
  yAxis: { type: 'category', data: data.map(d => d.name), axisLabel: { color: COLORS.text, fontSize: 10 }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, axisTick: { show: false } },
  series: [
    {
      type: 'bar',
      data: data.map(d => d.value),
      itemStyle: { color: COLORS.primary, borderRadius: [0,3,3,0] },
      barMaxWidth: 20,
    },
  ],
});

// ── 6. Line chart for trend (alias of getDurationLineOptions for generic use) ─
export const getTrendLineOptions = getDurationLineOptions;