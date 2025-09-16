"use client"; // This marks the component to run on the client

import * as d3 from 'd3';
import {FC, useRef, useEffect, useState} from "react";
import {ChainLink, ChainNode} from "@/types/data";

import Graph from "graphology";
import {Attributes} from "graphology-types";
import {drawTreeChart, getHierarchyData} from "@/app/components/ChainHierarchyChart_functions";

type ChainHierarchyChartProps = {
    containerClass: string;
    mainContainerClass: string;
    chainChartData: {nodes: ChainNode[],links: ChainLink[]};
    searchNodes: string[];
    searchDirection: string;
    currentGraph: Graph<Attributes, Attributes, Attributes> | undefined;
}

export const CHAIN_CIRCLE_RADIUS = 12;

const ChainHierarchyChart: FC<ChainHierarchyChartProps> = ({
                                                                 containerClass,
    mainContainerClass,
    chainChartData,
    searchDirection,
    searchNodes,
    currentGraph

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

        const {  clientHeight:svgHeight,  clientWidth: svgWidth } = containerNode;

        svg.attr('width', svgWidth)
            .attr('height', svgHeight);

        if(currentGraph){
            const {nodes} = chainChartData;
            const treeData = getHierarchyData(searchNodes,currentGraph,searchDirection);
            drawTreeChart(svg,svgWidth,treeData,nodes);
        }




    }, [containerClass, searchNodes, mainContainerClass,tick, chainChartData, currentGraph,searchDirection]);


    return (
        <>
            <div id="chainChartTooltip" className={"chartTooltip"}/>
                <svg className={`noselect svg_${containerClass}Hierarchy`} ref={ref}>
                    <defs className={"arrowDefs"}>
                    </defs>
                </svg>
            </>
    );
};

export default ChainHierarchyChart;
