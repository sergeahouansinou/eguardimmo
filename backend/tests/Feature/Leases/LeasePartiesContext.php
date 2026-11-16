<?php

declare(strict_types=1);

namespace Tests\Feature\Leases;

use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Organizations\Models\Organization;
use Illuminate\Testing\TestResponse;

final class LeasePartiesContext
{
    public static function urlAjout(Organization $organisation, Lease|string $bail): string
    {
        return "/api/v1/org/{$organisation->id}/leases/".($bail instanceof Lease ? $bail->id : $bail).'/parties';
    }

    public static function urlFin(Organization $organisation, Lease|string $bail, LeaseParty|string $ligne): string
    {
        return self::urlAjout($organisation, $bail).'/'.($ligne instanceof LeaseParty ? $ligne->id : $ligne).'/end';
    }

    /**
     * @param  array<string, mixed>  $attributs
     */
    public static function bailSigne(Organization $organisation, array $attributs = []): Lease
    {
        return LeasesReadContext::bailSigne($organisation, ['starts_on' => '2026-01-01', 'ends_on' => '2029-01-01', ...$attributs]);
    }

    /**
     * @param  array<string, mixed>  $attributs
     */
    public static function brouillon(Organization $organisation, array $attributs = []): Lease
    {
        return LeasesContext::bail($organisation, ['starts_on' => '2027-02-01', 'ends_on' => '2030-02-01', ...$attributs]);
    }

    /**
     * Ligne de locataire sur une partie neuve.
     *
     * @param  array<string, mixed>  $attributs
     */
    public static function ligne(Organization $organisation, Lease $bail, array $attributs = []): LeaseParty
    {
        $partie = $attributs['party_id'] ?? LeasesContext::partie($organisation)->id;
        unset($attributs['party_id']);

        return LeasesContext::dans($organisation, fn (): LeaseParty => LeaseParty::factory()->create([
            'lease_id' => $bail->id,
            'party_id' => $partie,
            'valid_from' => $bail->starts_on->toDateString(),
            ...$attributs,
        ]));
    }

    /**
     * @param  array<string, mixed>  $extra
     * @return array<string, mixed>
     */
    public static function corpsAjout(Lease $bail, string $partie, string $role = 'tenant', array $extra = []): array
    {
        return ['lock_version' => $bail->lock_version, 'party_id' => $partie, 'role' => $role, ...$extra];
    }

    /**
     * @param  array<string, mixed>  $extra
     */
    public static function ajouter(mixed $test, Lease $bail, string $partie, string $role = 'tenant', array $extra = []): TestResponse
    {
        return $test->postJson(self::urlAjout($test->org, $bail), self::corpsAjout(self::frais($test->org, $bail), $partie, $role, $extra));
    }

    public static function clore(mixed $test, Lease $bail, LeaseParty|string $ligne, string $fin, ?int $version = null): TestResponse
    {
        return $test->postJson(self::urlFin($test->org, $bail, $ligne), ['lock_version' => $version ?? self::frais($test->org, $bail)->lock_version, 'valid_to' => $fin]);
    }

    public static function frais(Organization $organisation, Lease $bail): Lease
    {
        return LeasesContext::dans($organisation, fn (): Lease => Lease::query()->findOrFail($bail->id));
    }

    public static function version(Organization $organisation, Lease $bail): int
    {
        return self::frais($organisation, $bail)->lock_version;
    }

    public static function statut(Organization $organisation, Lease $bail, LeaseStatus $statut, bool $archive = false): void
    {
        LeasesContext::dans($organisation, fn (): bool => Lease::query()->whereKey($bail->id)->update([
            'status' => $statut->value,
            'archived_at' => $archive ? now() : null,
        ]) > 0);
    }

    /**
     * @return list<array{party_id: string, role: string, from: string, to: string|null, guarantees: string|null}>
     */
    public static function lignes(Organization $organisation, Lease $bail): array
    {
        return LeasesContext::dans($organisation, fn (): array => LeaseParty::query()
            ->where('lease_id', $bail->id)
            ->orderBy('valid_from')->orderBy('created_at')->orderBy('id')
            ->get()
            ->map(fn (LeaseParty $l): array => [
                'party_id' => $l->party_id,
                'role' => $l->role->value,
                'from' => $l->valid_from->toDateString(),
                'to' => $l->valid_to?->toDateString(),
                'guarantees' => $l->guarantees_party_id,
            ])
            ->all());
    }

    public static function ouvertes(Organization $organisation, Lease $bail, string $role = 'tenant'): int
    {
        return count(array_filter(self::lignes($organisation, $bail), fn (array $l): bool => $l['role'] === $role && $l['to'] === null));
    }
}
