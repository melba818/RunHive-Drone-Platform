"""Bind loopback and the explicitly configured Docker bridge, never all interfaces."""
import asyncio
import ipaddress
import os
import socket
import uvicorn


async def main():
    sockets = []
    addresses = os.environ.get("LLM_BIND_ADDRESSES", "127.0.0.1").split(",")
    port = int(os.environ.get("LLM_GATEWAY_PORT", "4020"))
    for address in addresses:
        address = address.strip()
        ip = ipaddress.ip_address(address)
        if not (ip.is_loopback or ip.is_private) or ip.is_unspecified:
            raise RuntimeError("大模型中心只允许绑定指定的本机或私有网桥地址")
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind((address, port))
        sock.listen(2048)
        sock.setblocking(False)
        sockets.append(sock)
    # Access logs would expose a one-time launch ticket; nginx must redact this route too.
    config = uvicorn.Config("app:app", host=None, port=port, access_log=False, proxy_headers=False)
    try:
        await uvicorn.Server(config).serve(sockets=sockets)
    finally:
        for sock in sockets:
            sock.close()


if __name__ == "__main__":
    asyncio.run(main())
