import { projectRecords, diffRecords, recordKey } from './records.js';
/** Serial writer: diff by resource + server revisions. Never silently overwrites conflicts. */
export class StateWriter {
  constructor(send){this.send=send;this.reset();}
  reset(){this.baseline=new Map();this.revisions=new Map();this.latest=null;this.running=null;this.clinical=false;this.epoch=(this.epoch||0)+1;}
  seed(data,revisions,clinical){this.reset();this.clinical=clinical;this.baseline=projectRecords(data,clinical);this.revisions=new Map((revisions||[]).map(r=>[recordKey(r.kind,r.id),r.revision]));}
  save(data){this.latest=projectRecords(data,this.clinical);if(this.running)return this.running;
    const epoch=this.epoch;
    this.running=(async()=>{
      while(this.latest && this.epoch===epoch){
        const next=this.latest;this.latest=null;const changes=diffRecords(this.baseline,next,this.revisions);
        for(let i=0;i<changes.length;i+=200){
          const batch=changes.slice(i,i+200);const result=await this.send(batch);
          if(this.epoch!==epoch)return;
          for(const change of batch){const k=recordKey(change.kind,change.id);if(change.deleted)this.baseline.delete(k);else this.baseline.set(k,{kind:change.kind,id:change.id,payload:change.payload});}
          for(const rev of result||[])this.revisions.set(recordKey(rev.kind,rev.id),rev.revision);
        }
      }
    })().finally(()=>{if(this.epoch===epoch)this.running=null;});
    return this.running;
  }
}
