// components/dashboard/Dashboard.jsx
'use client'; // Marks this component as client-side only

import React, { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import MapPanel from './MapPanel'; // Adjust path based on your structure
import { Button } from '../ui/button';

const Dashboard = ({ onSwitchToMap, data }) => {
  const [view, setView] = useState('charts');

  const handleToggleView = () => {
    const newView = view === 'charts' ? 'map' : 'charts';
    setView(newView);
    if (newView === 'map' && onSwitchToMap) onSwitchToMap();
  };

  // Initialize chartOptions with a default value
  const [chartOptions, setChartOptions] = useState({
    bar: { title: { text: 'No data to visualize' } },
  });

  useEffect(() => {
    const src = Array.isArray(data) && data.length ? data : [];

    if (!src.length) {
      setChartOptions({ bar: { title: { text: 'No data to visualize' } } });
      return;
    }

    // Determine which condition metrics are present in the data
    const presentMetrics = new Set();
    src.forEach(item => {
      const m = item?.measurements || {};
      Object.keys(m).forEach(k => presentMetrics.add(k));
    });

    const conds = ['temperature', 'salinity', 'pressure'].filter(c =>
      ['min', 'max', 'avg'].some(s => presentMetrics.has(`${c}_${s}`))
    );

    // Build dynamic y-axes per condition with proper units
    const units = { temperature: '°C', salinity: 'ppt', pressure: 'dbar' };
    const yAxes = [];
    const condToAxis = {};
    conds.forEach((c, idx) => {
      yAxes.push({
        type: 'value',
        name: `${c.charAt(0).toUpperCase() + c.slice(1)} (${units[c]})`,
        axisLabel: { formatter: `{value} ${units[c]}` },
      });
      condToAxis[c] = idx;
    });

    // Build dynamic series only for present metrics, with matching labels/units
    const series = [];
    const statOrder = ['min', 'max', 'avg'];
    statOrder.forEach(stat => {
      conds.forEach(c => {
        const key = `${c}_${stat}`;
        if (!presentMetrics.has(key)) return;
        series.push({
          name: `${c.charAt(0).toUpperCase() + c.slice(1)} ${stat.charAt(0).toUpperCase() + stat.slice(1)}`,
          type: stat === 'avg' ? 'line' : 'bar',
          yAxisIndex: condToAxis[c],
          tooltip: { valueFormatter: v => (v === null || v === undefined ? '' : `${v} ${units[c]}`) },
          data: src.map(item => item?.measurements?.[key] ?? null),
        });
      });
    });

    // X-axis categories from datetime (fallback to float_id)
    const categories = src.map(item => {
      const dt = item?.datetime || '';
      if (typeof dt === 'string' && dt.length) {
        // Support both ISO and plain datetime strings
        const d = dt.includes('T') ? dt.split('T')[0] : dt.split(' ')[0];
        return d || dt;
      }
      return `Float ${item?.float_id}`;
    });

    setChartOptions({
      bar: {
        title: { text: 'Requested Conditions' },
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'cross', crossStyle: { color: '#999' } },
        },
        toolbox: {
          feature: {
            dataView: { show: true, readOnly: false },
            magicType: { show: true, type: ['line', 'bar', 'pie'] },
            restore: { show: true },
            saveAsImage: { show: true },
            dataZoom: { yAxisIndex: 'none' },
          },
          orient: 'vertical',
          right: 10,
          top: 'center',
        },
        grid: { top: '30%', left: '5%', right: '15%', bottom: '20%', containLabel: true },
        xAxis: [
          {
            type: 'category',
            data: categories,
            axisPointer: { type: 'shadow' },
          },
        ],
        yAxis: yAxes.length ? yAxes : [{ type: 'value', name: 'Value', axisLabel: { formatter: '{value}' } }],
        dataZoom: [
          { startValue: categories[0], height: 20, bottom: '40px' },
          { type: 'inside' },
        ],
        series,
      },
    });
  }, [data]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex justify-end pl-0">
        <Button
          className="cursor-pointer"
          onClick={handleToggleView}
        >
          {view === 'charts' ? 'Toggle to Map' : 'Toggle to Dashboard'}
        </Button>
      </div>
      <div className="flex-1 overflow-hidden" style={{ height: 'calc(100vh - 64px)', position: 'relative' }}>
        <div className="h-full">
          {view === 'charts' ? (
            <div className="p-4 space-y-8">
              <ReactECharts option={chartOptions.bar || { title: { text: 'No data to visualize' } }} style={{ height: '550px', width: '100%' }} />
            </div>
          ) : (
            <MapPanel isVisible={view === 'map'} />
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;