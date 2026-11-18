import { NextResponse } from "next/server";

// Every API route answers in one of these two shapes.

export function ok<T>(data: T, status = 200) {
    return NextResponse.json({ success: true as const, data }, { status });
}

export function fail(code: string, message: string, status: number) {
    return NextResponse.json(
        { success: false as const, error: { code, message } },
        { status },
    );
}