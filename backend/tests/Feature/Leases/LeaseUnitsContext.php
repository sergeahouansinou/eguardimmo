<?php

declare(strict_types=1);

namespace Tests\Feature\Leases;

use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseUnit;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Properties\Models\Property;
use App\Modules\Properties\Models\Unit;
use Illuminate\Support\Facades\DB;

final class LeaseUnitsContext
{
    public static function urlAjout(Organization $organisation, string $bail): string
    {
        return "/api/v1/org/{$organisation->id}/leases/{$bail}/units";
    }

    public static function urlFermeture(Organization $organisation, string $bail, string $ligne): string
    {
        return "/api/v1/org/{$organisation->id}/leases/{$bail}/units/{$ligne}/end";
    }

    /**
     * Bail signé du 2026-01-01 au 2029-01-01 (exclu), lot principal ouvert dès le début.
     *
     * @param  array<string, mixed>  $attributs
     */
    public static function signe(Organization $organisation, ?Unit $lot = null, array $attributs = []): Lease
    {
        return LeaseSignContext::bailSigneSur($organisation, $lot ?? LeasesContext::lot($organisation), $attributs);
    }

    /**
     * @param  array<string, mixed>  $attributs
     */
    public static function brouillon(Organization $organisation, ?Unit $lot = null, array $attributs = []): Lease
    {
        $bail = LeasesContext::bail($organisation, ['starts_on' => '2026-01-01', 'ends_on' => '2029-01-01', 'tacit_renewal' => false, ...$attributs]);
        LeasesReadContext::occuper($organisation, $bail, $lot ?? LeasesContext::lot($organisation));

        return $bail;
    }

    public static function lotArchive(Organization $organisation): Unit
    {
        $lot = LeasesContext::lot($organisation);
        LeasesContext::dans($organisation, fn () => Unit::query()->whereKey($lot->id)->first()?->forceFill(['archived_at' => now()])->save());

        return $lot;
    }

    public static function lotDuPays(Organization $organisation, string $pays): Unit
    {
        return LeasesContext::dans($organisation, fn (): Unit => Unit::factory()->create([
            'property_id' => Property::factory()->create(['address' => ['line1' => '1 rue de la Loi', 'postal_code' => '1000', 'city' => 'Bruxelles', 'country' => $pays]])->id,
            'unit_type_term_id' => LeasesContext::terme('unit_type', 'apartment')->id,
        ]));
    }

    /**
     * @param  array<string, mixed>  $surcharges
     * @return array<string, mixed>
     */
    public static function corpsAjout(Lease $bail, Unit $lot, array $surcharges = []): array
    {
        return ['lock_version' => $bail->lock_version, 'unit_id' => $lot->id, 'is_main' => false, 'valid_from' => '2026-06-01', ...$surcharges];
    }

    /**
     * @param  array<string, mixed>  $surcharges
     * @return array<string, mixed>
     */
    public static function corpsFermeture(Lease $bail, string $fin, array $surcharges = []): array
    {
        return ['lock_version' => $bail->lock_version, 'valid_to' => $fin, ...$surcharges];
    }

    public static function ligne(Organization $organisation, Lease $bail, Unit $lot): LeaseUnit
    {
        return LeasesContext::dans($organisation, fn (): LeaseUnit => LeaseUnit::query()->where('lease_id', $bail->id)->where('unit_id', $lot->id)->orderBy('valid_from')->firstOrFail());
    }

    /**
     * @return list<string> "lot|principal|début|fin"
     */
    public static function lignes(Lease $bail): array
    {
        return DB::table('lease_units')->where('lease_id', $bail->id)->orderBy('valid_from')->orderBy('unit_id')->get()
            ->map(fn (object $l): string => implode('|', [$l->unit_id, $l->is_main ? 'P' : 'A', $l->valid_from, $l->valid_to ?? '-']))
            ->all();
    }

    public static function version(Lease $bail): int
    {
        return (int) DB::table('leases')->where('id', $bail->id)->value('lock_version');
    }

    public static function fermer(Organization $organisation, Lease $bail, string $statut, bool $archive = false): void
    {
        LeasesContext::dans($organisation, fn () => Lease::query()->whereKey($bail->id)->update(['status' => $statut, 'archived_at' => $archive ? now() : null]));
    }
}
