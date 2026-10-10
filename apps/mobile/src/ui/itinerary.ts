import type { Entrance, Origin, Place, RouteResult, SavedState } from '../contracts';
export type ItineraryLeg={fromId:string;toId:string;fromEntrance?:string;toEntrance?:string;result:RouteResult};
export function approvedEndpoint(place:Place|undefined):Entrance|undefined{
  return place?.status==='approved'?place.entrances.find(e=>e.eligible&&e.coordinate):undefined;
}
export async function calculateItineraryLegs(saved:SavedState,places:Place[],calculate:(origin:Origin,entrance:Entrance)=>Promise<RouteResult>):Promise<ItineraryLeg[]>{
  const legs:ItineraryLeg[]=[];
  for(let i=1;i<saved.itinerary.length;i++){
    const fromId=saved.itinerary[i-1].placeId,toId=saved.itinerary[i].placeId;
    const from=approvedEndpoint(places.find(p=>p.id===fromId)),to=approvedEndpoint(places.find(p=>p.id===toId));
    let result:RouteResult={available:false,reason:'One or both stops lack an approved eligible entrance. No centroid or straight-line route is used.'};
    if(from?.coordinate&&to?.coordinate){
      try{result=await calculate({coordinate:from.coordinate,method:'landmark',confirmed:true},to);if(result.available&&(!Number.isFinite(result.lengthM)||result.lengthM<0||result.coordinates.length<2))result={available:false,reason:'The route result failed geometry or distance validation.'};}
      catch{result={available:false,reason:'The local graph could not calculate this walking leg.'};}
    }
    legs.push({fromId,toId,fromEntrance:from?.label,toEntrance:to?.label,result});
  }
  return legs;
}
export function itineraryTotals(saved:SavedState,legs:ItineraryLeg[]):{metres:number;visitMinutes:number}|null{
  if(saved.itinerary.length<2||legs.length!==saved.itinerary.length-1||legs.some((l,i)=>l.fromId!==saved.itinerary[i].placeId||l.toId!==saved.itinerary[i+1].placeId||!l.result.available||(l.result.available&&(!Number.isFinite(l.result.lengthM)||l.result.lengthM<0)))||saved.itinerary.some(s=>!Number.isInteger(s.durationMinutes)||s.durationMinutes<0||s.durationMinutes>1440))return null;
  return {metres:legs.reduce((n,l)=>n+(l.result.available?l.result.lengthM:0),0),visitMinutes:saved.itinerary.reduce((n,s)=>n+s.durationMinutes,0)};
}
