import fs from "fs";
import path from "path";
import { spawn, execFile } from "child_process";
import util from "util";
import { hlsDir, hlsEnabled, downloadsDir, port } from "./config.js";
import { ensureDir } from "./cache.js";

const execFileAsync = util.promisify(execFile);
const active = new Map();
const starting = new Map();

function getSessionDir(sessionId) {
    return path.join(hlsDir, sessionId);
}

function getPlaylistPath(sessionId) {
    return path.join(getSessionDir(sessionId), "index.m3u8");
}

async function probeStream(streamUrl, audioTrack = 0) {
    try {
        const { stdout: vOut } = await execFileAsync("ffprobe", [
            "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name",
            "-of", "default=noprint_wrappers=1:nokey=1", streamUrl
        ], { timeout: 15000 });

        const { stdout: aOut } = await execFileAsync("ffprobe", [
            "-v", "error", "-select_streams", `a:${audioTrack}`, "-show_entries", "stream=codec_name",
            "-of", "default=noprint_wrappers=1:nokey=1", streamUrl
        ], { timeout: 15000 });

        return {
            videoCodec: vOut.trim().toLowerCase(),
            audioCodec: aOut.trim().toLowerCase()
        };
    } catch (err) {
        console.log(`[ffprobe] timeout or error: ${err.message}`);
        return { videoCodec: "unknown", audioCodec: "unknown" };
    }
}

async function getAudioTracks(sessionId) {
    const streamUrl = `http://127.0.0.1:${port}/api/stream/${sessionId}`;
    try {
        const { stdout } = await execFileAsync("ffprobe", [
            "-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_name:stream_tags=language,title",
            "-of", "json", streamUrl
        ], { timeout: 10000 });

        const data = JSON.parse(stdout);
        const streams = data.streams || [];
        return streams.map((stream, idx) => {
            const lang = stream.tags?.language || stream.tags?.LANGUAGE || "und";
            const title = stream.tags?.title || stream.tags?.TITLE || `Track ${idx + 1} (${stream.codec_name})`;
            return {
                id: idx, // 0-based index for ffmpeg -map 0:a:${id}
                language: lang,
                title: title,
                codec: stream.codec_name
            };
        });
    } catch (e) {
        console.error(`[hls] failed to probe audio tracks for ${sessionId}:`, e.message);
        return [];
    }
}

async function ensureHls(session, audioTrack = 0, startTime = 0) {
    if (!hlsEnabled) {
        throw new Error("HLS disabled");
    }

    if (active.has(session.id)) {
        const record = active.get(session.id);
        if (record.audioTrack === audioTrack && record.startTime === startTime) {
            return record;
        } else {
            console.log(`[hls] Audio track changed or seeking. Restarting HLS...`);
            stopHls(session.id);
        }
    }

    if (starting.has(session.id)) {
        const startRecord = starting.get(session.id);
        if (startRecord.audioTrack === audioTrack && startRecord.startTime === startTime) {
            return await startRecord.promise;
        } else {
            console.log(`[hls] Condition changed while starting. Cleaning up old start promise...`);
            starting.delete(session.id);
        }
    }

    const promise = (async () => {
        const sessionDir = getSessionDir(session.id);
        ensureDir(sessionDir);

        // Clean out old playlist/segment files before starting new HLS stream
        if (fs.existsSync(sessionDir)) {
            const files = fs.readdirSync(sessionDir);
            for (const file of files) {
                try { fs.unlinkSync(path.join(sessionDir, file)); } catch (e) { }
            }
        }

        const playlistPath = getPlaylistPath(session.id);
        const segmentPattern = path.join(sessionDir, "segment_%05d.m4s");
        const streamUrl = `http://127.0.0.1:${port}/api/stream/${session.id}`;

        const codecs = await probeStream(streamUrl, audioTrack);
        console.log(`[hls] Codecs for ${session.id} (track ${audioTrack}): Video=${codecs.videoCodec}, Audio=${codecs.audioCodec}`);

        const vCodec = "copy";
        const aCodec = (codecs.audioCodec === "aac" || codecs.audioCodec === "mp3") ? "copy" : "aac";

        const ffmpegArgs = [
            "-err_detect", "ignore_err",
            "-fflags", "+genpts",
        ];

        if (startTime > 0) {
            ffmpegArgs.push("-ss", String(startTime), "-noaccurate_seek");
        }

        ffmpegArgs.push(
            "-copyts",
            "-i", streamUrl,
            "-map", "0:v:0",
            "-map", `0:a:${audioTrack}`,
            "-c:v", vCodec
        );

        // -copyts preserves original timestamps; -noaccurate_seek snaps both streams to
        // the same keyframe boundary so there's no audio-video offset after seeking.

        ffmpegArgs.push("-c:a", aCodec);
        if (aCodec === "aac") {
            ffmpegArgs.push("-b:a", "192k", "-ac", "2");
        }

        ffmpegArgs.push(
            "-threads", "0",
            "-f", "hls",
            "-hls_time", "5",
            "-hls_playlist_type", "event",
            "-hls_segment_type", "fmp4",
            "-hls_flags", "independent_segments",
            "-movflags", "frag_keyframe+default_base_moof",
            "-hls_segment_filename", segmentPattern,
            playlistPath
        );

        console.log(`[ffmpeg] Spawning for ${session.id} (track ${audioTrack}, seek ${startTime}s): ${vCodec} / ${aCodec}`);
        const proc = spawn("ffmpeg", ffmpegArgs, { cwd: sessionDir });
        const record = { proc, playlistPath, sessionDir, audioTrack, startTime };

        proc.stderr.on("data", (data) => {
            const str = data.toString();
            // Suppress the spammy frame=... logs unless there's an actual Error
            if (str.includes("Error") && !str.includes("ignore_err")) {
                console.log(`[ffmpeg err] ${str.trim()}`);
            }
        });

        proc.on("exit", (code) => {
            if (active.get(session.id)?.proc === proc) {
                if (code === 0) {
                    const record = active.get(session.id);
                    record.completed = true;
                } else {
                    active.delete(session.id);
                }
            }
        });

        active.set(session.id, record);
        if (starting.get(session.id)?.promise === promise) {
            starting.delete(session.id);
        }
        return record;
    })();

    starting.set(session.id, { promise, audioTrack, startTime });
    return await promise;
}

