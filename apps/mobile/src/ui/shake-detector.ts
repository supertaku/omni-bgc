export type Acceleration = {x:number;y:number;z:number};
export type ShakeCalibration = {
  thresholdG:number; rawMagnitudeG:number; gravityTimeConstantMs:number;
  warmupMs:number; peakSpacingMs:number; maximumPeakGapMs:number;
  patternWindowMs:number; peaks:number; cooldownMs:number;
};
// Provisional deliberate-motion calibration; physical traces must validate these values.
export const DEFAULT_SHAKE_CALIBRATION:ShakeCalibration = {
  thresholdG:1.15,rawMagnitudeG:1.4,gravityTimeConstantMs:450,
  warmupMs:300,peakSpacingMs:90,maximumPeakGapMs:330,
  patternWindowMs:1100,peaks:4,cooldownMs:2500,
};

/** High-pass gravity removal, then four opposing peaks on a stable motion axis.
 * Time is supplied by the caller, in monotonic milliseconds. No location/data retention. */
export class ShakeDetector {
  private gravity:Acceleration|null=null;
  private previousTime:number|null=null;
  private startedAt=0;
  private lastPeak:Acceleration|null=null;
  private lastPeakAt=0;
  private firstPeakAt=0;
  private count=0;
  private cooldownUntil=0;
  readonly calibration:ShakeCalibration;
  constructor(options:Partial<ShakeCalibration>={}) {
    this.calibration={...DEFAULT_SHAKE_CALIBRATION,...options};
    if(Object.values(this.calibration).some(value=>!Number.isFinite(value)||value<=0)||
      !Number.isInteger(this.calibration.peaks)||this.calibration.peaks<3||
      this.calibration.maximumPeakGapMs<=this.calibration.peakSpacingMs)
      throw new Error('Invalid shake calibration');
  }
  // Keep the cooldown through foreground, blocking-state and subscription changes.
  reset():void {this.gravity=null;this.previousTime=null;this.lastPeak=null;this.count=0;}
  push(sample:Acceleration,timeMs:number):boolean {
    if(![sample.x,sample.y,sample.z,timeMs].every(Number.isFinite)){this.reset();return false;}
    if(this.previousTime===null||timeMs<=this.previousTime||timeMs-this.previousTime>400){
      this.gravity={...sample};this.previousTime=timeMs;this.startedAt=timeMs;this.lastPeak=null;this.count=0;return false;
    }
    const elapsed=timeMs-this.previousTime;this.previousTime=timeMs;
    const gravity=this.gravity!;
    const blend=1-Math.exp(-elapsed/this.calibration.gravityTimeConstantMs);
    gravity.x+=blend*(sample.x-gravity.x);gravity.y+=blend*(sample.y-gravity.y);gravity.z+=blend*(sample.z-gravity.z);
    const motion={x:sample.x-gravity.x,y:sample.y-gravity.y,z:sample.z-gravity.z};
    const magnitude=Math.hypot(motion.x,motion.y,motion.z);
    if(timeMs-this.startedAt<this.calibration.warmupMs||timeMs<this.cooldownUntil)return false;
    if(this.lastPeak&&(timeMs-this.lastPeakAt>this.calibration.maximumPeakGapMs||timeMs-this.firstPeakAt>this.calibration.patternWindowMs)){
      this.lastPeak=null;this.count=0;
    }
    if(magnitude<this.calibration.thresholdG||Math.hypot(sample.x,sample.y,sample.z)<this.calibration.rawMagnitudeG)return false;
    const direction={x:motion.x/magnitude,y:motion.y/magnitude,z:motion.z/magnitude};
    if(!this.lastPeak){this.lastPeak=direction;this.lastPeakAt=timeMs;this.firstPeakAt=timeMs;this.count=1;return false;}
    const alignment=direction.x*this.lastPeak.x+direction.y*this.lastPeak.y+direction.z*this.lastPeak.z;
    if(Math.abs(alignment)<.65||(alignment<=-.65&&timeMs-this.lastPeakAt<this.calibration.peakSpacingMs)){
      // A different axis or rapid vibration breaks the deliberate pattern.
      this.lastPeak=direction;this.lastPeakAt=timeMs;this.firstPeakAt=timeMs;this.count=1;return false;
    }
    if(alignment>-.65)return false;
    this.lastPeak=direction;this.lastPeakAt=timeMs;this.count++;
    if(this.count<this.calibration.peaks)return false;
    this.cooldownUntil=timeMs+this.calibration.cooldownMs;this.lastPeak=null;this.count=0;return true;
  }
}
