import { useEffect, useRef } from 'react';
import { select } from 'd3-selection';
import { scaleTime } from 'd3-scale';
import { axisBottom } from 'd3-axis';

interface SharedXAxisProps {
  xDomain: [Date, Date];
  width: number;
  marginLeft: number;
}

export function SharedXAxis({ xDomain, width, marginLeft }: SharedXAxisProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    select(svgRef.current).selectAll('*').remove();

    const margin = { left: marginLeft, right: 5 };
    const innerWidth = width - margin.left - margin.right;

    const svg = select(svgRef.current)
      .attr('width', width)
      .attr('height', 30);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},0)`);

    const xScale = scaleTime()
      .domain(xDomain)
      .range([0, innerWidth]);

    let previousYear: number | null = null;
    const xAxis = axisBottom(xScale).tickFormat((domainValue) => {
      const date = domainValue as Date;
      const currentYear = date.getFullYear();
      const shouldShowYear = previousYear === null || currentYear !== previousYear;
      previousYear = currentYear;

      const month = date.toLocaleDateString('en-US', { month: 'short' });
      const day = date.getDate();

      return shouldShowYear ? `${month} ${day}, ${currentYear}` : `${month} ${day}`;
    });

    g.append('g')
      .attr('class', 'x-axis')
      .call(xAxis);

  }, [xDomain, width, marginLeft]);

  return <svg ref={svgRef} className="w-full" />;
}
