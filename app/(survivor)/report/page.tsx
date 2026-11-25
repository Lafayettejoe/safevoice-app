import { SurvivorCard } from "../../../components/survivor/SurvivorCard";

export default function ReportPlaceholderPage() {
    return (
        <SurvivorCard>
            <h1 className="text-lg font-bold">Consent recorded</h1>
            <p className="mt-2 text-sm text-on-surface-variant">
                The recording screen is built in the next task. This is a temporary page.
            </p>
        </SurvivorCard>
    );
}