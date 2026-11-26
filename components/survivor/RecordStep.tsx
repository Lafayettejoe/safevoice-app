"use client";
// Uses the microphone and MediaRecorder, so it must run in the browser.

import { useEffect, useRef, useState } from "react";
import {
    AUDIO_BITS_PER_SECOND,
    MAX_RECORDING_SECONDS,
    MIN_RECORDING_SECONDS,
} from "../../lib/report-options";
import { BrandMark } from "../shared/BrandMark";
import { useLanguage } from "./LanguageProvider";
import { SurvivorCard } from "./SurvivorCard";

export type RecordedAudio = {
    blob: Blob;
    seconds: number;
    mimeType: string;
};

type Phase = "idle" | "recording" | "recorded";

// Chrome and Android use WebM/Opus. iPhones record MP4.
const MIME_CANDIDATES = [
    "audio/webm;codecs=opus",
    "audio/ogg;codecs=opus",
    "audio/mp4",
];

function pickMimeType(): string {
    for (const type of MIME_CANDIDATES) {
        if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return "";
}

function formatTime(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function RecordStep({
    onContinue,
}: {
    onContinue: (audio: RecordedAudio) => void;
}) {
    const { language, status, t } = useLanguage();

    const [phase, setPhase] = useState<Phase>("idle");
    const [elapsed, setElapsed] = useState(0);
    const [audio, setAudio] = useState<RecordedAudio | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [messageKey, setMessageKey] = useState<string | null>(null);

    const recorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const startedAtRef = useRef(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    function clearTimer() {
        if (timerRef.current !== null) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }

    // Turns the microphone off, so the browser's recording indicator goes away.
    function releaseStream() {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
    }

    // Free the object URL when it is replaced or the screen closes.
    useEffect(() => {
        return () => {
            if (audioUrl) URL.revokeObjectURL(audioUrl);
        };
    }, [audioUrl]);

    // If the screen closes mid-recording, stop everything.
    useEffect(() => {
        return () => {
            clearTimer();
            const recorder = recorderRef.current;
            if (recorder) {
                recorder.onstop = null;
                if (recorder.state === "recording") recorder.stop();
            }
            releaseStream();
        };
    }, []);

    function finish(type: string) {
        clearTimer();
        releaseStream();

        const seconds = Math.min(
            Math.round((Date.now() - startedAtRef.current) / 1000),
            MAX_RECORDING_SECONDS
        );
        const blob = new Blob(chunksRef.current, { type: type || "audio/webm" });
        chunksRef.current = [];

        if (seconds < MIN_RECORDING_SECONDS) {
            setMessageKey("record.tooShort");
            setPhase("idle");
            return;
        }

        setAudio({ blob, seconds, mimeType: blob.type });
        setAudioUrl(URL.createObjectURL(blob));
        setPhase("recorded");
    }

    function stop() {
        const recorder = recorderRef.current;
        if (recorder && recorder.state === "recording") recorder.stop();
    }

    async function start() {
        setMessageKey(null);

        if (
            typeof navigator === "undefined" ||
            !navigator.mediaDevices?.getUserMedia ||
            typeof MediaRecorder === "undefined"
        ) {
            setMessageKey("record.unsupported");
            return;
        }

        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true },
            });
        } catch {
            setMessageKey("record.denied");
            return;
        }

        const mimeType = pickMimeType();
        let recorder: MediaRecorder;
        try {
            recorder = new MediaRecorder(stream, {
                ...(mimeType ? { mimeType } : {}),
                audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
            });
        } catch {
            stream.getTracks().forEach((track) => track.stop());
            setMessageKey("record.unsupported");
            return;
        }

        streamRef.current = stream;
        recorderRef.current = recorder;
        chunksRef.current = [];
        startedAtRef.current = Date.now();

        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) chunksRef.current.push(event.data);
        };
        recorder.onstop = () => finish(recorder.mimeType);
        recorder.start();

        setElapsed(0);
        setPhase("recording");

        timerRef.current = setInterval(() => {
            const seconds = Math.floor((Date.now() - startedAtRef.current) / 1000);
            setElapsed(seconds);
            if (seconds >= MAX_RECORDING_SECONDS) {
                setMessageKey("record.tooLong");
                stop();
            }
        }, 250);
    }

    function recordAgain() {
        setAudio(null);
        setAudioUrl(null);
        setMessageKey(null);
        setPhase("idle");
    }

    if (status === "error") {
        return (
            <SurvivorCard>
                <p>Could not load this page. Please reload.</p>
            </SurvivorCard>
        );
    }

    if (status !== "ready") {
        return <SurvivorCard busy />;
    }

    const isError =
        messageKey === "record.denied" ||
        messageKey === "record.unsupported" ||
        messageKey === "record.tooShort";

    return (
        <SurvivorCard lang={language}>
            <BrandMark />
            <h1 className="mt-4 mb-2 text-center text-lg font-bold">
                {t("record.title")}
            </h1>
            <p className="mb-6 text-center text-base text-on-surface-variant">
                {t("record.hint")}
            </p>

            {/* Announced to screen readers when recording starts or stops. */}
            <p className="sr-only" role="status" aria-live="polite">
                {phase === "recording" ? t("record.start") : ""}
            </p>

            {phase === "recording" && (
                <p
                    className="mb-4 text-center text-3xl font-bold tabular-nums"
                    aria-hidden="true"
                >
                    {formatTime(elapsed)}
                    <span className="text-base font-medium text-on-surface-variant">
                        {" / "}
                        {formatTime(MAX_RECORDING_SECONDS)}
                    </span>
                </p>
            )}

            {phase === "recorded" && audioUrl && (
                <div className="mb-4">
                    <p className="mb-2 text-sm font-medium">{t("record.listen")}</p>
                    <audio controls src={audioUrl} className="w-full" />
                </div>
            )}

            {messageKey && (
                <div
                    role="alert"
                    className={`mb-4 rounded-lg px-3 py-2 text-sm ${isError
                        ? "bg-error-container text-on-error-container"
                        : "bg-surface-container text-on-surface"
                        }`}
                >
                    {t(messageKey)}
                </div>
            )}

            {phase === "idle" && (
                <button
                    type="button"
                    onClick={start}
                    className="flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-secondary px-4 text-base font-semibold text-on-secondary"
                >
                    <svg
                        aria-hidden="true"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <rect x="9" y="3" width="6" height="11" rx="3" />
                        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                    </svg>
                    {t("record.start")}
                </button>
            )}

            {phase === "recording" && (
                <button
                    type="button"
                    onClick={stop}
                    className="flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-inverse-surface px-4 text-base font-semibold text-inverse-on-surface"
                >
                    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
                        <rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" />
                    </svg>
                    {t("record.stop")}
                </button>
            )}

            {phase === "recorded" && audio && (
                <>
                    <button
                        type="button"
                        onClick={() => onContinue(audio)}
                        className="min-h-11 w-full rounded-lg bg-secondary px-4 text-base font-semibold text-on-secondary"
                    >
                        {t("common.continue")}
                    </button>
                    <button
                        type="button"
                        onClick={recordAgain}
                        className="mt-3 min-h-11 w-full rounded-lg border border-outline px-4 text-base font-medium"
                    >
                        {t("record.again")}
                    </button>
                </>
            )}
        </SurvivorCard>
    );
}