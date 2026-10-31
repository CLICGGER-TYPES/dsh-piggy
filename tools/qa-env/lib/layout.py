"""统一派生运行 ID、路径、显示/端口范围和 Unix 套接字长度预算。"""
from __future__ import annotations
import hashlib, re
from pathlib import Path

SOCKET_SUFFIX='/scoped_dir.'+('X'*32)+'/SingletonSocket'
AF_UNIX_LIMIT=107

def derive_layout(config, label):
    if label not in ('a','b'):raise ValueError('run label must be a or b')
    batch=config['task']['runBatchId']
    if not re.fullmatch(r'[A-Za-z0-9-]{3,20}',batch) or 'REPLACE' in batch.upper():
        raise ValueError('task.runBatchId must be short, unique and filled in')
    task=config['task']['taskId'].lower()
    run_id=f'{task}-{batch}-{label}'
    short_id='q'+hashlib.sha256(run_id.encode()).hexdigest()[:6]
    guest_root=Path(config['guest']['taskRoot'])
    native_parent=Path(config['guest']['nativeShortRootParent'])
    snap_parent=Path(config['guest']['snapShortRootParent'])
    run_root=guest_root/'runs'/run_id
    native_short=native_parent/short_id
    snap_root=snap_parent/short_id
    layout={
        'label':label,'runId':run_id,'shortId':short_id,
        'guestRunRoot':str(run_root),'evidenceRoot':str(run_root/'out'),
        'nativeUserData':str(run_root/'native'/'userdata'),
        'nativeXauthority':str(run_root/'display'/'Xauthority'),
        'nativeXdgConfig':str(run_root/'native'/'config'),'nativeXdgCache':str(run_root/'native'/'cache'),
        'nativeShortRoot':str(native_short),'nativeTmpDir':str(native_short/'n'),
        'nativeXdgRuntimeDir':str(native_short/'x'),'nativeCacheDir':str(native_short/'r'),
        'electronFixtureRoot':str(run_root/'fixture'/'electron'),
        'electron44RuntimeRoot':str(run_root/'fixture'/'electron-runtime'),
        'electronFixtureUserData':str(run_root/'fixture'/'electron-userdata'),
        'sampleInputNative':str(run_root/'inputs'/'selection-sample.txt'),
        'snapRunRoot':str(snap_root),'chromiumProfile':str(snap_root/'p'),
        'chromiumFixture':str(snap_root/'p'/'fixture'/'basic.html'),
        'sampleInputSnap':str(snap_root/'p'/'input'/'selection-sample.txt'),
        'chromiumXauthority':str(snap_root/'x'/'Xauthority'),
        'chromiumTmpDir':str(snap_root/'t'),'chromiumXdgRuntimeDir':str(snap_root/'r'),
        'runtimeCacheRoot':str(guest_root/'cache'/'electron44'),
        'dependencyCacheRoot':str(guest_root/'cache'/'toolchain'),
        'm1AppImageCache':str(guest_root/'cache'/'M1FINAL.AppImage'),
        'sourceCacheRoot':str(guest_root/'cache'/'source-3585'),
        'displayAllocation':{'base':config['guest']['displayBase'],'count':config['guest']['displayCount'],'selectedAtRunStart':True},
        'portAllocation':{'base':config['guest']['portBase'],'count':config['guest']['portCount'],'selectedAtRunStart':True},
    }
    for key in ('nativeTmpDir','nativeXdgRuntimeDir','chromiumTmpDir','chromiumXdgRuntimeDir'):
        budget=len(layout[key].encode())+len(SOCKET_SUFFIX.encode())
        layout.setdefault('socketBudgetBytes',{})[key]=budget
        if budget>AF_UNIX_LIMIT:raise ValueError(f'{key} AF_UNIX socket budget {budget}>{AF_UNIX_LIMIT}')
    return layout

def derive_batch(config):return [derive_layout(config,'a'),derive_layout(config,'b')]
