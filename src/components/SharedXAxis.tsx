import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface SharedXAxisProps {
  xDomain: [Date, Date];
  width: number;
  marginLeft: number;
}

export function SharedXAxis({ xDomain, width, marginLeft }: SharedXAxisProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    d3.select(svgRef.current).selectAll('*').remove();

    const margin = { left: marginLeft, right: 5 };
    const innerWidth = width - margin.left - margin.right;

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', 30);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},0)`);

    const xScale = d3.scaleTime()
      .domain(xDomain)
      .range([0, innerWidth]);

    let previousYear: number | null = null;
    const xAxis = d3.axisBottom(xScale).tickFormat((domainValue) => {
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
