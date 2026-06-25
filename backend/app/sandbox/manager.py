"""Sandbox manager — supports Docker and local modes.

- Docker mode: each session gets a separate container (production)
- Local mode: uses local subprocess and workspace directory (dev, no Docker needed)
"""
import asyncio
import os
import subprocess
import uuid

from app.config import settings


# ---- Result type ----
class SandboxResult:
    exit_code: int
    stdout: str
    stderr: str

    def __init__(self, exit_code: int, stdout: str, stderr: str):
        self.exit_code = exit_code
        self.stdout = stdout[: settings.agent_max_output_length]
        self.stderr = stderr[: settings.agent_max_output_length]

    @property
    def text(self) -> str:
        parts = []
        if self.stdout:
            parts.append(self.stdout)
        if self.stderr:
            parts.append(f"STDERR:\n{self.stderr}")
        parts.append(f"Exit code: {self.exit_code}")
        return "\n".join(parts)

    def truncated(self, max_len: int = 10000) -> str:
        t = self.text
        if len(t) > max_len:
            t = t[:max_len] + f"\n... (truncated, total {len(t)} chars)"
        return t


# ---- Local sandbox (dev, no Docker) ----
class LocalSandboxSession:
    """Runs commands on the host inside a workspace directory."""

    def __init__(self, session_id: str, workspace_path: str):
        self.session_id = session_id
        self.workspace_path = workspace_path
        self.container_id = None

    async def exec_command(
        self, command: str, timeout: int = 30, workdir: str | None = None
    ) -> SandboxResult:
        t = min(timeout, settings.sandbox_max_exec_timeout)
        cwd = workdir or self.workspace_path
        try:
            # Prepend a cd to handle Unicode paths on Windows
            # Also: replace /workspace with actual path for Windows compatibility
            sanitized_command = command.replace("/workspace", cwd)
            full_cmd = f'cd "{cwd}" && {sanitized_command}'
            proc = await asyncio.wait_for(
                asyncio.create_subprocess_shell(
                    full_cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    env={**os.environ, "HOME": os.path.expanduser("~")},
                ),
                timeout=t,
            )
            stdout, stderr = await proc.communicate()
            return SandboxResult(
                proc.returncode or 0,
                stdout.decode("utf-8", errors="replace") if stdout else "",
                stderr.decode("utf-8", errors="replace") if stderr else "",
            )
        except asyncio.TimeoutError:
            return SandboxResult(-1, "", f"Command timed out after {t}s")
        except Exception as e:
            return SandboxResult(-1, "", str(e))

    def destroy(self):
        pass


# ---- Docker sandbox (production) ----
class DockerSandboxSession:
    def __init__(self, session_id: str, container, workspace_path: str):
        self.session_id = session_id
        self.container = container
        self.workspace_path = workspace_path
        self.container_id = container.short_id

    async def exec_command(
        self, command: str, timeout: int = 30, workdir: str = "/workspace"
    ) -> SandboxResult:
        t = min(timeout, settings.sandbox_max_exec_timeout)
        try:
            result = self.container.exec_run(
                cmd=["bash", "-c", command],
                user="sandbox",
                workdir=workdir,
                timeout=t,
                environment={"HOME": "/home/sandbox", "USER": "sandbox"},
            )
            exit_code = result.exit_code
            output = (
                result.output.decode("utf-8", errors="replace")
                if result.output
                else ""
            )
            return SandboxResult(exit_code, output, "")
        except Exception as e:
            return SandboxResult(-1, "", str(e))

    def destroy(self):
        try:
            self.container.stop(timeout=10)
        except Exception:
            pass
        try:
            self.container.remove(force=True)
        except Exception:
            pass


