import { useState } from 'react';
import { View } from 'react-native';
import { Action, Body, Heading, Notice, ui } from './components';

/** Isolated UI exercise. No coordinates, graph installation, GPS or map overlays. */
export function RouteWorkflowPreview(){
  const [step,setStep]=useState(0),[origin,setOrigin]=useState<'current'|'manual'|null>(null);
  const steps=['Destination','Origin','Confirm origin','Arrival entrance','Route preview','Written steps','Finished'];
  return <View style={ui.stack}>
    <Notice>Navigation UI preview only. These fictional labels have no geographic location. This is not a real walking route or live guidance.</Notice>
    <Body muted>Step {step+1} of {steps.length}</Body><Heading>{steps[step]}</Heading>
    {step===0?<><Body>Destination: Sample gallery</Body><Action primary label="Directions to sample gallery" onPress={()=>setStep(1)}/></>:null}
    {step===1?<><Body>Choose how you would set your starting point.</Body><Action label="Preview current location choice" onPress={()=>{setOrigin('current');setStep(2);}}/><Action label="Preview manual map choice" onPress={()=>{setOrigin('manual');setStep(2);}}/></>:null}
    {step===2?<><Body>{origin==='current'?'A real request would ask permission, obtain a fresh fix and disclose accuracy. No device location is requested in this preview.':'A real manual request lets you select and confirm a map point. No real point is chosen here.'}</Body><Action primary label="Confirm sample starting point" onPress={()=>setStep(3)}/><Action label="Change sample origin" onPress={()=>setStep(1)}/></>:null}
    {step===3?<><Body>Sample public entrance</Body><Body muted>A real arrival requires a reviewed public entrance connected to the walking graph. A business pin alone cannot qualify.</Body><Action primary label="Preview sample route" onPress={()=>setStep(4)}/></>:null}
    {step===4?<><Body>Sample starting point → sample gallery</Body><Body muted>Written steps are placeholders for this interface exercise. No distance or travel time is presented.</Body><Action primary label="Open sample written steps" onPress={()=>setStep(5)}/></>:null}
    {step===5?<><Body>1. Review the starting point.</Body><Body>2. Follow graph-backed steps when a real route is available.</Body><Body>3. Arrive at the reviewed public entrance.</Body><Notice>No real walking instruction is provided here.</Notice><Action primary label="End sample walkthrough" onPress={()=>setStep(6)}/></>:null}
    {step===6?<><Body>Preview complete. Real directions remain gated by origin quality, reviewed entrances and graph connectivity.</Body><Action primary label="Restart preview" onPress={()=>{setOrigin(null);setStep(0);}}/></>:null}
    {step>0&&step<6?<Action label="Previous preview step" onPress={()=>setStep(value=>value-1)}/>:null}
  </View>;
}
