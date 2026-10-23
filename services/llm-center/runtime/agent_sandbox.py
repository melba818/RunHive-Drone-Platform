"""Fail-closed Linux Landlock launcher for native agent tool subprocesses.

No namespace privileges, Docker socket, model key or native server token enters a tool.
The server is responsible for passing its trusted agent directory and session roots.
"""
from __future__ import annotations
import argparse
import ctypes
import errno
import os
import pathlib
import resource
import sys

EXECUTE=1; WRITE=2; READ=4; READ_DIR=8
REMOVE_DIR=16; REMOVE_FILE=32; MAKE_CHAR=64; MAKE_DIR=128
MAKE_REG=256; MAKE_SOCK=512; MAKE_FIFO=1024; MAKE_BLOCK=2048; MAKE_SYM=4096
REFER=8192; TRUNCATE=16384
READ_BITS=EXECUTE|READ|READ_DIR
ALL_BITS=(1<<15)-1

class Ruleset(ctypes.Structure):
    _fields_=[('handled_access_fs',ctypes.c_uint64)]
class Beneath(ctypes.Structure):
    _pack_=1
    _fields_=[('allowed_access',ctypes.c_uint64),('parent_fd',ctypes.c_int32)]

def launch(argv,workspace,scratchpad,agent_dir,read_only=False):
    if sys.platform!='linux' or os.uname().machine not in {'x86_64','aarch64'}:
        raise RuntimeError('当前执行环境不支持安全工具沙箱。')
    lib=ctypes.CDLL(None,use_errno=True)
    lib.syscall.restype=ctypes.c_long
    abi=lib.syscall(444,ctypes.c_void_p(0),0,1)
    if abi<1 or os.getenv('LLM_SANDBOX_FORCE_UNAVAILABLE')=='1':
        raise RuntimeError('内核未启用 Landlock，工具任务已阻止。')
    handled=ALL_BITS if abi>=3 else ((1<<14)-1 if abi>=2 else (1<<13)-1)
    rules=Ruleset(handled)
    fd=lib.syscall(444,ctypes.byref(rules),ctypes.sizeof(rules),0)
    if fd<0: raise OSError(ctypes.get_errno(),'无法创建工具沙箱。')
    def allow(value,bits):
        path=pathlib.Path(value)
        if not path.exists(): return
        real=path.resolve(strict=True)
        mask=bits&handled
        if not real.is_dir(): mask &= EXECUTE|READ|WRITE|TRUNCATE
        pfd=os.open(real,os.O_PATH|os.O_CLOEXEC)
        try:
            rule=Beneath(mask,pfd)
            if lib.syscall(445,fd,1,ctypes.byref(rule),0)<0:
                raise OSError(ctypes.get_errno(),'无法设置工具目录权限。')
        finally: os.close(pfd)
    workspace=pathlib.Path(workspace).resolve(strict=True)
    if not workspace.is_relative_to(pathlib.Path('/workspace')):
        raise RuntimeError('工具工作目录必须位于本账号工作空间。')
    allow(workspace,READ_BITS if read_only else ALL_BITS)
    for value in ['/usr','/bin','/sbin','/lib','/lib64','/opt/penguin','/opt/runtime','/etc/ssl','/etc/resolv.conf','/etc/hosts','/etc/nsswitch.conf','/etc/localtime']:
        allow(value,READ_BITS)
    for value in ['/dev/null','/dev/zero','/dev/random','/dev/urandom','/dev/tty','/dev/pts','/tmp']:
        allow(value,ALL_BITS)
    if agent_dir:
        agent=pathlib.Path(agent_dir).resolve(strict=True)
        parts=agent.parts
        if len(parts)!=5 or parts[1]!='data' or parts[3]!='agents':
            raise RuntimeError('智能体目录无效。')
        for name in ['skills','plugins','hooks','memory','agent_state/skills','agent_state/hooks']:
            child=agent/name
            if child.exists() and not child.resolve().is_relative_to(agent):
                raise RuntimeError('智能体辅助目录链接超出允许范围。')
            allow(child,ALL_BITS if name=='memory' and not read_only else READ_BITS)
        if scratchpad:
            scratch=pathlib.Path(scratchpad)
            scratch.mkdir(parents=True,exist_ok=True)
            scratch=scratch.resolve(strict=True)
            if not scratch.is_relative_to(agent/'scratchpad'):
                raise RuntimeError('任务临时目录无效。')
            allow(scratch,ALL_BITS)
    elif scratchpad:
        raise RuntimeError('缺少智能体目录，任务已阻止。')
    if lib.prctl(38,1,0,0,0)!=0:
        raise OSError(ctypes.get_errno(),'无法限制工具进程权限。')
    if lib.syscall(446,fd,0)<0:
        raise OSError(ctypes.get_errno(),'无法应用工具沙箱。')
    os.close(fd)
    # Applied last: neither an MCP config nor a user's vault can restore server credentials.
    env={k:v for k,v in os.environ.items() if not k.upper().startswith(('PENGUIN_','LLM_'))}
    env['HOME']=str(workspace); env['TMPDIR']='/tmp'
    resource.setrlimit(resource.RLIMIT_CORE,(0,0))
    resource.setrlimit(resource.RLIMIT_FSIZE,(64*1024**2,64*1024**2))
    resource.setrlimit(resource.RLIMIT_NOFILE,(256,256))
    os.execvpe(argv[0],argv,env)

if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--workspace',required=True)
    p.add_argument('--scratchpad')
    p.add_argument('--agent-dir')
    p.add_argument('--read-only',action='store_true')
    p.add_argument('argv',nargs=argparse.REMAINDER)
    a=p.parse_args()
    argv=a.argv[1:] if a.argv[:1]==['--'] else a.argv
    try:
        if not argv: raise RuntimeError('工具命令为空。')
        launch(argv,a.workspace,a.scratchpad,a.agent_dir,a.read_only)
    except Exception as e:
        print('工具沙箱拒绝执行：'+str(e),file=sys.stderr)
        sys.exit(126)
