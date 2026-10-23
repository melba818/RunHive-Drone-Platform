import os,socket
import uvicorn
port=int(os.getenv('PLATFORM_PORT','4022'));sockets=[]
for address in os.getenv('PLATFORM_BIND_ADDRESSES','127.0.0.1,172.17.0.1').split(','):
    sock=socket.socket();sock.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1);sock.bind((address.strip(),port));sock.listen(128);sockets.append(sock)
uvicorn.Server(uvicorn.Config('platform_mcp:app',log_level='warning',access_log=False)).run(sockets=sockets)
