"use client"; // This marks the component to run on the client

import * as d3 from 'd3';
import React, {useRef, useEffect, useState, useImperativeHandle, ForwardRefRenderFunction} from "react";
import {ChainLink, ChainNode} from "@/types/data";
import {
    drawChainForce, handleAnimationFlow,
} from "@/app/components/ChainForceChart_functions";
import Graph from "graphology";
import {Attributes} from "graphology-types";
import {drawArrowDefs} from "@/app/components/sharedFunctions";

type ChainForceChartProps = {
    containerClass: string;
    mainContainerClass: string;
    chainChartData: {nodes: ChainNode[], links: ChainLink[]};
    searchNodes: string[];
    searchDirection: string;
    currentGraph?: Graph<Attributes, Attributes, Attributes>;
}


export const CHAIN_CIRCLE_RADIUS = 12;
export const NODE_HIGHLIGHT_STROKE_WIDTH = 2;
export interface ChartHandle {
    runAnimation: () => void;
}
const ChainForceChart: ForwardRefRenderFunction<ChartHandle, ChainForceChartProps> = ({
                                                                 containerClass,
    mainContainerClass,
    chainChartData,
    searchDirection,
    searchNodes,
    currentGraph

}, ref) => {
    const [tick, setTick] = useState(0);
     const svgRef = useRef(null);

    // Expose a method to parent
    useImperativeHandle(ref, () => ({
        runAnimation: () => {
            const svg = svgRef.current;
            if (svg && currentGraph) {
                const {nodes, links} = chainChartData;
                handleAnimationFlow(svg,300,containerClass,mainContainerClass, nodes,links,searchNodes,currentGraph);
            }
        }
    }));
    // Modified hook that returns the tick value
    useEffect(() => {
        const handleResize = () => setTick(t => t + 1);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {

        // svgs and sizing
        if (!svgRef.current) return;
        const svg = d3.select<SVGSVGElement,unknown>(svgRef.current);

        const svgNode = svg.node();
        if (!svgNode) return;

        const containerNode = d3.select<Element, unknown>(`.${containerClass}Container`).node();
        if (!containerNode) return;

        let {  clientHeight,  clientWidth: svgWidth } = containerNode;
        let svgHeight = clientHeight;
        const margin = {left: 10, right: 10, top: 5, bottom: 5};
        const {nodes,links} = chainChartData;

        svg.attr('width', svgWidth)
            .attr('height', svgHeight);

        const markerIds = [
            "arrowEndGrey",
            "arrowStartGreen",
            "arrowEndGreen",
            "arrowStartRed",
            "arrowEndRed",
        ]

        drawArrowDefs(svg,containerClass,markerIds,12);


        const depthMax = d3.max(nodes, (d) => d.depth) || 0;
        const maxDepth = d3.max(nodes, (d) => d.depth) || 0;
        const maxPerDepth = d3.max(
            Array.from(d3.group(nodes, (g) => g.depth)),
            (m) => m[1].length) || 0;

        const minDepthHeight = 60;
        const minHeightNeeded = (depthMax * minDepthHeight) + margin.top - margin.bottom;

        if(svgHeight < minHeightNeeded){
            svgHeight = minHeightNeeded ;
            svg.attr("height",`${svgHeight}px`);
        };

        const minNodeWidth = CHAIN_CIRCLE_RADIUS * 3.5;
        const minWidthNeeded = minNodeWidth * maxPerDepth;
        if(svgWidth < minWidthNeeded){
            svgWidth = minWidthNeeded - minNodeWidth;
            svg.attr("width",`${svgWidth}px`);
        }

        const depthHeight = (svgHeight - margin.top - margin.bottom)/(depthMax + 2);

        svg.select(".chartGroup")
            .attr("transform",`translate(0,${margin.top})`)

        const collideRadius = (svgWidth/(maxPerDepth + 1))/2;

        const simulation = d3
            .forceSimulation()
            .force("x", d3.forceX<ChainNode>(svgWidth/2).strength(0.05))
            .force("y", d3.forceY<ChainNode>((d) => ((searchDirection === "input" ? d.depth : maxDepth - d.depth) + 1) * depthHeight).strength(1))
            .force("link", d3.forceLink<ChainNode,ChainLink>().id((d) => d.id).strength(0))
            .force("collide", d3.forceCollide<ChainNode>().radius(Math.max(collideRadius,CHAIN_CIRCLE_RADIUS * 1.4)).strength(1).iterations(2))

        simulation.stop();


        if(currentGraph){
            drawChainForce(svg,nodes,links,simulation,searchNodes,containerClass,mainContainerClass,currentGraph,clientHeight);

        }

    }, [containerClass, searchNodes, mainContainerClass,tick, currentGraph,chainChartData, searchDirection, tick]);



    return (
        <>
            <div id="chainChartTooltip" className={"chartTooltip"}/>
                <svg className={`noselect svg_${containerClass}Force`} ref={svgRef}>
                    <defs className={"arrowDefs"}>
                    </defs>
                    <g className={"chartGroup"}>
                        <g className={"linkGroup"}/>
                        <g className={"nodeGroup"}/>
                    </g>
                </svg>
            </>
    );
};

export default React.forwardRef(ChainForceChart);
