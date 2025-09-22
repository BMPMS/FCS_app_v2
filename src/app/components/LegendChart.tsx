"use client"; // This marks the component to run on the client

import * as d3 from 'd3';
import React, {FC, useRef, useEffect, useState} from "react";
import {COLORS, NODEFLOW_COLORS, NODETYPE_ICONS} from "@/app/components/MainForceChart";
import {CHAIN_CIRCLE_RADIUS} from "@/app/components/ChainForceChart";
import {drawArrowDefs, getRemInPixels} from "@/app/components/sharedFunctions";

type LegendChartProps = {
    containerClass: string;
    legendData: {colors: string[], icons: string[]};
    legendRowHeight: number;
}


const LegendChart: FC<LegendChartProps> = ({
                                                       containerClass, legendData,legendRowHeight

                                                   }) => {
    const [tick, setTick] = useState(0);
    const ref = useRef(null);

    // Modified hook that returns the tick value
    useEffect(() => {
        const handleResize = () => setTick(t => t + 1);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {

        // svgs and sizing
        if (!ref.current) return;
        const svg = d3.select<SVGSVGElement,unknown>(ref.current);

        const svgNode = svg.node();
        if (!svgNode) return;

        const containerNode = d3.select<Element, unknown>(`.${containerClass}Container`).node();
        if (!containerNode) return;

        const {  clientWidth: svgWidth  } = containerNode;

        const svgHeight = legendRowHeight * 5.5;

        svg.attr('width', svgWidth )
            .attr('height', svgHeight)
            .style("background-color",COLORS.lightestgrey);

        const fontSize = getRemInPixels() * 0.85;

        const margins = 10;

        const nodeColorsGroup = svg
            .selectAll(".nodeColorsGroup")
            .data(legendData.colors.filter((f) => f !== "successfulLink"))
            .join((group) => {
                const enter = group.append("g").attr("class", "nodeColorsGroup");
                enter.append("circle").attr("class", "nodeCircle");
                enter.append("text").attr("class", "nodeLabel");
                return enter;
            });

        nodeColorsGroup.select(".nodeCircle")
            .attr("cx",margins + CHAIN_CIRCLE_RADIUS)
            .attr("cy", (d,i) => margins + CHAIN_CIRCLE_RADIUS + (i * legendRowHeight) )
            .attr("r", CHAIN_CIRCLE_RADIUS)
            .attr("fill", (d) => NODEFLOW_COLORS[d as keyof typeof NODEFLOW_COLORS]);

        nodeColorsGroup.select(".nodeLabel")
            .attr("font-size",fontSize)
            .attr("x",margins + (CHAIN_CIRCLE_RADIUS * 2) + 7)
            .attr("y", (d,i) => margins + (CHAIN_CIRCLE_RADIUS * 1.1) + (i * legendRowHeight) )
            .style("dominant-baseline","middle")
            .attr("fill", COLORS.darkerGrey)
            .text((d) => d);

        const nodeIconsGroup = svg
            .selectAll(".nodeIconsGroup")
            .data(legendData.icons)
            .join((group) => {
                const enter = group.append("g").attr("class", "nodeIconsGroup");
                enter.append("text").attr("class", "fa nodeIcon");
                enter.append("text").attr("class", "nodeIconLabel");
                return enter;
            });

        nodeIconsGroup.select(".nodeIcon")
            .attr("x",svgWidth   - CHAIN_CIRCLE_RADIUS - margins)
            .attr("y", (d,i) => margins + CHAIN_CIRCLE_RADIUS + (i * legendRowHeight) )
            .attr("text-anchor", "middle")
            .style("dominant-baseline","middle")
            .attr("fill", COLORS.darkgrey)
            .text((d) => NODETYPE_ICONS[d as keyof typeof NODETYPE_ICONS]);

        nodeIconsGroup.select(".nodeIconLabel")
            .attr("font-size",fontSize)
            .attr("text-anchor","end")
            .attr("x",svgWidth - margins - (CHAIN_CIRCLE_RADIUS * 2) - 7)
            .attr("y", (d,i) => margins + (CHAIN_CIRCLE_RADIUS * 1.1) + (i * legendRowHeight) )
            .style("dominant-baseline","middle")
            .attr("fill", COLORS.darkerGrey)
            .text((d) => d === "failedOutput" ? "failed flow node" : d);


        const markerIds = ["arrowEndGreen"]

        drawArrowDefs(svg,containerClass,markerIds,8);


        svg.select(".successfulLinkPath")
            .attr("stroke", NODEFLOW_COLORS.successfulLink)
            .attr("stroke-width",2)
            .attr("marker-end", `url(#arrowEndGreen${containerClass})`)
            .attr("d",`M${margins + CHAIN_CIRCLE_RADIUS},${svgHeight - margins} L${svgWidth-margins - CHAIN_CIRCLE_RADIUS},${svgHeight - margins}`)


        svg.select(".successfulLinkLabel")
            .attr("font-size",fontSize)
            .attr("fill", COLORS.darkerGrey)
            .attr("x",margins + CHAIN_CIRCLE_RADIUS)
            .attr("y", svgHeight - margins - 5)
            .text("successful flow link");

    }, [containerClass,legendData,tick,legendRowHeight]);


    return (
        <>
            <svg className={`noselect svg_${containerClass}`} ref={ref}>
                <defs className={"arrowDefs"}/>
                <path className={"successfulLinkPath"}/>
                <text className={"successfulLinkLabel"}/>
            </svg>
        </>
    );
};

export default LegendChart;
