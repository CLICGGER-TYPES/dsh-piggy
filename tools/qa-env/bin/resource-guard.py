#!/usr/bin/env python3
"""受租约约束的虚拟机内存守卫，只监视并按当前根租约停止目标虚拟机。"""
from __future__ import annotations
import argparse, json, os, signal, subprocess, sys, time
from datetime import datetime, timezone
from pathlib import Path

START_GIB, SOFT_GIB, CRITICAL_GIB, SAMPLE_SECONDS = 16, 13, 12, 3

def now(): return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
def available_gib():
    return next(int(line.split()[1]) / 1048576 for line in Path('/proc/meminfo').read_text().splitlines() if line.startswith('MemAvailable:'))
def atomic_json(path, value):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_name(path.name+'.guard.tmp')
    temp.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    os.chmod(temp,0o600);temp.replace(path)

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--lease-file',required=True)
    ap.add_argument('--status-root',required=True)
    ap.add_argument('--expected-task',required=True)
    ap.add_argument('--expected-actor',required=True)
    ap.add_argument('--expected-uuid',required=True)
    ap.add_argument('--expected-uri',required=True)
    args=ap.parse_args()
    root=Path(args.status_root).resolve();lease_path=Path(args.lease_file).resolve()
    lease=json.loads(lease_path.read_text(encoding='utf-8'))
    lease_id=lease.get('leaseId')
    if not lease_id or lease.get('task')!=args.expected_task or lease.get('actor')!=args.expected_actor or lease.get('uuid')!=args.expected_uuid or lease.get('uri')!=args.expected_uri or lease.get('initialState')!='shut off' or lease.get('ownershipReservedByDispatcher') is not True:
        raise RuntimeError('root lease identity/ownership reservation does not match the supplied expectation')
    root.mkdir(parents=True,exist_ok=True)
    state_path=root/'native-resource-guard.json';finish_path=root/'finish-requested.json';stop_path=root/'stop-requested.json';samples_path=root/'native-memory-samples.jsonl'
    if any(p.exists() for p in (state_path,finish_path,stop_path,samples_path)):
        raise RuntimeError('guard output already exists; refusing to overwrite prior evidence')
    interrupted=[False]
    for signum in (signal.SIGTERM,signal.SIGINT):signal.signal(signum,lambda *_:interrupted.__setitem__(0,True))
    def virsh(*parts):return subprocess.run(['virsh','-c',args.expected_uri,*parts],capture_output=True,text=True,timeout=10)
    def owns():
        try:
            current=json.loads(lease_path.read_text(encoding='utf-8'))
            return current.get('leaseId')==lease_id and current.get('task')==args.expected_task and current.get('actor')==args.expected_actor and current.get('uuid')==args.expected_uuid and current.get('uri')==args.expected_uri and current.get('ownershipReservedByDispatcher') is True and current.get('initialState')=='shut off'
        except (OSError,ValueError):return False
    def guest_state():
        result=virsh('domstate',args.expected_uuid)
        return result.stdout.strip() if result.returncode==0 else 'unknown'
    before=available_gib()
    state={'at':now(),'task':args.expected_task,'actor':args.expected_actor,'leaseId':lease_id,
           'guardPid':os.getpid(),'status':'starting','beforeAvailableGiB':round(before,3),
           'minimumObservedAvailableGiB':round(before,3),'requiredStartAvailableGiB':START_GIB,
           'softStopAvailableGiB':SOFT_GIB,'reserveTargetGiB':CRITICAL_GIB,'sampleSeconds':SAMPLE_SECONDS,
           'guest':{'uuid':args.expected_uuid,'uri':args.expected_uri},'modelCredentialsRead':False}
    atomic_json(state_path,state)
    if before<START_GIB or guest_state()!='shut off':
        state.update(status='startup-precondition-failed',finishedAt=now());atomic_json(state_path,state);return 75
    others=virsh('list','--uuid')
    if others.returncode or others.stdout.strip():
        state.update(status='startup-other-guest-running',finishedAt=now());atomic_json(state_path,state);return 75
    state.update(status='watching',startedAt=now());atomic_json(state_path,state)
    def shutdown_owned(emergency=False):
        if not owns():
            state['shutdown']={'at':now(),'skipped':'lease changed'};return False
        current=guest_state()
        if current=='shut off':
            state['shutdown']={'at':now(),'confirmedOff':True,'alreadyOff':True};return True
        if current=='unknown':
            state['shutdown']={'at':now(),'confirmedOff':False,'error':'guest state unknown'};return False
        result=virsh('shutdown',args.expected_uuid)
        state['shutdown']={'at':now(),'requested':True,'exitCode':result.returncode};atomic_json(state_path,state)
        deadline=time.monotonic()+(3 if emergency and available_gib()<CRITICAL_GIB else 25)
        while time.monotonic()<deadline:
            if guest_state()=='shut off':state['shutdown'].update(confirmedOff=True,confirmedAt=now());return True
            if emergency and available_gib()<CRITICAL_GIB:break
            time.sleep(2)
        if emergency and owns():
            result=virsh('destroy',args.expected_uuid);state['shutdown'].update(emergencyDestroyExit=result.returncode,emergencyDestroyAt=now())
        state['shutdown']['confirmedOff']=guest_state()=='shut off';return state['shutdown']['confirmedOff']
    low_samples=0;outcome='completed'
    try:
        with samples_path.open('x',encoding='utf-8') as samples:
            os.chmod(samples_path,0o600)
            while True:
                if not owns():outcome='lease-changed';break
                free=available_gib();state['minimumObservedAvailableGiB']=min(state['minimumObservedAvailableGiB'],round(free,3))
                state.update(lastSampleAt=now(),lastAvailableGiB=round(free,3),guestState=guest_state())
                samples.write(json.dumps({'at':now(),'availableGiB':round(free,3),'guestState':state['guestState']})+'\n');samples.flush()
                low_samples=low_samples+1 if free<SOFT_GIB else 0
                if free<CRITICAL_GIB or low_samples>=2:
                    outcome='stopped-memory-pressure';atomic_json(stop_path,{'at':now(),'reason':outcome,'availableGiB':round(free,3),'leaseId':lease_id})
                    state.update(status=outcome,stopAt=now());atomic_json(state_path,state);shutdown_owned(emergency=True);break
                if interrupted[0] or finish_path.exists() or stop_path.exists():
                    outcome='stopped-requested' if interrupted[0] or stop_path.exists() else 'completed';shutdown_owned(emergency=False);break
                progress_path=root/'progress.json'
                if progress_path.exists():
                    progress_age=time.time()-progress_path.stat().st_mtime
                    state['progressAgeSeconds']=round(progress_age,1)
                    state['progressStale']=progress_age>300
                atomic_json(state_path,state);time.sleep(SAMPLE_SECONDS)
    except BaseException as error:
        outcome='watcher-error';state['errorType']=type(error).__name__
        atomic_json(stop_path,{'at':now(),'reason':outcome,'leaseId':lease_id});shutdown_owned(emergency=False);raise
    finally:
        state.update(status=outcome,finishedAt=now(),afterAvailableGiB=round(available_gib(),3));atomic_json(state_path,state)
        if owns():
            current=json.loads(lease_path.read_text(encoding='utf-8'))
            current.update(guardFinalStatus=outcome,finalGuestState=guest_state(),guardFinishedAt=now())
            if current['finalGuestState']=='shut off':current.update(status='cleaned',cleanedAt=now(),bootAllowed=False)
            atomic_json(lease_path,current)
    return 0 if outcome=='completed' else 75

if __name__=='__main__':
    try:raise SystemExit(main())
    except Exception as error:
        print(f"guard failed: {type(error).__name__}; detail omitted to avoid leaking lease data",file=sys.stderr)
        raise SystemExit(2)
