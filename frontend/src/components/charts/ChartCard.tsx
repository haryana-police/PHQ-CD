import { ReactNode, useState } from 'react';
import { BaseChart } from './Charts';
import type { EChartsOption } from 'echarts';

interface ChartCardProps {
  title: string;
  option: EChartsOption;
  fullOption?: EChartsOption;
  height?: string;
  expandedHeight?: string;
}

export const ChartCard = ({ title, option, fullOption, height = '280px', expandedHeight = 'calc(100vh - 120px)' }: ChartCardProps) => {
  const [expanded, setExpanded] = useState(false);

  if (expanded) {
    return (
      <div className="chart-overlay">
        <div className="chart-overlay-header">
          <span className="chart-overlay-title">{title}</span>
          <button className="chart-overlay-close" onClick={() => setExpanded(false)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Close
          </button>
        </div>
        <div className="chart-overlay-body" style={{ overflowY: 'auto' }}>
          <BaseChart option={fullOption || option} height={expandedHeight} />
        </div>
      </div>
    );
  }

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <span className="chart-card-title">{title}</span>
        <button className="chart-expand-btn" onClick={() => setExpanded(true)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
          </svg>
          Expand
        </button>
      </div>
      <div className="chart-card-body">
        <BaseChart option={option} height={height} />
      </div>
    </div>
  );
};