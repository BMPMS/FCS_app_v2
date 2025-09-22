import Graph from "graphology";
import {Attributes} from "graphology-types";
import * as d3 from 'd3';
import {COLORS, ICONS, NODEFLOW_COLORS, NODETYPE_ICONS} from "@/app/components/MainForceChart";
import {getRemInPixels, rgbStringToHex} from "@/app/components/sharedFunctions";
import {ChainLink, ChainNode, NetworkLink, NetworkNode} from "@/types/data";
import {CHAIN_CIRCLE_RADIUS, NODE_HIGHLIGHT_STROKE_WIDTH} from "@/app/components/ChainForceChart";
import {getAllChainAncestors, getChainAncestors, getTooltipText} from "@/app/components/ChainForceChart_functions";

export type HierarchyEntry = {
    name: string;
    children?: HierarchyEntry[];
    hOrderPosition?: number;
    _children?: HierarchyEntry[];
    height?: number;
    accumulativeHeight?: number;
    class?:string;
    type?: string;
    desc?: string;
    id?: string;
}


export const getHierarchyData = (
    searchNodes: string[],
    currentGraph: Graph<Attributes, Attributes, Attributes>,
    searchDirection: string
) => {
    const getChildren = (nodeId: string) => searchDirection === "input" ?
        currentGraph.outNeighbors(nodeId) : currentGraph.inNeighbors(nodeId);

    const getTreeData = (currentChildren: string[]) => {
        const currentOneLevelChildren = [];
        let childrenToQuery = currentChildren;
        // loop through single children and add to current child list
        while (childrenToQuery.length === 1) {
            const nextChild = childrenToQuery[0];
            currentOneLevelChildren.push(nextChild);
            childrenToQuery = getChildren(nextChild);
        }
        // convert to an array
        const childrenAsArray = currentOneLevelChildren.reduce((acc, entry) => {
            acc.push({name: entry})
            return acc;
        }, [] as HierarchyEntry[]);
        // if no further children and/or no children, return
        if (childrenToQuery.length === 0 || childrenAsArray.length === 0) return childrenAsArray;
        // if > 1 child, find the child in question
        const lastChild = childrenAsArray[childrenAsArray.length - 1];
        // repeat the process for it's children
        const lastChildChildren = childrenToQuery.reduce((acc, entry) => {
            acc.push({
                name: entry,
                children: getTreeData(getChildren(entry))
            })
            return acc;
        }, [] as HierarchyEntry[]);
        lastChild.children = lastChildChildren;
        return childrenAsArray;
    }

    return searchNodes.reduce((acc, entry) => {
        const children = getChildren(entry)

        const rootHierarchy = children.length === 1 ? getTreeData(children)
            : children.reduce((acc, entry) => {
                acc.push({
                    name: entry,
                    children: getTreeData([entry])});
                return acc;
            }, [] as HierarchyEntry[])
        acc.push({
            name: entry,
            children: rootHierarchy
        })
        return acc;
    }, [] as HierarchyEntry[])
}

