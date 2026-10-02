import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const overlay = '../src/components/VoicePrayerOverlay.js';
const engine = '../src/components/prayer-recorder/usePrayerRecorder.js';
function callback(file, name, endMarker, context) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const start = source.indexOf(`  const ${name} =`);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start);
  return vm.runInNewContext(`${source.slice(start, end)}\n${name}`, {useCallback:fn=>fn,...context});
}
const ref = current => ({current});

test('overlay rerecord always acquires a fresh stream, even if the old track says live', async()=>{
  let acquired = 0;
  const restart = callback(overlay,'restartRec','  // ── Cancel',{
    voiceBusy:false,stopWaveAndRecog(){},clearTimers(){},stopRecorderAndWait:async()=>{},
    mountedRef:ref(true),recordingRunRef:ref(1),pvAudioRef:ref(null),setPvPlaying(){},
    mediaStreamRef:ref({getAudioTracks:()=>[{readyState:'live',muted:true}]}),
    askMic:async()=>{acquired++},runCountdown(){throw new Error('Must reacquire first')},setPhase(){},
  });
  await restart(); assert.equal(acquired,1);
});

test('closing waveform releases its context and aborts recognition',()=>{
  let closed=0,aborted=0;
  const contextRef=ref({close:async()=>{closed++}});
  const recognitionRef=ref({abort(){aborted++}});
  const stop=callback(overlay,'stopWaveAndRecog','  const stopRecorder =',{
    rafRef:ref(1),cancelAnimationFrame(){},audioCtxRef:contextRef,
    setWaveLive(){},meterFillRef:ref(null),recogRef:recognitionRef,
  });
  stop();stop();assert.equal(closed,1);assert.equal(aborted,1);
  assert.equal(contextRef.current,null);assert.equal(recognitionRef.current,null);
});

test('permission resolved after closing the overlay stops the late stream',async()=>{
  let resolvePermission;
  let stopped=0,countdowns=0;
  const mounted=ref(true);
  const streamRef=ref(null);
  const ask=callback(overlay,'askMic','  // ── Restart',{
    requestingMicRef:ref(false),permissionRunRef:ref(0),mountedRef:mounted,
    releaseMic(){},setPhase(){},runCountdown(){countdowns++},mediaStreamRef:streamRef,
    MIC_CONSTRAINTS:{audio:true},navigator:{mediaDevices:{getUserMedia:()=>new Promise(resolve=>{resolvePermission=resolve})}},
  });
  const pending=ask();mounted.current=false;
  resolvePermission({getTracks:()=>[{stop(){stopped++}}]});await pending;
  assert.equal(stopped,1);assert.equal(countdowns,0);assert.equal(streamRef.current,null);
});

test('overlay releases microphone before decoding a finished recording',async()=>{
  let released=false;
  const recording=ref({blob:new Blob(['audio']),segments:[],transcript:'',url:'blob:preview'});
  const phases=[];
  const finish=callback(overlay,'finishRec','  // ── Start recording',{
    REC_MIN:3,isFinishingRef:ref(false),recSecRef:ref(5),recordingRunRef:ref(1),mountedRef:ref(true),
    stopWaveAndRecog(){},clearTimers(){},setPhase:p=>phases.push(p),showToast(){},
    stopRecorderAndWait:async()=>{},releaseMic:()=>{released=true},recRef:recording,
    chunksRef:ref([]),mediaRecorderRef:ref(null),setPreviewUrl(){},
    analyzeRecording:async()=>{assert.equal(released,true);return {peak:0.2,durationSeconds:5}},
    judgeRecording:()=>({ok:true,durationSeconds:5}),interimTranscriptRef:ref(''),
    setVcDur(){},setVcTx(){},setVcHint(){},captionsOnRef:ref(false),
    failRecording:()=>assert.fail('should not discard sound'),failMessageFor(){},FAIL_MESSAGES:{empty:'empty'},
  });
  await finish(false);assert.equal(recording.current.verified,true);assert.equal(phases.at(-1),'vconfirm');
});

test('shared recorder releases old capture before requesting permission again',async()=>{
  const order=[];
  const request=callback(engine,'requestPermission','  const finishRecording =',{
    requestingPermissionRef:ref(false),hasRecordingSupport:()=>true,
    clearAllTimers(){},stopLevelMeter(){},releaseStream:()=>order.push('released'),
    runIdRef:ref(1),permissionRunRef:ref(0),mountedRef:ref(true),setPhase(){},
    MIC_CONSTRAINTS:{},mediaStreamRef:ref(null),beginCountdown:()=>order.push('countdown'),
    navigator:{mediaDevices:{getUserMedia:async()=>{order.push('acquired');return {getTracks:()=>[]}}}},
  });
  await request();assert.deepEqual(order,['released','acquired','countdown']);
});

test('shared recorder releases microphone on silent recording failure',async()=>{
  let released=0;
  const phases=[];
  const finish=callback(engine,'finishRecording','  finishRecordingRef.current',{
    isRecordingTooShort:()=>false,elapsedSeconds:5,clearAllTimers(){},stopLevelMeter(){},
    runIdRef:ref(1),mountedRef:ref(true),stopRecorderAndWait:async()=>new Blob(['audio']),
    releaseStream:()=>{released++},analyzeRecording:async()=>({peak:0,durationSeconds:5}),
    isSilentRecording:()=>true,setErrorReason(){},setPhase:p=>phases.push(p),
    revokePreviewUrl(){},setTransientMessage(){},setPreviewUrl(){},urlRef:ref(''),blobRef:ref(null),
  });
  await finish();assert.ok(released>=1);assert.equal(phases.at(-1),'error');
});
