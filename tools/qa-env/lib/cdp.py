"""基于标准库的最小 CDP 客户端，沿用已验证的只读调试协议路径。"""
from __future__ import annotations
import base64, json, os, socket, struct, time, urllib.parse, urllib.request

def _recv_exact(sock, size):
    chunks=[]
    while size:
        block=sock.recv(size)
        if not block:raise EOFError('CDP websocket closed')
        chunks.append(block);size-=len(block)
    return b''.join(chunks)

def _send_frame(sock, payload, opcode=1):
    payload=payload.encode('utf-8') if isinstance(payload,str) else payload
    size=len(payload); head=bytes([0x80|opcode])
    if size<126: head+=bytes([0x80|size])
    elif size<65536: head+=bytes([0x80|126])+struct.pack('!H',size)
    else: head+=bytes([0x80|127])+struct.pack('!Q',size)
    mask=os.urandom(4)
    sock.sendall(head+mask+bytes(byte^mask[i%4] for i,byte in enumerate(payload)))

def _recv_frame(sock):
    first,second=_recv_exact(sock,2); opcode=first&0x0f; masked=bool(second&0x80); size=second&0x7f
    if size==126:size=struct.unpack('!H',_recv_exact(sock,2))[0]
    elif size==127:size=struct.unpack('!Q',_recv_exact(sock,8))[0]
    mask=_recv_exact(sock,4) if masked else b''; payload=_recv_exact(sock,size)
    if masked:payload=bytes(byte^mask[i%4] for i,byte in enumerate(payload))
    return opcode,payload

class Cdp:
    def __init__(self, websocket_url, timeout=8):
        parsed=urllib.parse.urlsplit(websocket_url)
        if parsed.scheme!='ws' or parsed.hostname not in ('127.0.0.1','localhost','::1'):
            raise ValueError('CDP websocket must be loopback')
        self.sock=socket.create_connection(('127.0.0.1',parsed.port),timeout=timeout)
        self.sock.settimeout(timeout)
        key=base64.b64encode(os.urandom(16)).decode('ascii')
        path=parsed.path+('?'+parsed.query if parsed.query else '')
        request=(f'GET {path} HTTP/1.1\r\nHost: {parsed.hostname}:{parsed.port}\r\nUpgrade: websocket\r\n'
                 f'Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n')
        self.sock.sendall(request.encode('ascii'))
        response=b''
        while b'\r\n\r\n' not in response:
            response+=self.sock.recv(4096)
            if len(response)>32768:raise RuntimeError('CDP websocket handshake too large')
        if b' 101 ' not in response.split(b'\r\n',1)[0]:raise RuntimeError('CDP websocket upgrade refused')
        self.sequence=0;self.events=[]

    @staticmethod
    def page_target(port, expected_url, timeout=8):
        deadline=time.monotonic()+timeout
        endpoint=f'http://127.0.0.1:{port}/json/list'
        last_error=None
        while time.monotonic()<deadline:
            try:
                with urllib.request.urlopen(endpoint,timeout=1) as reply: targets=json.load(reply)
                candidates=[target for target in targets if target.get('type')=='page' and expected_url in target.get('url','')]
                if candidates:return candidates[0]
            except Exception as exc:last_error=exc
            time.sleep(.2)
        raise TimeoutError(f'no owned page target matching configured run URL (last={type(last_error).__name__ if last_error else "none"})')

    def command(self, method, params=None, timeout=8):
        self.sequence+=1;identifier=self.sequence
        _send_frame(self.sock,json.dumps({'id':identifier,'method':method,'params':params or {}},separators=(',',':')))
        deadline=time.monotonic()+timeout
        while time.monotonic()<deadline:
            self.sock.settimeout(max(.1,deadline-time.monotonic()))
            opcode,payload=_recv_frame(self.sock)
            if opcode==9:_send_frame(self.sock,payload,opcode=10);continue
            if opcode in (8,10):continue
            message=json.loads(payload.decode('utf-8'))
            if 'method' in message:self.events.append(message);continue
            if message.get('id')==identifier:
                if 'error' in message:raise RuntimeError(f"CDP {method} failed: {message['error'].get('message','unknown error')}")
                return message.get('result',{})
        raise TimeoutError(f'CDP command timed out: {method}')

    def evaluate(self, expression, timeout=8):
        result=self.command('Runtime.evaluate',{'expression':expression,'returnByValue':True,'awaitPromise':True},timeout)
        if result.get('exceptionDetails'):raise RuntimeError('page evaluation failed')
        return result.get('result',{}).get('value')

    def screenshot(self, path):
        result=self.command('Page.captureScreenshot',{'format':'png','fromSurface':True})
        data=result.get('data')
        if not data:raise RuntimeError('CDP screenshot returned no data')
        import pathlib
        target=pathlib.Path(path);target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(base64.b64decode(data))

    def close(self):self.sock.close()