# ---- Manager ----
class SandboxManager:
    """Creates and manages sandbox sessions."""

    def __init__(self):
        self._sessions: dict[str, LocalSandboxSession | DockerSandboxSession] = {}
        self._docker_available: bool | None = None
        self._docker_client = None

    async def _quick_docker_check(self) -> bool:
        """
        Quick check if Docker is available without hanging on Windows.
        Uses subprocess with 2s timeout so it never blocks.
        """
        if self._docker_available is not None:
            return self._docker_available

        try:
            proc = await asyncio.wait_for(
                asyncio.create_subprocess_exec(
                    "docker", "info", "--format", "{{.ServerVersion}}",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.DEVNULL,
                ),
                timeout=3.0,
            )
            stdout, _ = await proc.communicate()
            self._docker_available = proc.returncode == 0 and bool(stdout.strip())

            if self._docker_available:
                import docker
                self._docker_client = docker.from_env()

            return self._docker_available

        except Exception:
            self._docker_available = False
            return False

    async def create_session(
        self, session_id: str
    ) -> LocalSandboxSession | DockerSandboxSession:
        """Create a new sandbox session."""
        # Resolve workspace base to absolute path to avoid path traversal false positives
        if not settings.sandbox_workspace_base:
            ws_base = os.path.abspath("./data/workspaces")
        else:
            ws_base = os.path.abspath(settings.sandbox_workspace_base)
        os.makedirs(ws_base, exist_ok=True)
        workspace_path = os.path.join(ws_base, session_id)
        os.makedirs(workspace_path, exist_ok=True)

        # Try Docker if available (cached check, non-blocking)
        if await self._quick_docker_check():
            try:
                return await self._create_docker_session(session_id, workspace_path)
            except Exception as e:
                print(f"Docker session creation failed, falling back to local: {e}")

        return self._create_local_session(session_id, workspace_path)

    def _create_local_session(self, session_id: str, workspace_path: str) -> LocalSandboxSession:
        session = LocalSandboxSession(session_id, workspace_path)
        self._sessions[session_id] = session
        return session

    async def _create_docker_session(self, session_id: str, workspace_path: str) -> DockerSandboxSession:
        if not self._docker_client:
            raise RuntimeError("Docker not available")

        container_name = f"agent-{session_id[:16]}"
        image = settings.sandbox_image

        # Pull image if needed
        try:
            self._docker_client.images.get(image)
        except Exception:
            print(f"Pulling sandbox image {image}...")
            self._docker_client.images.pull(image)

        container = self._docker_client.containers.run(
            image=image,
            name=container_name,
            detach=True,
            auto_remove=True,
            hostname=f"agent-{session_id[:8]}",
            volumes={workspace_path: {"bind": "/workspace", "mode": "rw"}},
            read_only=True,
            tmpfs={"/tmp": "size=256m,noexec,nosuid"},
            cap_drop=["ALL"],
            security_opt=["no-new-privileges:true"],
            mem_limit=settings.sandbox_memory_limit,
            cpu_quota=settings.sandbox_cpu_quota,
            pids_limit=settings.sandbox_pids_limit,
            network_disabled=settings.sandbox_network_disabled,
            user="sandbox",
            working_dir="/workspace",
            command=["tail", "-f", "/dev/null"],
        )
        session = DockerSandboxSession(session_id, container, workspace_path)
        self._sessions[session_id] = session
        return session

    def get_session(self, session_id: str) -> LocalSandboxSession | DockerSandboxSession | None:
        return self._sessions.get(session_id)

    async def destroy_session(self, session_id: str):
        session = self._sessions.pop(session_id, None)
        if session:
            session.destroy()

    async def destroy_all(self):
        for sid in list(self._sessions.keys()):
            await self.destroy_session(sid)

    async def initialize(self):
        """Pre-check Docker availability."""
        await self._quick_docker_check()
        if self._docker_available:
            print("Docker available, using Docker sandbox")
        else:
            print("Docker not available, using local sandbox")

    async def shutdown(self):
        await self.destroy_all()


# Global singleton
sandbox_manager = SandboxManager()
