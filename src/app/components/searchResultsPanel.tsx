'use client';
import React, {useState} from 'react';
import {ChartData} from "@/types/data";
import NetworkMapChart from "@/app/components/NetworkMapChart";
import SearchResultsCriteriaChart from "@/app/components/SearchResultsCriteriaChart";
import ChainChartHeader from "@/app/components/ChainChartHeader";
import LegendChart from "@/app/components/LegendChart";
import {CHAIN_CIRCLE_RADIUS} from "@/app/components/ChainForceChart";

interface SearchResultsPanelProps {
    chartData: ChartData;
    searchNodes: string[];
    searchDirection: string;
    architectureId: number;
    mainContainerClass: string;
    chainContainerClass: string;
    removeFromSearchNodes: (currentSelection: string) => void;
}
const SearchResultsPanel = ({ chartData,searchNodes,searchDirection, architectureId , mainContainerClass, chainContainerClass, removeFromSearchNodes}: SearchResultsPanelProps) => {

    const [resultPanelHeight, setResultPanelHeight] = useState<number>(0);
    const legendData = {
        colors: ["input","intermediate","output","failedOutput","successfulLink"],
        icons: ["comp","all","any","suppression"]
    }
    const legendRowHeight = CHAIN_CIRCLE_RADIUS * 2.5;
    const legendHeight = legendRowHeight * 5.5;
    const ChartComponent = ()  => {
        const resultAreaHeight = Math.min(resultPanelHeight,65);
        if (searchNodes.length > 0) {
            return (
                <>
                <div style={{height: `${Math.min(resultPanelHeight,55)}px`, overflowY:"auto" }}
                     className={"top-0 left-[calc(55%+10px)] w-[calc(45%-20px)] searchResultsContainer absolute md:h-0 md:w-full md:top-[60px] md:left-0 "}>
                    <SearchResultsCriteriaChart
                        containerClass={"searchResultsContainer"}
                        currentSelected={searchNodes}
                        removeFromCurrentSelected={removeFromSearchNodes}
                        setResultPanelHeight={setResultPanelHeight}
                    />
                </div>
                <div style={{height: `calc(100% - ${resultAreaHeight + 40 + legendHeight}px)`,  top: `${60 + resultAreaHeight}px`, }} className={`${chainContainerClass}Container absolute w-full m:h-full `}>
                    <ChainChartHeader
                        containerClass={chainContainerClass}
                        mainContainerClass={mainContainerClass}
                        chartData={chartData}
                        searchNodes={searchNodes}
                        searchDirection={searchDirection}
                        architectureId={architectureId}
                        resultPanelHeight={resultPanelHeight}
                    />
                </div>
                </>)
        }

        return (<div className={`${chainContainerClass}Container absolute h-[calc(100%-20px)]  w-[calc(45%-20px)] top-[10px] left-[calc(55%+10px)] md:h-[50%] md:top-[calc(50%-30px)] md:w-[calc(100%-60px)] md:left-[30px] overflow-y-auto`}>
            <NetworkMapChart containerClass={chainContainerClass} mainContainerClass={mainContainerClass} chartData={chartData} architectureId={architectureId}></NetworkMapChart>
        </div>)


    }

    const hasSearchResults = searchNodes.length > 0;
    const currentArchitecture = chartData.architecture.find((f) => f.arch_id === architectureId);

    return (
        <div className={"fixed w-full h-[50%] top-[50%] md:h-full md:top-0 md:left-[50px] md:w-[35%]  bg-white shadow-lg"}>
            <h2 className={"fixed w-full  text-gray-700 text-lg left-[10px] md:left-[80px] top-[calc(50%+50px)] md:top-[65px]"}>
                {hasSearchResults ? "" : currentArchitecture ? `Architecture: ${currentArchitecture.arch_name}` : ""}
            </h2>
            <div style={{height: `${legendHeight}px)`}} className={`legendChartContainer fixed w-[calc(55%-40px)] left-[10px] top-[calc(50%+85px)]  md:w-[calc(35%-60px)]  text-gray-500 md:left-[80px] md:top-[110px]`}>
                {hasSearchResults ? "" : <LegendChart containerClass={"legendChart"} legendData={legendData} legendRowHeight={legendRowHeight}/>}
            </div>
            <ChartComponent></ChartComponent>
        </div>
    );
};

export default SearchResultsPanel;
