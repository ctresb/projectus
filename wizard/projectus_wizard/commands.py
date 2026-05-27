from __future__ import annotations

import asyncio
import os
from collections.abc import Awaitable, Callable
from pathlib import Path

LogFn = Callable[[str], Awaitable[None]]


class CommandError(RuntimeError):
    def __init__(self, args: list[str], code: int) -> None:
        super().__init__(f"comando falhou ({code}): {' '.join(args)}")
        self.args_list = args
        self.code = code


async def run_command(
    args: list[str],
    *,
    cwd: Path,
    log: LogFn,
    check: bool = True,
    env: dict[str, str] | None = None,
) -> int:
    await log(f"$ {' '.join(args)}")
    process = await asyncio.create_subprocess_exec(
        *args,
        cwd=str(cwd),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
        env={**os.environ, **(env or {})},
    )
    assert process.stdout is not None
    while True:
        line = await process.stdout.readline()
        if not line:
            break
        await log(line.decode("utf-8", errors="replace").rstrip())
    code = await process.wait()
    if code == 0:
        await log("OK")
    elif check:
        await log(f"ERR / comando encerrou com codigo {code}")
        raise CommandError(args, code)
    else:
        await log(f"WARN / comando encerrou com codigo {code}")
    return code

