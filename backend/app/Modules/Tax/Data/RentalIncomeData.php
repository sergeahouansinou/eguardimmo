<?php

declare(strict_types=1);

namespace App\Modules\Tax\Data;

final readonly class RentalIncomeData
{
    /**
     * @param  list<PropertyResultData>  $properties
     * @param  list<LineResultData>  $totals  toutes lignes, tous biens
     * @param  array{gross_receipts: int, allowance_bp: int, base_after_allowance: int, threshold: int, real_base: int}  $micro  base brute et base après abattement à côté de la base du réel, sans verdict
     * @param  array{result: int, interest_part: int, other_part: int, imputable_on_global_income: int, carried_forward: int}|null  $deficit  simulation, seulement si le foyer est entièrement dans l'application
     * @param  list<array{code: string, property_id: ?string, amount?: int, detail?: string}>  $warnings
     * @param  list<array{code: string, property_id: string}>  $blockers
     * @param  list<string>  $mentions
     */
    public function __construct(
        public int $incomeYear,
        public string $formVersion,
        public string $templateVersion,
        public string $currency,
        public bool $provisional,
        public bool $householdComplete,
        public array $properties,
        public array $totals,
        public array $micro,
        public ?array $deficit,
        public array $warnings,
        public array $blockers,
        public string $warning,
        public array $mentions,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toSnapshot(): array
    {
        return [
            'income_year' => $this->incomeYear,
            'form_version' => $this->formVersion,
            'template_version' => $this->templateVersion,
            'currency' => $this->currency,
            'household_complete' => $this->householdComplete,
            'properties' => array_map(fn (PropertyResultData $p): array => [
                'property_id' => $p->propertyId, 'name' => $p->name, 'premises' => $p->premises, 'co_owners' => $p->coOwners,
                'lines' => array_map(fn (LineResultData $l): array => $l->toArray(), $p->lines),
            ], $this->properties),
            'totals' => array_map(fn (LineResultData $l): array => $l->toArray(), $this->totals),
            'micro' => $this->micro,
            'deficit' => $this->deficit,
            'warnings' => $this->warnings,
            'warning' => $this->warning,
            'mentions' => $this->mentions,
        ];
    }

    public function fingerprint(): string
    {
        return hash('sha256', (string) json_encode($this->toSnapshot(), JSON_THROW_ON_ERROR));
    }
}
