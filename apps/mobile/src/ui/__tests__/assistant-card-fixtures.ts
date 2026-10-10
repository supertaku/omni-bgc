// Compile-time fixtures only. Not imported by App or any production screen.
// No geographic coordinates, business/menu facts or operational AI conversation.
import type { Place, RouteResult, SavedState } from '../../contracts';
export const placeCardFixture:Place={id:'fixture-only-place-card',name:'Fixture-only presentation card',category:'Fixture category',coordinate:null,aliases:[],entrances:[],citations:[],status:'candidate',menus:[]};
export const unavailableRouteCardFixture:RouteResult={available:false,reason:'Fixture only: no validated graph.'};
export const itineraryCardFixture:SavedState={placeIds:[],itinerary:[],startTime:null};