function getPlaylist(sessionId) {
    return getPlaylistPath(sessionId);
}

function getSegmentPath(sessionId, segmentName) {
    return path.join(getSessionDir(sessionId), segmentName);
}

function stopHls(sessionId) {
    const record = active.get(sessionId);
    if (record) {
        try { record.proc.kill("SIGKILL"); } catch (e) { }
        active.delete(sessionId);
    }
    starting.delete(sessionId);

    const dir = getSessionDir(sessionId);
    if (fs.existsSync(dir)) {
        try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { }
    }
}

function stopAllHls() {
    for (const [sessionId, record] of active.entries()) {
        try { record.proc.kill("SIGKILL"); } catch { /* already dead */ }
        active.delete(sessionId);

        const dir = getSessionDir(sessionId);
        if (fs.existsSync(dir)) {
            try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { }
        }
    }
    starting.clear();
}

function clearHlsDir() {
    stopAllHls(); // kill procs before touching files
    if (!fs.existsSync(hlsDir)) return;
    fs.rmSync(hlsDir, { recursive: true, force: true });
}

async function getActualStartTime(sessionId) {
    const sessionDir = getSessionDir(sessionId);
    for (let i = 0; i < 60; i++) {
        const files = fs.readdirSync(sessionDir).filter(f => f.endsWith(".m4s") && !f.includes("init"));
        if (files.length > 0) {
            files.sort();
            const segPath = path.join(sessionDir, files[0]);
            try {
                const { stdout } = await execFileAsync("ffprobe", [
                    "-v", "error",
                    "-show_entries", "frame=pts_time",
                    "-read_intervals", "%+#1",
                    "-of", "csv=p=0",
                    segPath
                ], { timeout: 5000 });
                const time = parseFloat(stdout.trim());
                if (!isNaN(time) && time > 0) return time;
            } catch (e) {}
            // Fallback: try pts_time from packet instead
            try {
                const { stdout } = await execFileAsync("ffprobe", [
                    "-v", "error",
                    "-show_packets",
                    "-read_intervals", "%+#1",
                    "-of", "csv=pk=pts_time",
                    segPath
                ], { timeout: 5000 });
                const lines = stdout.trim().split("\n").filter(l => l);
                const times = lines.map(l => parseFloat(l)).filter(t => !isNaN(t) && t > 0);
                if (times.length > 0) return Math.min(...times);
            } catch (e) {}
            break;
        }
        await new Promise(r => setTimeout(r, 200));
    }
    return null;
}

export { ensureHls, getPlaylist, getSegmentPath, stopHls, stopAllHls, clearHlsDir, getAudioTracks, getActualStartTime };
