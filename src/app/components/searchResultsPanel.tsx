import React from 'react';
import ChainForceChart from "@/app/components/ChainForceChart";
import {ChartData} from "@/types/data";
import NetworkMapChart from "@/app/components/NetworkMapChart";

interface SearchResultsPanelProps {
    chartData: ChartData;
    searchNodes: string[];
    searchDirection: string;
    architectureId: number;
    mainContainerClass: string;
    chainContainerClass: string;
}
const SearchResultsPanel = ({ chartData,searchNodes,searchDirection, architectureId , mainContainerClass, chainContainerClass}: SearchResultsPanelProps) => {

    const ChartComponent = ()  => {

        if (searchNodes.length > 0) {
            return (
                <>
                <div className={"absolute w-full h-60px top-[60px] bg-pink-300"}>search criteria</div>
                <div  style={{width:"100%", height:"calc(100vh - 95px)", overflow: "auto"}} className={`${chainContainerClass}Container absolute   top-[90px]`}>
                     <ChainForceChart  mainContainerClass={mainContainerClass} containerClass={chainContainerClass} chartData={chartData} searchNodes={searchNodes} searchDirection={searchDirection} architectureId={architectureId}/>
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
            <h2 className={"fixed w-full  text-gray-700 text-lg left-[10px] md:left-[80px] top-[calc(50%+50px)] md:top-[65px]"}>{hasSearchResults ? "" : currentArchitecture ? `Architecture: ${currentArchitecture.arch_name}` : ""}</h2>
            <h2 className={"fixed w-[calc(55%-40px)] left-[10px] top-[calc(50%+75px)]   md:w-[calc(35%-60px)]  text-gray-500 md:left-[80px] md:top-[100px]"}>{hasSearchResults ? "" : "Space here for an introduction to the app - a legend and some info on how to access the help info and/or change architectures?"}</h2>
            <ChartComponent></ChartComponent>
        </div>
    );
};

export default SearchResultsPanel;
