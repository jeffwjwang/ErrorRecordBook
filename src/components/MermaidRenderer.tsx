import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: true,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: 'Inter, system-ui, sans-serif',
});

interface MermaidRendererProps {
  chart: string;
}

const MermaidRenderer: React.FC<MermaidRendererProps> = ({ chart }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && chart) {
      ref.current.removeAttribute('data-processed');
      mermaid.contentLoaded();
      
      // We need to render manually if contentLoaded doesn't pick it up
      const renderChart = async () => {
        try {
          const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
          const { svg } = await mermaid.render(id, chart);
          if (ref.current) {
            ref.current.innerHTML = svg;
          }
        } catch (error) {
          console.error('Mermaid render failed:', error);
          if (ref.current) {
            ref.current.innerHTML = '<div class="text-red-500 text-xs p-2 bg-red-50 rounded">图表渲染失败</div>';
          }
        }
      };
      
      renderChart();
    }
  }, [chart]);

  return (
    <div className="mermaid-container w-full overflow-x-auto py-4 flex justify-center bg-white rounded-xl border border-gray-100 shadow-sm min-h-[100px] items-center">
      <div ref={ref} className="mermaid" />
    </div>
  );
};

export default MermaidRenderer;
