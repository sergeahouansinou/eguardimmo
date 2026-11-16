<?php

declare(strict_types=1);

namespace Tests\Feature\Leases;

use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Enums\TermChangeReason;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseTerm;
use App\Modules\Organizations\Models\Organization;
use Money\Money;

final class LeaseTermsReviseContext
{
    public static function url(Organization $organisation, Lease|string $bail): string
    {
        $id = $bail instanceof Lease ? $bail->id : $bail;

        return "/api/v1/org/{$organisation->id}/leases/{$id}/terms/revise";
    }

    /**
     * @param  array<string, mixed>  $attributs
     */
    public static function bail(Organization $organisation, array $attributs = []): Lease
    {
        return LeasesReadContext::bailSigne($organisation, ['starts_on' => '2025-01-01', 'ends_on' => '2029-01-01', ...$attributs]);
    }

    /**
     * @param  array<string, mixed>  $attributs
     */
    public static function ligne(Organization $organisation, Lease $bail, string $composante, int $centimes, array $attributs = []): LeaseTerm
    {
        return LeasesReadContext::terme($organisation, $bail, $composante, [
            'amount' => Money::EUR($centimes),
            'valid_from' => '2026-01-01',
            ...$attributs,
        ]);
    }

    /**
     * @param  list<array<string, mixed>>  $changements
     * @param  array<string, mixed>  $surcharges
     * @return array<string, mixed>
     */
    public static function corps(Lease $bail, string $effet, array $changements, array $surcharges = []): array
    {
        return [
            'lock_version' => $bail->lock_version,
            'effective_on' => $effet,
            'reason' => TermChangeReason::Revision->value,
            'changes' => $changements,
            ...$surcharges,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function changer(string $composante, int $centimes, array $extra = []): array
    {
        return ['component_term_id' => LeasesContext::composante($composante)->id, 'amount' => $centimes, ...$extra];
    }

    /**
     * @return list<array{from: string, to: string|null, amount: int}>
     */
    public static function historique(Organization $organisation, Lease $bail, string $composante): array
    {
        return LeasesContext::dans($organisation, fn (): array => LeaseTerm::query()
            ->where('lease_id', $bail->id)
            ->where('component_term_id', LeasesContext::composante($composante)->id)
            ->orderBy('valid_from')
            ->get()
            ->map(fn (LeaseTerm $l): array => [
                'from' => $l->valid_from->toDateString(),
                'to' => $l->valid_to?->toDateString(),
                'amount' => (int) $l->amount->getAmount(),
            ])
            ->all());
    }

    public static function statut(Organization $organisation, Lease $bail, LeaseStatus $statut): void
    {
        LeasesContext::dans($organisation, fn (): bool => Lease::query()->whereKey($bail->id)->update(['status' => $statut->value, 'signed_on' => '2025-12-15']) > 0);
    }
}
