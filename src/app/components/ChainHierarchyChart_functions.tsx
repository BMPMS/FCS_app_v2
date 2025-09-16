import Graph from "graphology";
import {Attributes} from "graphology-types";
import * as d3 from 'd3';
import {COLORS, ICONS, NODEFLOW_COLORS} from "@/app/components/MainForceChart";
import {getRemInPixels} from "@/app/components/sharedFunctions";
import {ChainNode} from "@/types/data";

type HierarchyEntry = {
    name: string;
    children?: HierarchyEntry[];
    hOrderPosition?: number;
    _children?: HierarchyEntry[];
    height?: number;
    accumulativeHeight?: number;
    class?:string;
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
    nodes: ChainNode[]
) => {
    const allTreeData = d3.hierarchy<HierarchyEntry>({name: "root", children: treeData});
    allTreeData.eachBefore((m,i) => {
        m.data.hOrderPosition = i;
        const matchingNode = nodes.find((f) => f.id === m.data.name);
        if(matchingNode){
            m.data.class = matchingNode.class;
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
            .on("mouseover",(event, d) => {
                svg.selectAll<SVGRectElement,d3.HierarchyNode<HierarchyEntry>>(".treeBackgroundRect")
                    .interrupt()
                    .transition()
                    .duration(100)
                    .attr("opacity",(b) => b.data.name === d.data.name ?1 : 0)
            })
            .on("mouseout",() => {
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
            .attr("fill", COLORS.darkblue)
            .attr("text-anchor", "start")
            .style("font-size", (d) => d.depth === 1 ? parentFontSize : childFontSize)
            .style("dominant-baseline","middle")
            .attr("dy", (d) => d.children ? -2 : 0)
            .attr("x",  5)
            .attr("y", (d) => (d.data.height || 0)/2)
            .text((d) => d.data.children || d.data._children  ?  (d.children ? ICONS["expanded"] :ICONS["collapsed"]) : "");

        treeGroup.select(".treeLabel")
            .attr("pointer-events", "none")
            .attr("fill", COLORS.black)
            .attr("text-anchor", "start")
            .style("font-size", (d) => d.depth === 1 ? parentFontSize : childFontSize)
            .style("dominant-baseline","middle")
            .attr("x",  (d) => 5 + (d.data.children || d.data._children ? (d.depth === 1 ? parentFontSize : childFontSize) + 5 : depthShift))
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
            .attr("r", (d) => d.data._children  ? 0 : childFontSize/3)
            .attr("text-anchor", "end")
            .attr("cx", (d) => svgWidth - 10 - (d.depth * depthShift))
            .attr("cy", (d) => (d.data.height || 0)/2)


    }
    reDrawTree(allTreeData);

}
