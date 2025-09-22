"use client"; // This marks the component to run on the client

import * as d3 from 'd3';
import {FC, useRef, useEffect, useState} from "react";
import {ChartData} from "@/types/data";
import {drawArrowDefs, getNodeRadiusAndLabelSize} from "@/app/components/sharedFunctions";
import {drawNetworkMap} from "@/app/components/NetworkMapChart_functions";
import {MAIN_CHART_PANEL_HEIGHT} from "@/app/components/MainForceChart";


type NetworkMapChartProps = {
    containerClass: string;
    mainContainerClass: string;
    chartData: ChartData;
    architectureId: number;
}

export const LAYER_COLOUR_RANGE = ["#F8F8F8","#D8D8D8"];

const ChainForceChart: FC<NetworkMapChartProps> = ({
                                                                 containerClass,
    mainContainerClass,
                                                                 chartData,
    architectureId

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

        const {  clientHeight: svgHeight  } = containerNode;
        const {clientWidth: svgWidth} = containerNode;


        const mainContainerNode = d3.select<Element, unknown>(`.${mainContainerClass}Container`).node();
        if (!mainContainerNode) return;

        const {  clientHeight: mainChartHeight  } = mainContainerNode;
        const {clientWidth: mainChartWidth} = mainContainerNode;

        svg.attr('width', svgWidth )
            .attr('height', svgHeight)

        drawArrowDefs(svg,containerClass,["arrowEndDark"],12);

        const currentArchitecture = chartData.architecture.find((f) => f.arch_id === architectureId);
        if(!currentArchitecture) return;
        const layerMapper = currentArchitecture.layers.reduce((acc,entry) => {
            acc[entry.network] = entry.layer
            return acc;
        },{} as {[key:string] : number});

        const currentNetworks = currentArchitecture.layers.map((m) => m.network);

        const networkNodes = chartData.networks
            .filter((f) => currentNetworks.includes(f.id))
            .map((m) => m.data);


        const networkLinks = currentArchitecture.routes.reduce((acc, entry) => {
            const source = entry.source_net;
            const target = entry.dest_net;
            const matchingLink = acc.find((f) => f.source === source && f.target === target);
            const oppositeLink = acc.find((f) => f.source === target && f.target === source);
            if(matchingLink){
                if(oppositeLink && matchingLink.direction === "out"){
                    matchingLink.direction = "both";
                }
            } else {
                acc.push({source, target, direction: "out"})
            }
            return acc;
        },[] as {source: string, target:string, direction: string}[])


        const totalNodes = d3.sum(networkNodes, (d) => d.nodes.length);
        const {labelFontSize} = getNodeRadiusAndLabelSize(mainChartWidth, mainChartHeight - MAIN_CHART_PANEL_HEIGHT, totalNodes)
        drawNetworkMap(svg,networkNodes,networkLinks,layerMapper, svgWidth,svgHeight,containerClass,mainContainerClass,labelFontSize)

    }, [containerClass, chartData,architectureId, mainContainerClass,tick]);


    return (
        <>
            <div id="networkMapChartTooltip" className={"chartTooltip"}/>
            <svg className={`noselect svg_${containerClass}`} ref={ref}>
                <defs className={"arrowDefs"}>
                </defs>
                <g className={"chartGroup"}>
                    <g className={"layerGroup"}/>
                    <g className={"linkGroup"}/>
                    <g className={"nodeGroup"}/>
                </g>

            </svg></>
    );
};

export default ChainForceChart;
