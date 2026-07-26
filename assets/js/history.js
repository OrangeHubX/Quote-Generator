/* history.js — Undo / redo over the whole editable state.

   Rather than instrumenting every mutation site — there are well over a hundred,
   and any new control would silently miss out — this snapshots S after activity
   settles and diffs against the last committed snapshot. Nothing can be
   forgotten, and coalescing falls out for free: a slider drag fires a hundred
   input events but commits once, so it is one undo step. */
import {S} from './data.js';

/* Decoded images are not serialisable, and they are the one thing an undo should
   not throw away — restoring a snapshot leaves whatever is loaded in place. */
const SKIP={avatar:1,media:1};
const LIMIT=80;
const SETTLE=420;

let stack=[],idx=-1,timer=0,restoring=false,applyFn=null;

function snap(){
  const o={};
  for(const k in S)if(!SKIP[k])o[k]=S[k];
  return JSON.stringify(o);
}
function restore(json){
  const o=JSON.parse(json);
  for(const k in o){
    if(SKIP[k]||!(k in S))continue;
    const v=o[k];
    S[k]=(v&&typeof v==="object")?JSON.parse(JSON.stringify(v)):v;
  }
  restoring=true;
  try{if(applyFn)applyFn();}finally{
    /* the resync fires input/change events of its own; ignore them or the
       restored state would immediately be committed as a new step */
    clearTimeout(timer);
    setTimeout(()=>{restoring=false;},0);
  }
}
export function commit(){
  if(restoring)return;
  const s=snap();
  if(idx>=0&&stack[idx]===s)return;
  stack.splice(idx+1);
  stack.push(s);
  if(stack.length>LIMIT)stack.shift();
  idx=stack.length-1;
}
function bump(){
  if(restoring)return;
  clearTimeout(timer);
  timer=setTimeout(commit,SETTLE);
}
export function canUndo(){return idx>0;}
export function canRedo(){return idx>=0&&idx<stack.length-1;}
export function undo(){
  clearTimeout(timer);
  commit();                        /* fold in anything still pending */
  if(!canUndo())return false;
  idx--;restore(stack[idx]);return true;
}
export function redo(){
  clearTimeout(timer);
  if(!canRedo())return false;
  idx++;restore(stack[idx]);return true;
}
export function initHistory(apply){
  applyFn=apply;
  commit();                        /* the pristine load is step zero */
  /* capture phase, so a handler that stops propagation cannot hide a change */
  ["input","change","click","pointerup"].forEach(t=>
    document.addEventListener(t,bump,true));
}
