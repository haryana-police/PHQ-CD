import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';

export const BaseChart = ({ option, height = '400px', width = '100%' }: { option: EChartsOption; height?: string; width?: string }) => {
  return <ReactECharts option={option} notMerge={true} style={{ height, width }} opts={{ renderer: 'canvas' }} />;
};

export const getDistrictBarOptions = (data: { district: string; total: number; pending: number; disposed: number }[]) => {
  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
      formatter: (params: { name: string; seriesName: string; value: number; color: string }) => {
        return `<div style="font-weight:600;margin-bottom:4px">${params.name}</div><div style="color:${params.color}">${params.seriesName}: <b>${params.value}</b></div>`;
      },
    },
    legend: {
      data: ['Pending', 'Disposed'],
      bottom: 0,
      textStyle: { color: '#94a3b8', fontSize: 11 },
      itemWidth: 12,
      itemHeight: 8,
    },
    grid: { left: '2%', right: '2%', bottom: '12%', top: '2%', containLabel: true },
    xAxis: {
      type: 'category',
      data: data.map(d => d.district),
      axisLabel: { rotate: 25, fontSize: 10, color: '#94a3b8', interval: 0 },
      axisLine: { lineStyle: { color: '#334155' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#94a3b8', fontSize: 10 },
      splitLine: { lineStyle: { color: '#1e293b' } },
      axisLine: { show: false },
    },
    series: [
      {
        name: 'Pending',
        type: 'bar',
        stack: 'total',
        data: data.map(d => d.pending),
        itemStyle: { color: '#fbbf24', borderRadius: [3, 3, 0, 0] },
        barMaxWidth: 28,
      },
      {
        name: 'Disposed',
        type: 'bar',
        stack: 'total',
        data: data.map(d => d.disposed),
        itemStyle: { color: '#34d399', borderRadius: [3, 3, 0, 0] },
        barMaxWidth: 28,
      },
    ],
  };
};

export const getDurationLineOptions = (data: { month: string; total: number; pending: number; disposed: number }[]) => {
  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
    },
    legend: {
      data: ['Pending', 'Disposed'],
      bottom: 0,
      textStyle: { color: '#94a3b8', fontSize: 11 },
      itemWidth: 12,
      itemHeight: 8,
    },
    grid: { left: '2%', right: '2%', bottom: '12%', top: '2%', containLabel: true },
    xAxis: {
      type: 'category',
      data: data.map(d => d.month),
      axisLabel: { color: '#94a3b8', fontSize: 10 },
      axisLine: { lineStyle: { color: '#334155' } },
      axisTick: { show: false },
      boundaryGap: false,
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#94a3b8', fontSize: 10 },
      splitLine: { lineStyle: { color: '#1e293b' } },
      axisLine: { show: false },
    },
    series: [
      {
        name: 'Pending',
        type: 'line',
        data: data.map(d => d.pending),
        smooth: 0.4,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: '#fbbf24', width: 2 },
        itemStyle: { color: '#fbbf24' },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(251,191,36,0.3)' }, { offset: 1, color: 'rgba(251,191,36,0)' }] } },
      },
      {
        name: 'Disposed',
        type: 'line',
        data: data.map(d => d.disposed),
        smooth: 0.4,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: '#34d399', width: 2 },
        itemStyle: { color: '#34d399' },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(52,211,153,0.3)' }, { offset: 1, color: 'rgba(52,211,153,0)' }] } },
      },
    ],
  };
};

export const getPieOptions = (data: { name: string; value: number }[]) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
      formatter: (p: { name: string; value: number; percent: number }) => `<b>${p.name}</b><br/>Count: ${p.value} (${p.percent.toFixed(1)}%)`,
    },
    legend: {
      orient: 'vertical',
      right: 8,
      top: 'center',
      textStyle: { color: '#94a3b8', fontSize: 11 },
    },
    color: ['#818cf8', '#fbbf24', '#34d399', '#f87171', '#60a5fa', '#a78bfa', '#2dd4bf', '#fb923c'],
    graphic: [
      { type: 'text', left: '28%', top: '38%', style: { text: String(total), fill: '#fff', fontSize: 20, fontWeight: 'bold' } },
      { type: 'text', left: '28%', top: '50%', style: { text: 'Total', fill: '#94a3b8', fontSize: 11 } },
    ],
    series: [{
      type: 'pie',
      radius: ['38%', '65%'],
      center: ['32%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 4, borderColor: '#1e293b', borderWidth: 2 },
      label: { show: false },
      labelLine: { show: false },
      data: data.map(d => ({ name: d.name, value: d.value })),
    }],
  };
};

export const getStackedBarOptions = (data: { category: string; total: number; pending: number; disposed: number }[]) => {
  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
      formatter: (params: { name: string; seriesName: string; value: number; color: string }) => {
        return `<div style="font-weight:600;margin-bottom:4px">${params.name}</div><div style="color:${params.color}">${params.seriesName}: <b>${params.value}</b></div>`;
      },
    },
    legend: {
      data: ['Pending', 'Disposed'],
      bottom: 0,
      textStyle: { color: '#94a3b8', fontSize: 11 },
      itemWidth: 12,
      itemHeight: 8,
    },
    grid: { left: '2%', right: '4%', bottom: '12%', top: '2%', containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#94a3b8', fontSize: 10 },
      splitLine: { lineStyle: { color: '#1e293b' } },
      axisLine: { show: false },
    },
    yAxis: {
      type: 'category',
      data: data.map(d => d.category),
      axisLabel: { color: '#94a3b8', fontSize: 10 },
      axisLine: { lineStyle: { color: '#334155' } },
      axisTick: { show: false },
    },
    series: [
      {
        name: 'Pending',
        type: 'bar',
        stack: 'total',
        data: data.map(d => d.pending),
        itemStyle: { color: '#fbbf24', borderRadius: [3, 3, 0, 0] },
        barMaxWidth: 20,
      },
      {
        name: 'Disposed',
        type: 'bar',
        stack: 'total',
        data: data.map(d => d.disposed),
        itemStyle: { color: '#34d399', borderRadius: [3, 3, 0, 0] },
        barMaxWidth: 20,
      },
    ],
  };
};