// @ts-expect-error no typescript definition for voronoiTreemap
import WordsNinja from 'wordsninja';
import * as d3 from "d3";
import {COLORS, ICONS} from "@/app/components/MainForceChart";
import {HIERARCHY_NODE_HEIGHT} from "@/app/components/SearchResultsHierarchyChart";

 export const splitSearchResults = async (searchResults: string[]) => {
     const stopWords = new Set(["at", "in", "on", "by", "the", "and", "or", "of","from","to"]);

     const ninja = new WordsNinja();
    await ninja.loadDictionary(); // Load dictionary once

    const results =  searchResults.map(str => {
        const term = str.split("-")[0];
        const tokens: string[] = ninja.splitSentence(term);
        const filteredTokens = tokens.filter(token => !stopWords.has(token));
        return {
            original: str,
            tokens: filteredTokens.map((m) => m.toLowerCase())
        };
    });

     const tokensSet = [...new Set(results.map((m) => m.tokens).flat())];

     return tokensSet.reduce((acc, entry) => {
        const children =  results
             .filter((f) => f.tokens.includes(entry))
             .reduce((acc,entry) => {
                 acc.push({
                     name: entry.original
                 })
                 return acc;
             }, [] as {name: string}[])

         acc.push({
             name: entry,
             children
         })
         return acc;
     },[] as {name: string, children: { name: string }[]}[])
         .sort((a,b) => d3.descending(a.children.length, b.children.length))

}

type  HierarchyNode =  {
    name: string;
    children?: HierarchyNode[];
    _children?: HierarchyNode[];
    hOrderPosition?: number;
    height?: number;
    accumulativeHeight?: number;

}
export const drawTreeChart = (
    svg:d3.Selection<SVGSVGElement, unknown, HTMLElement, unknown>,
    svgWidth: number,
    splitResults: HierarchyNode[],
    searchStr: string,
    currentSelected: string[],
    updateCurrentSelected: (newSelection: string) => void
) => {
    const allTreeData = d3.hierarchy<HierarchyNode>({name: "root", children: splitResults});
    allTreeData.eachBefore((m,i) => {
        m.data.hOrderPosition = i;
    })
     allTreeData.descendants().map((m) => {
        if(m.depth > 0 && m.children){
            m.data._children = m.children;
            m.children = undefined;
        }
    })

    const textHeightPercent = 0.5;
    const childHeight = HIERARCHY_NODE_HEIGHT * 0.9;
    const reDrawTree = (currentTreeData:  d3.HierarchyNode<HierarchyNode>) => {

        const currentChartData =   currentTreeData.descendants()
            .filter((f) => f.depth > 0)
            .sort((a,b) => d3.ascending(a.data.hOrderPosition || -1, b.data.hOrderPosition || 0));

        const totalHeight = d3.sum(currentChartData, (d) => d.depth === 1 ? HIERARCHY_NODE_HEIGHT : childHeight);
        svg.attr("height", `${totalHeight}px`);

        let accumulativeHeight = 0;
        currentChartData.map((m) => {
            m.data.height = m.depth === 1 ? HIERARCHY_NODE_HEIGHT : childHeight;
            m.data.accumulativeHeight = accumulativeHeight;
            accumulativeHeight += m.data.height;
        })
        const treeGroup = svg
            .selectAll<SVGGElement, d3.HierarchyNode<HierarchyNode>>(".treeGroup")
            .data(currentChartData, (d) => d.data.hOrderPosition || -1)
            .join((group) => {
                const enter = group.append("g").attr("class", "treeGroup");
                enter.append("rect").attr("class", "treeBackgroundRect");
                enter.append("text").attr("class", "fa treeIcon");
                enter.append("text").attr("class", "treeLabel");
                enter.append("text").attr("class", "treeResultCount");
                enter.append("text").attr("class", "fa treeSelectedIcon");
                enter.append("text").attr("class", "networkLabel");
                return enter
            })

        treeGroup.attr("transform", (d) => `translate(0,${d.data.accumulativeHeight})`)

        treeGroup.select(".treeBackgroundRect")
            .attr("width", svgWidth)
            .attr("height",(d) => d.data.height || 0)
            .attr("fill",(d) => currentSelected.includes(d.data.name) ?"#F8F8F8" :"#F0F0F0")
            .attr("cursor", "pointer")
            .attr("opacity",(d) => currentSelected.includes(d.data.name) ? 1 : 0)
            .on("mouseover",(event, d) => {
                svg.selectAll<SVGRectElement,d3.HierarchyNode<HierarchyNode>>(".treeBackgroundRect")
                    .interrupt()
                    .transition()
                    .duration(100)
                    .attr("opacity",(b) => b.data.name === d.data.name ||  currentSelected.includes(d.data.name) ?1 : 0)
            })
            .on("mouseout",() => {
                svg.selectAll<SVGRectElement, d3.HierarchyNode<HierarchyNode>>(".treeBackgroundRect")
                    .attr("opacity",(d) => currentSelected.includes(d.data.name) ? 1 : 0)
                ;
            })
            .on("click", (event,d) => {
                if(d.depth === 1){
                    if(d.children) {
                        d.data._children = d.children;
                        d.children = undefined;
                    } else {
                        // @ts-expect-error standard d3 practice re-assigning children with tree
                        d.children = d.data._children;
                    }
                    reDrawTree(currentTreeData);
                } else {
                    updateCurrentSelected(d.data.name);
                }
            });

        treeGroup.select(".treeIcon")
            .attr("pointer-events", "none")
            .attr("fill", COLORS.darkblue)
            .attr("text-anchor", "middle")
            .style("font-size", (d) => `${(d.data.height || 0) * textHeightPercent}px`)
            .style("dominant-baseline","middle")
            .attr("x",  (d) => (d.data.height || 0)/2)
            .attr("y", (d) => (d.data.height || 0)/2)
            .text((d) => d.depth === 1 ?  (d.children ? ICONS["expanded"] :ICONS["collapsed"]) : "");

        treeGroup.select(".treeLabel")
            .attr("pointer-events", "none")
            .attr("fill", COLORS.black)
            .attr("text-anchor", "start")
            .attr("font-weight", (d) => d.data.name === searchStr ? "bold" : "normal")
            .style("font-size", (d) => `${(d.data.height || 0) * textHeightPercent}px`)
            .style("dominant-baseline","middle")
            .attr("x",  (d) => (d.data.height || 0)  + 5)
            .attr("y", (d) => (d.data.height || 0)/2)
            .text((d) => d.data.name);

        treeGroup.select(".treeResultCount")
            .attr("pointer-events", "none")
            .attr("fill", COLORS.midgrey)
            .attr("text-anchor", "end")
            .attr("font-weight", (d) => d.name === searchStr ? "bold" : "normal")
            .style("font-size", `${HIERARCHY_NODE_HEIGHT * textHeightPercent}px`)
            .style("dominant-baseline","middle")
            .attr("x", svgWidth - 10)
            .attr("y", HIERARCHY_NODE_HEIGHT/2)
            .text((d) => d.data._children?.length || "");

        treeGroup.select(".treeSelectedIcon")
            .attr("pointer-events", "none")
            .attr("fill", COLORS.midgreen)
            .attr("text-anchor", "end")
            .style("font-size", (d) => `${(d.data.height || 0) * textHeightPercent}px`)
            .style("dominant-baseline","middle")
            .attr("x",   svgWidth - 10)
            .attr("y", (d) => (d.data.height || 0)/2)
            .text((d) => currentSelected.includes(d.data.name) ? ICONS["tick"] : "");

    }
    reDrawTree(allTreeData);

}
