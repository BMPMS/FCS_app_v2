import {ChainLink, ChartLink} from "@/types/data";
import * as d3 from "d3";
import {ARROW_END_PATH, ARROW_START_PATH, ARROW_VIEWBOX, COLORS} from "@/app/components/MainForceChart";

export const getRemInPixels = () =>  parseFloat(getComputedStyle(document.documentElement).fontSize)

export const getLinkId = (link: ChartLink | ChainLink , direction: "source" | "target") => {
    const node = link[direction];
    if(typeof node === "string") return node;
    if (node.id) return  node.id;
    return "" // shouldn't happen
}

export const getNodeRadiusAndLabelSize = (
    chartWidth: number,
    chartHeight: number,
    nodeCount: number
) => {
    const factor = 40;
    const nodeRadius =Math.min(Math.sqrt((chartWidth * chartHeight) / (nodeCount * factor)),10);
    const labelFontSize = Math.max(16,nodeRadius * 4);
    return {nodeRadius,labelFontSize}
}

export const rgbStringToHex = (rgb: string) =>
    "#" + (rgb.match(/\d+/g) || []).map(x => (+x).toString(16).padStart(2, "0")).join("");
export const drawArrowDefs = (
    baseSvg: d3.Selection<SVGSVGElement, unknown, HTMLElement, unknown>,
    containerClass: string,
    markerIds: string[],
    markerWidthHeight: number
    ) => {


    // final group - lineDotsMetricGroup - with the dots
    const markerGroups =  baseSvg.select(".arrowDefs")
        .selectAll(".arrowDefMarker")
        .data(markerIds)
        .join((group) => {
            const enter = group.append("marker").attr("class", "arrowDefMarker");
            enter.append("path").attr("class", "arrowDefPath");
            return enter;
        });

    markerGroups.attr("id", (d) => `${d}${containerClass}`)
        .attr("viewBox", ARROW_VIEWBOX)
        .attr("orient", "auto")
        .attr("markerWidth", markerWidthHeight)
        .attr("markerHeight", markerWidthHeight)
        .attr("refX",(d) => d.includes("Start") ? -2 : 8 );

    markerGroups.select(".arrowDefPath")
        .attr("id", (d) => `${d}Path${containerClass}`)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .attr("fill", (d) => {
            if(d.includes("Green")) return COLORS.midgreen;
            if(d.includes("Red")) return COLORS.red;
            if(d.includes("Grey")) return COLORS.midgrey;
            return "#484848";
        })
        .attr("d",(d) => d.includes("Start") ? ARROW_START_PATH : ARROW_END_PATH)
}
