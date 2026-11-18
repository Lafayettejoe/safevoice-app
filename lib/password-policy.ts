// One list of password rules, shared by the form (live checklist) and the
// server (Zod validation when an admin creates an account). Pure code, so it
// is safe to import in the browser.

export type PasswordRule = {
    id: string;
    label: string;
    test: (password: string) => boolean;
};

export const PASSWORD_RULES: PasswordRule[] = [
    {
        id: "length",
        label: "At least 8 characters",
        test: (password) => password.length >= 8,
    },
    {
        id: "uppercase",
        label: "One uppercase letter",
        test: (password) => /[A-Z]/.test(password),
    },
    {
        id: "lowercase",
        label: "One lowercase letter",
        test: (password) => /[a-z]/.test(password),
    },
    {
        id: "number",
        label: "One number",
        test: (password) => /[0-9]/.test(password),
    },
];

export function isPasswordValid(password: string): boolean {
    return PASSWORD_RULES.every((rule) => rule.test(password));
}