export const drawTreeChart = (
    svg:d3.Selection<SVGSVGElement, unknown, HTMLElement, unknown>,
    svgWidth: number,
    treeData: HierarchyEntry[],
    nodes: ChainNode[],
    links: ChainLink[],
    mainContainerClass: string,
    currentGraph: Graph<Attributes, Attributes, Attributes>,
    searchNodes: string[],
    svgHeight: number
) => {
    const mainGraphSvg = d3.select(`.svg_${mainContainerClass}`);

    const allTreeData = d3.hierarchy<HierarchyEntry>({name: "root", children: treeData});
    allTreeData.eachBefore((m,i) => {
        m.data.hOrderPosition = i;
        const matchingNode = nodes.find((f) => f.id === m.data.name);
        if(matchingNode){
            m.data.class = matchingNode.class;
            m.data.type = matchingNode.type;
            m.data.desc = matchingNode.desc;
            m.data.id = matchingNode.id;
        }
    })
    allTreeData.descendants().map((m) => {
        if(m.depth > 0 && m.children){
            m.data._children = m.children;
            m.children = undefined;
        }
    })

    const parentHeight = getRemInPixels() * 2;
    const textHeightPercent = 0.5;
    const childHeight = parentHeight * 0.9;
    const reDrawTree = (currentTreeData:  d3.HierarchyNode<HierarchyEntry>) => {

        const currentChartData =   currentTreeData.descendants()
            .filter((f) => f.depth > 0)
            .sort((a,b) => d3.ascending(a.data.hOrderPosition || -1, b.data.hOrderPosition || 0));

        const totalHeight = d3.sum(currentChartData, (d) => d.depth === 1 ? parentHeight : childHeight) + childHeight;
        svg.attr("height", `${totalHeight}px`);

        let accumulativeHeight = 0;
        currentChartData.map((m) => {
            m.data.height = m.depth === 1 ? parentHeight : childHeight;
            m.data.accumulativeHeight = accumulativeHeight;
            accumulativeHeight += m.data.height;
        })

        const treeGroup = svg
            .selectAll<SVGGElement, d3.HierarchyNode<HierarchyEntry>>(".treeGroup")
            .data(currentChartData, (d) => d.data.hOrderPosition || -1)
            .join((group) => {
                const enter = group.append("g").attr("class", "treeGroup");
                enter.append("rect").attr("class", "treeBackgroundRect");
                enter.append("text").attr("class", "fa treeIcon");
                enter.append("text").attr("class", "treeLabel");
                enter.append("text").attr("class", "treeResultCount");
                enter.append("circle").attr("class", "treeDirectionCircle");
                enter.append("text").attr("class", "fa treeCircleIcon");
                return enter
            })

        const depthShift = 10;
        treeGroup.attr("transform", (d) => `translate(${(d.depth - 1) * depthShift},${d.data.accumulativeHeight})`)

        treeGroup.select(".treeBackgroundRect")
            .attr("width", svgWidth)
            .attr("height",(d) => d.data.height || 0)
            .attr("fill","#F0F0F0")
            .attr("cursor", "pointer")
            .attr("opacity",  0)
            .on("mousemove",(event, d) => {
                svg.selectAll<SVGRectElement,d3.HierarchyNode<HierarchyEntry>>(".treeBackgroundRect")
                    .interrupt()
                    .transition()
                    .duration(100)
                    .attr("opacity",(b) => b.data.name === d.data.name ?1 : 0)
                const ancestors = getChainAncestors(d.data.name,nodes, links);
                let currentFill = NODEFLOW_COLORS[d.data.class as keyof typeof NODEFLOW_COLORS];
                if(currentFill.includes("rgb")){
                    currentFill = rgbStringToHex(currentFill);
                }
                let allAncestors: string[] = [];
                if(currentFill === COLORS.red){
                    allAncestors = getAllChainAncestors(currentGraph,d.data.name,ancestors);
                }

                if(mainGraphSvg.node() && !d.data._children) {
                    mainGraphSvg.selectAll<SVGCircleElement, NetworkNode>(".networkChainNode")
                        .attr("opacity",(n) => allAncestors.includes(n.node.id) || ancestors.includes(n.node.id) ?  1 : 0)
                        .attr("fill", (n) => allAncestors.includes(n.node.id) ? COLORS.gold :
                            NODEFLOW_COLORS[n.node.class as keyof typeof NODEFLOW_COLORS])
                        .attr("stroke-width", (n) => n.node.id === d.id || searchNodes.includes(n.node.id)? NODE_HIGHLIGHT_STROKE_WIDTH : 0)
                        .attr("stroke", (n) => searchNodes.includes(n.node.id)? COLORS.gold : COLORS.darkblue)

                    mainGraphSvg.selectAll<SVGCircleElement, NetworkNode>(".networkChainNodeIcon")
                        .attr("opacity",(n) => allAncestors.includes(n.node.id) || ancestors.includes(n.node.id) ?  1 : 0)

                    mainGraphSvg.selectAll<SVGCircleElement, NetworkNode>(".networkChainNodeLabel")
                        .attr("opacity",(n) => allAncestors.includes(n.node.id)  ?  1 : 0)

                    mainGraphSvg.selectAll<SVGGElement, NetworkNode>(".networkNodeGroup")
                        .attr("opacity", (n) => allAncestors.includes(n.node.id) || ancestors.includes(n.node.id) ? 1 :
                            0)

                    mainGraphSvg.selectAll<SVGCircleElement, NetworkNode>(".linkPath").attr("opacity",0);

                    mainGraphSvg.selectAll<SVGPathElement, NetworkLink>(".linkChainPath")
                        .attr("opacity",(l) => {
                            if(typeof l.source === "string" || typeof l.target === "string") return 0
                            const sourceAndTargetAncestors = ancestors.includes(l.source.node.id) && ancestors.includes(l.target.node.id);
                            const sourceAndTargetAllAncestors = allAncestors.includes(l.source.node.id) && allAncestors.includes(l.target.node.id);
                            return sourceAndTargetAncestors || sourceAndTargetAllAncestors ? 1 : 0;
                        })
                        .attr("stroke-width",(l) => {
                            if(typeof l.source === "string") return 0;
                            if(typeof l.target === "string") return 0;
                            const sourceAndTargetAncestors = ancestors.includes(l.source.node.id) && ancestors.includes(l.target.node.id);
                            const sourceAndTargetAllAncestors = allAncestors.includes(l.source.node.id) && allAncestors.includes(l.target.node.id);
                            return sourceAndTargetAncestors || sourceAndTargetAllAncestors ? CHAIN_CIRCLE_RADIUS/10 : 0;
                        })
                }

                svg.selectAll<SVGTextPathElement,ChainNode>(".nodeLabelTextPath")
                    .attr("opacity", (n) => ancestors.includes(n.id) && n.id !== d.id? 1 : 0);

                svg.selectAll<SVGPathElement,ChainLink>(".linkLine")
                    .attr("opacity",(l) => {
                        if(typeof l.source === "string") return 0;
                        if(typeof l.target === "string") return 0;
                        return ancestors.includes(l.source.id) && ancestors.includes(l.target.id) ? 1 : 0;
                    })

                svg.selectAll<SVGCircleElement, ChainNode>(".nodeBackgroundCircle")
                    .attr("opacity",(n) => ancestors.includes(n.id) ? 1 : 0)


                svg.selectAll<SVGCircleElement, ChainNode>(".nodeCircle")
                    .attr("opacity",(n) => ancestors.includes(n.id) ? 1 : 0)
                    .attr("stroke-width",(n) => n.id === d.id ? NODE_HIGHLIGHT_STROKE_WIDTH : 0);

                const tooltipText = getTooltipText(d.data);
                const tooltipLineCount = tooltipText.split("<br>").length;
                let tooltipY = event.layerY - (tooltipLineCount* 7);
                if((tooltipY + (tooltipLineCount * 14)) > (svgHeight * 0.8)){
                    tooltipY = event.layerY - (tooltipLineCount* 14)
                }

                d3.select("#chainHierarchyChartTooltip")
                    .style("visibility","visible")
                    .style("left",`${event.layerX + CHAIN_CIRCLE_RADIUS + 10}px`)
                    .style("top",`${tooltipY}px`)
                    .html(tooltipText)

            })
            .on("mouseout",() => {
                d3.select("#chainHierarchyChartTooltip")
                    .style("visibility","hidden")
                svg.selectAll<SVGRectElement, d3.HierarchyNode<HierarchyEntry>>(".treeBackgroundRect")
                    .attr("opacity", 0)
                ;
            })
            .on("click", (event,d) => {
                if(d.children) {
                    d.data._children = d.children;
                    d.children = undefined;
                } else {
                    // @ts-expect-error standard d3 practice re-assigning children with tree
                    d.children = d.data._children;
                }
                reDrawTree(currentTreeData);

            });


        const parentFontSize = parentHeight * textHeightPercent;
        const childFontSize = childHeight * textHeightPercent;

        treeGroup.select(".treeIcon")
            .attr("pointer-events", "none")
            .attr("fill", (d) => d.data.children || d.data._children  ?  COLORS.darkblue : COLORS.midgrey)
            .attr("text-anchor", "start")
            .style("font-size", (d) => d.depth === 1 ? parentFontSize : childFontSize)
            .style("dominant-baseline","middle")
            .attr("dy", (d) => d.children ? -2 : 0)
            .attr("x",  (d) => d.data.children || d.data._children  ? 5 : -2)
            .attr("y", (d) => (d.data.height || 0)/2)
            .text((d) => d.data.children || d.data._children  ?  (d.children ? ICONS["expanded"] :ICONS["collapsed"]) : ICONS["down"]);

        treeGroup.select(".treeLabel")
            .attr("pointer-events", "none")
            .attr("fill", COLORS.black)
            .attr("text-anchor", "start")
            .style("font-size", (d) => d.depth === 1 ? parentFontSize : childFontSize)
            .style("dominant-baseline","middle")
            .attr("x",  (d) => 10 + (d.data.children || d.data._children ? (d.depth === 1 ? parentFontSize : childFontSize) + 5 : depthShift))
            .attr("y", (d) => (d.data.height || 0)/2)
            .text((d) => d.data.name.replace(/-/g,'  '));


        treeGroup.select(".treeResultCount")
            .attr("pointer-events", "none")
            .attr("fill", COLORS.midgrey)
            .attr("text-anchor", "middle")
           .style("font-size", (d) => d.depth === 1 ? parentFontSize : childFontSize)
            .style("dominant-baseline","middle")
            .attr("x", (d) => svgWidth - 10 - (d.depth * depthShift))
            .attr("y", (d) => (d.data.height || 0)/2)
            .text((d) => d.data._children?.length  || "");

        treeGroup.select(".treeDirectionCircle")
            .attr("pointer-events", "none")
            .attr("fill", (d) => d.data.class ? NODEFLOW_COLORS[d.data.class as keyof typeof NODEFLOW_COLORS] : "none")
            .attr("r", (d) => d.data._children  ? 0 : CHAIN_CIRCLE_RADIUS)
            .attr("cx", (d) => svgWidth - 10 - (d.depth * depthShift))
            .attr("cy", (d) => (d.data.height || 0)/2);

        treeGroup
            .select(".treeCircleIcon")
            .attr("text-anchor", "middle")
            .style("dominant-baseline","middle")
            .attr("font-size", CHAIN_CIRCLE_RADIUS)
            .attr("x", (d) => svgWidth - 10 - (d.depth * depthShift))
            .attr("y", (d) => (d.data.height || 0)/2)
            .attr("fill", "white")
            .attr("text-anchor","middle")
            .style("dominant-baseline","middle")
            .text((d) => d.data._children  ? "" : NODETYPE_ICONS[d.data.type as keyof typeof NODETYPE_ICONS]);




    }
    reDrawTree(allTreeData);

}
