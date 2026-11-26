import "server-only";
import { randomInt } from "node:crypto";

// No 0, O, 1 or I: they are easy to mix up when written by hand.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function part(length: number): string {
    let result = "";
    for (let i = 0; i < length; i++) {
        result += ALPHABET[randomInt(ALPHABET.length)];
    }
    return result;
}

// Looks like SVR-K7MQ-4XPD. About a trillion possible codes.
export function generateReferenceCode(): string {
    return `SVR-${part(4)}-${part(4)}`;
}